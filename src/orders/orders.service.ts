import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { OrderCreatedEvent, OrderStatusUpdatedEvent } from '../events/order.events';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UpdateOrderItemDto } from './dto/update-order-item.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { OrderStatus, Role } from '@prisma/client';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
    private eventEmitter: EventEmitter2,
  ) {}

  async createOrder(userId: string, dto: CreateOrderDto) {
    this.logger.log(`Iniciando creación de orden para usuario ${userId}`);

    try {
      const cart = await this.prisma.cart.findUnique({
        where: { userId },
        include: {
          items: {
            include: {
              variant: {
                include: {
                  product: true,
                },
              },
            },
          },
        },
      });

      if (!cart || cart.items.length === 0) {
        this.logger.warn(
          `Usuario ${userId} intentó crear orden con carrito vacío`,
        );
        throw new BadRequestException('El carrito está vacío');
      }

      const address = await this.prisma.address.findFirst({
        where: {
          id: dto.addressId,
          userId,
          isActive: true,
        },
      });

      if (!address) {
        this.logger.warn(
          `Dirección ${dto.addressId} no encontrada para usuario ${userId}`,
        );
        throw new NotFoundException(
          'Dirección no encontrada o no pertenece al usuario',
        );
      }

      let subtotal = 0;

      for (const item of cart.items) {
        if (!item.variant.isActive || !item.variant.product.isActive) {
          this.logger.warn(
            `Producto inactivo detectado en carrito: ${item.variant.product.name} (${item.variantId})`,
          );
          throw new BadRequestException(
            `El producto ${item.variant.product.name} ya no está disponible`,
          );
        }

        if (item.variant.stock < item.quantity) {
          this.logger.warn(
            `Stock insuficiente: ${item.variant.product.name} - Solicitado: ${item.quantity}, Disponible: ${item.variant.stock}`,
          );
          throw new BadRequestException(
            `Stock insuficiente para ${item.variant.product.name}. Disponible: ${item.variant.stock}`,
          );
        }

        const itemSubtotal = Number(item.variant.price) * item.quantity;
        subtotal += itemSubtotal;
      }

      const total = subtotal;

      const order = await this.prisma.order.create({
        data: {
          userId,
          addressId: dto.addressId,
          subtotal,
          total,
          status: OrderStatus.PENDING_PAYMENT,
          paymentMethod: dto.paymentMethod,
          customerNotes: dto.customerNotes,
          items: {
            create: cart.items.map((item) => ({
              variantId: item.variantId,
              productName: item.variant.product.name,
              variantSize: item.variant.size,
              variantColor: item.variant.color,
              variantGender: item.variant.gender,
              price: item.variant.price,
              quantity: item.quantity,
              subtotal: Number(item.variant.price) * item.quantity,
            })),
          },
        },
        include: {
          items: {
            include: {
              variant: true,
            },
          },
          address: true,
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              phone: true,
            },
          },
        },
      });

      this.logger.log(
        `Orden ${order.id} creada exitosamente - Total: $${total} - Items: ${cart.items.length}`,
      );

      this.eventEmitter.emit(
        OrderCreatedEvent.EVENT,
        new OrderCreatedEvent(order.id, userId, total),
      );

      for (const item of cart.items) {
        await this.prisma.productVariant.update({
          where: { id: item.variantId },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });

        const updatedVariant = await this.prisma.productVariant.findUnique({
          where: { id: item.variantId },
        });

        if (updatedVariant && updatedVariant.stock === 0) {
          this.logger.warn(
            `Variante ${item.variantId} agotada - Desactivando producto`,
          );
          await this.prisma.productVariant.update({
            where: { id: item.variantId },
            data: { isActive: false },
          });
        }
      }

      await this.prisma.cartItem.deleteMany({
        where: { cartId: cart.id },
      });

      this.logger.log(`Carrito ${cart.id} vaciado exitosamente`);

      await this.mailService.sendOrderCreatedEmail(
        order.user.email,
        order.user.name || 'Cliente',
        order.id,
        Number(order.total),
      );

      this.logger.log(
        `Email de confirmación enviado a ${order.user.email} para orden ${order.id}`,
      );

      return order;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(
        `Error creando orden para usuario ${userId}`,
        err.stack,
        {
          userId,
          addressId: dto.addressId,
          paymentMethod: dto.paymentMethod,
        },
      );
      throw error;
    }
  }

  async getUserOrders(userId: string, query: QueryOrdersDto) {
    this.logger.log(`Consultando órdenes de usuario ${userId}`);

    try {
      const { status, page = 1, limit = 10 } = query;

      const where: {
        userId: string;
        status?: OrderStatus;
      } = { userId };

      if (status) {
        where.status = status;
      }

      const [orders, total] = await Promise.all([
        this.prisma.order.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            items: {
              include: {
                variant: true,
              },
            },
            address: true,
          },
        }),
        this.prisma.order.count({ where }),
      ]);

      this.logger.log(
        `Usuario ${userId} - ${total} órdenes encontradas (página ${page})`,
      );

      return {
        data: orders,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(
        `Error consultando órdenes de usuario ${userId}`,
        err.stack,
        {
          userId,
        },
      );
      throw error;
    }
  }

  async getOrderById(orderId: string, userId: string, userRole: Role) {
    this.logger.log(`Usuario ${userId} consultando orden ${orderId}`);

    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              variant: {
                include: {
                  product: true,
                },
              },
            },
          },
          address: true,
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              phone: true,
            },
          },
        },
      });

      if (!order) {
        this.logger.warn(`Orden ${orderId} no encontrada`);
        throw new NotFoundException('Orden no encontrada');
      }

      if (order.userId !== userId && userRole === Role.USER) {
        this.logger.warn(
          `Usuario ${userId} intentó acceder a orden ${orderId} sin permisos`,
        );
        throw new ForbiddenException('No tienes permiso para ver esta orden');
      }

      this.logger.log(`Orden ${orderId} consultada exitosamente`);

      return order;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(`Error consultando orden ${orderId}`, err.stack, {
        orderId,
        userId,
        userRole,
      });
      throw error;
    }
  }

  async updateOrderStatus(
    orderId: string,
    dto: UpdateOrderStatusDto,
    userRole: Role,
  ) {
    this.logger.log(
      `Actualizando estado de orden ${orderId} a ${dto.status} (rol: ${userRole})`,
    );

    try {
      if (userRole === Role.USER) {
        this.logger.warn(
          `Usuario con rol USER intentó actualizar orden ${orderId}`,
        );
        throw new ForbiddenException(
          'No tienes permiso para actualizar órdenes',
        );
      }

      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        this.logger.warn(`Orden ${orderId} no encontrada para actualización`);
        throw new NotFoundException('Orden no encontrada');
      }

      const updateData: {
        status: OrderStatus;
        adminNotes?: string;
        paidAt?: Date;
        shippedAt?: Date;
        deliveredAt?: Date;
        cancelledAt?: Date;
      } = {
        status: dto.status,
        adminNotes: dto.adminNotes,
      };

      const now = new Date();

      switch (dto.status) {
        case OrderStatus.PAGO_CONFIRMADO:
          updateData.paidAt = now;
          break;
        case OrderStatus.EN_CAMINO:
          updateData.shippedAt = now;
          break;
        case OrderStatus.ENTREGADO:
          updateData.deliveredAt = now;
          break;
        case OrderStatus.CANCELADO:
          updateData.cancelledAt = now;
          if (order.status !== OrderStatus.CANCELADO) {
            const orderWithItems = await this.prisma.order.findUnique({
              where: { id: orderId },
              include: { items: true },
            });
            if (orderWithItems) {
              for (const item of orderWithItems.items) {
                await this.prisma.productVariant.update({
                  where: { id: item.variantId },
                  data: {
                    stock: { increment: item.quantity },
                    isActive: true,
                  },
                });
              }
              this.logger.log(
                `Stock restaurado para ${orderWithItems.items.length} items de orden ${orderId}`,
              );
            }
          }
          break;
      }

      const updatedOrder = await this.prisma.order.update({
        where: { id: orderId },
        data: updateData,
        include: {
          items: {
            include: {
              variant: true,
            },
          },
          address: true,
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              phone: true,
            },
          },
        },
      });

      this.logger.log(
        `Orden ${orderId} actualizada exitosamente a estado ${dto.status}`,
      );

      this.eventEmitter.emit(
        OrderStatusUpdatedEvent.EVENT,
        new OrderStatusUpdatedEvent(orderId, order.status, dto.status),
      );

      if (
        dto.status === OrderStatus.PAGO_CONFIRMADO ||
        dto.status === OrderStatus.EN_CAMINO ||
        dto.status === OrderStatus.ENTREGADO
      ) {
        await this.mailService.sendOrderStatusEmail(
          updatedOrder.user.email,
          updatedOrder.user.name || 'Cliente',
          updatedOrder.id,
          dto.status,
        );

        this.logger.log(
          `Email de actualización enviado a ${updatedOrder.user.email} para orden ${orderId}`,
        );
      }

      return updatedOrder;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(`Error actualizando orden ${orderId}`, err.stack, {
        orderId,
        newStatus: dto.status,
        userRole,
      });
      throw error;
    }
  }

  async getAllOrders(query: QueryOrdersDto, userRole: Role) {
    this.logger.log(`Consultando todas las órdenes (rol: ${userRole})`);

    try {
      if (userRole === Role.USER) {
        this.logger.warn('Usuario con rol USER intentó ver todas las órdenes');
        throw new ForbiddenException(
          'No tienes permiso para ver todas las órdenes',
        );
      }

      const { status, page = 1, limit = 10 } = query;

      const where: {
        status?: OrderStatus;
      } = {};

      if (status) {
        where.status = status;
      }

      const [orders, total] = await Promise.all([
        this.prisma.order.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            items: {
              include: {
                variant: true,
              },
            },
            address: true,
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                phone: true,
              },
            },
          },
        }),
        this.prisma.order.count({ where }),
      ]);

      this.logger.log(
        `Admin consultó ${total} órdenes totales (página ${page})`,
      );

      return {
        data: orders,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error('Error consultando todas las órdenes', err.stack, {
        userRole,
        errorMessage: err.message,
      });
      throw error;
    }
  }

  async updateOrderItem(
    orderId: string,
    itemId: string,
    dto: UpdateOrderItemDto,
    userRole: Role,
  ) {
    this.logger.log(
      `Actualizando item ${itemId} de orden ${orderId} (rol: ${userRole})`,
    );

    try {
      if (userRole !== Role.SUPER_ADMIN) {
        throw new ForbiddenException(
          'Solo SUPER_ADMIN puede editar items de órdenes',
        );
      }

      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!order) throw new NotFoundException('Orden no encontrada');

      const item = order.items.find((i) => i.id === itemId);
      if (!item) throw new NotFoundException('Item no encontrado en la orden');

      const newVariant = await this.prisma.productVariant.findUnique({
        where: { id: dto.variantId },
      });

      if (!newVariant) throw new NotFoundException('Variante no encontrada');

      if (newVariant.stock < item.quantity && newVariant.id !== item.variantId) {
        throw new BadRequestException(
          `Stock insuficiente para la variante seleccionada. Disponible: ${newVariant.stock}`,
        );
      }

      if (item.variantId !== dto.variantId) {
        await this.prisma.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity }, isActive: true },
        });

        await this.prisma.productVariant.update({
          where: { id: dto.variantId },
          data: { stock: { decrement: item.quantity } },
        });

        const updated = await this.prisma.productVariant.findUnique({
          where: { id: dto.variantId },
        });
        if (updated && updated.stock === 0) {
          await this.prisma.productVariant.update({
            where: { id: dto.variantId },
            data: { isActive: false },
          });
        }
      }

      const newItemSubtotal = Number(newVariant.price) * item.quantity;

      await this.prisma.orderItem.update({
        where: { id: itemId },
        data: {
          variantId: dto.variantId,
          variantSize: newVariant.size,
          variantColor: newVariant.color,
          variantGender: newVariant.gender,
          price: newVariant.price,
          subtotal: newItemSubtotal,
        },
      });

      const allItems = await this.prisma.orderItem.findMany({
        where: { orderId },
      });
      const newSubtotal = allItems.reduce(
        (sum, i) => sum + Number(i.subtotal),
        0,
      );

      const updatedOrder = await this.prisma.order.update({
        where: { id: orderId },
        data: { subtotal: newSubtotal, total: newSubtotal },
        include: {
          items: {
            include: { variant: { include: { product: true } } },
          },
          address: true,
          user: {
            select: { id: true, email: true, name: true, phone: true },
          },
        },
      });

      this.logger.log(
        `Item ${itemId} actualizado exitosamente en orden ${orderId}`,
      );

      return updatedOrder;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(
        `Error actualizando item ${itemId} de orden ${orderId}`,
        err.stack,
      );
      throw error;
    }
  }

  async updatePaymentProof(
    orderId: string,
    userId: string,
    paymentProofUrl: string,
  ) {
    this.logger.log(
      `Usuario ${userId} subiendo comprobante para orden ${orderId}`,
    );

    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        this.logger.warn(
          `Orden ${orderId} no encontrada para subir comprobante`,
        );
        throw new NotFoundException('Orden no encontrada');
      }

      if (order.userId !== userId) {
        this.logger.warn(
          `Usuario ${userId} intentó subir comprobante a orden ${orderId} que no le pertenece`,
        );
        throw new ForbiddenException(
          'No tienes permiso para actualizar esta orden',
        );
      }

      if (order.status !== OrderStatus.PENDING_PAYMENT) {
        this.logger.warn(
          `Intento de subir comprobante a orden ${orderId} con estado ${order.status}`,
        );
        throw new BadRequestException(
          'Solo puedes subir comprobante si el pago está pendiente',
        );
      }

      const updatedOrder = await this.prisma.order.update({
        where: { id: orderId },
        data: { paymentProof: paymentProofUrl },
        include: {
          items: {
            include: {
              variant: true,
            },
          },
          address: true,
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              phone: true,
            },
          },
        },
      });

      this.logger.log(
        `Comprobante subido exitosamente para orden ${orderId} - URL: ${paymentProofUrl}`,
      );

      return updatedOrder;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(
        `Error subiendo comprobante para orden ${orderId}`,
        err.stack,
        {
          orderId,
          userId,
          paymentProofUrl,
        },
      );
      throw error;
    }
  }
}
