import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { OrderStatus, Role } from '@prisma/client';

/**
 * Servicio para gestionar órdenes de compra
 * - Crea órdenes desde el carrito
 * - Guarda snapshots de productos (precio al momento de compra)
 * - Maneja estados de pedido con timestamps
 * - Vacía el carrito después de crear orden
 */
@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Crear una nueva orden desde el carrito del usuario
   * - Valida que el carrito tenga items
   * - Valida que la dirección pertenezca al usuario
   * - Crea snapshots de productos (precio, nombre al momento de compra)
   * - Calcula totales
   * - Vacía el carrito
   */
  async createOrder(userId: string, dto: CreateOrderDto) {
    // 1. Obtener carrito del usuario con items
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

    // 2. Validar que la dirección pertenece al usuario
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

    // 3. Calcular totales y validar stock
    let subtotal = 0;

    for (const item of cart.items) {
      // Validar que el producto y variante sigan activos
      if (!item.variant.isActive || !item.variant.product.isActive) {
        throw new BadRequestException(
          `El producto ${item.variant.product.name} ya no está disponible`,
        );
      }

      // Validar stock disponible
      if (item.variant.stock < item.quantity) {
        throw new BadRequestException(
          `Stock insuficiente para ${item.variant.product.name}. Disponible: ${item.variant.stock}`,
        );
      }

      const itemSubtotal = Number(item.variant.price) * item.quantity;
      subtotal += itemSubtotal;
    }

    const total = subtotal; // Sin envío, se acuerda por WhatsApp

    // 4. Crear la orden con snapshots de productos
    const order = await this.prisma.order.create({
      data: {
        userId,
        addressId: dto.addressId,
        subtotal,
        total,
        status: OrderStatus.PENDING_PAYMENT,
        paymentMethod: dto.paymentMethod,
        customerNotes: dto.customerNotes,
        // Crear OrderItems con snapshots
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

    // 5. Reducir stock de las variantes
    for (const item of cart.items) {
      await this.prisma.productVariant.update({
        where: { id: item.variantId },
        data: {
          stock: {
            decrement: item.quantity,
          },
        },
      });

      // Si el stock llega a 0, desactivar la variante
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

    // 6. Vaciar el carrito (hard delete de items)
    await this.prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    return order;
  }

  /**
   * Obtener órdenes del usuario autenticado
   * Con filtros y paginación
   */
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

  /**
   * Obtener una orden específica
   * Solo el dueño o ADMIN puede verla
   */
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

    // Validar permisos: solo el dueño o admin pueden ver
    if (order.userId !== userId && userRole === Role.USER) {
      throw new ForbiddenException('No tienes permiso para ver esta orden');
    }

    return order;
  }

  /**
   * Actualizar estado de una orden (solo ADMIN/SUPER_ADMIN)
   * Actualiza timestamps según el nuevo estado
   */
  async updateOrderStatus(
    orderId: string,
    dto: UpdateOrderStatusDto,
    userRole: Role,
  ) {
    // Validar permisos
    if (userRole === Role.USER) {
      throw new ForbiddenException('No tienes permiso para actualizar órdenes');
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Orden no encontrada');
    }

    // Preparar datos de actualización
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

    // Actualizar timestamps según el estado
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

    return this.prisma.order.update({
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
  }

  /**
   * Obtener todas las órdenes (solo ADMIN)
   * Con filtros y paginación
   */
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
}
