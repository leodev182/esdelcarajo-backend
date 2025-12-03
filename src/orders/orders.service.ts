import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { OrderStatus, Role } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  async createOrder(userId: string, dto: CreateOrderDto) {
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
      throw new NotFoundException(
        'Dirección no encontrada o no pertenece al usuario',
      );
    }

    let subtotal = 0;

    for (const item of cart.items) {
      if (!item.variant.isActive || !item.variant.product.isActive) {
        throw new BadRequestException(
          `El producto ${item.variant.product.name} ya no está disponible`,
        );
      }

      if (item.variant.stock < item.quantity) {
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
        await this.prisma.productVariant.update({
          where: { id: item.variantId },
          data: { isActive: false },
        });
      }
    }

    await this.prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    await this.mailService.sendOrderCreatedEmail(
      order.user.email,
      order.user.name || 'Cliente',
      order.id,
      Number(order.total),
    );

    return order;
  }

  async getUserOrders(userId: string, query: QueryOrdersDto) {
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

    return {
      data: orders,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getOrderById(orderId: string, userId: string, userRole: Role) {
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
      throw new NotFoundException('Orden no encontrada');
    }

    if (order.userId !== userId && userRole === Role.USER) {
      throw new ForbiddenException('No tienes permiso para ver esta orden');
    }

    return order;
  }

  async updateOrderStatus(
    orderId: string,
    dto: UpdateOrderStatusDto,
    userRole: Role,
  ) {
    if (userRole === Role.USER) {
      throw new ForbiddenException('No tienes permiso para actualizar órdenes');
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
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
    }

    return updatedOrder;
  }

  async getAllOrders(query: QueryOrdersDto, userRole: Role) {
    if (userRole === Role.USER) {
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

    return {
      data: orders,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updatePaymentProof(
    orderId: string,
    userId: string,
    paymentProofUrl: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Orden no encontrada');
    }

    if (order.userId !== userId) {
      throw new ForbiddenException(
        'No tienes permiso para actualizar esta orden',
      );
    }

    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new BadRequestException(
        'Solo puedes subir comprobante si el pago está pendiente',
      );
    }

    return this.prisma.order.update({
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
  }
}
