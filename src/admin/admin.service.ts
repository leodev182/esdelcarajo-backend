import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ==================== DASHBOARD ====================

  /**
   * Obtener estadísticas generales del dashboard
   */
  async getDashboardStats() {
    // Contar productos
    const [totalProducts, activeProducts] = await Promise.all([
      this.prisma.product.count(),
      this.prisma.product.count({ where: { isActive: true } }),
    ]);

    // Contar usuarios por rol
    const [totalUsers, adminUsers, superAdminUsers] = await Promise.all([
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.user.count({ where: { role: 'ADMIN', isActive: true } }),
      this.prisma.user.count({
        where: { role: 'SUPER_ADMIN', isActive: true },
      }),
    ]);

    // Contar órdenes por estado
    const [
      totalOrders,
      pendingPayment,
      confirmedPayment,
      inTransit,
      delivered,
      cancelled,
    ] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.order.count({ where: { status: 'PENDING_PAYMENT' } }),
      this.prisma.order.count({ where: { status: 'PAGO_CONFIRMADO' } }),
      this.prisma.order.count({ where: { status: 'EN_CAMINO' } }),
      this.prisma.order.count({ where: { status: 'ENTREGADO' } }),
      this.prisma.order.count({ where: { status: 'CANCELADO' } }),
    ]);

    // Calcular ventas totales (solo órdenes con pago confirmado o entregadas)
    const salesAggregate = await this.prisma.order.aggregate({
      where: {
        status: {
          in: ['PAGO_CONFIRMADO', 'EN_CAMINO', 'ENTREGADO'],
        },
      },
      _sum: {
        total: true,
      },
    });

    const totalSales = salesAggregate._sum.total || 0;

    return {
      products: {
        total: totalProducts,
        active: activeProducts,
        inactive: totalProducts - activeProducts,
      },
      users: {
        total: totalUsers,
        admins: adminUsers,
        superAdmins: superAdminUsers,
        regular: totalUsers - adminUsers - superAdminUsers,
      },
      orders: {
        total: totalOrders,
        pendingPayment,
        confirmedPayment,
        inTransit,
        delivered,
        cancelled,
      },
      sales: {
        total: totalSales,
      },
    };
  }

  /**
   * Obtener órdenes recientes
   */
  async getRecentOrders(limit: number = 10) {
    const orders = await this.prisma.order.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            nickname: true,
          },
        },
        items: {
          include: {
            variant: {
              include: {
                product: {
                  select: {
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return {
      total: orders.length,
      orders,
    };
  }

  // ==================== GESTIÓN DE ÓRDENES ====================

  /**
   * Listar todas las órdenes con filtros y paginación
   */
  async getAllOrders(queryOrdersDto: QueryOrdersDto) {
    const { status, page = 1, limit = 10 } = queryOrdersDto;

    const skip = (page - 1) * limit;

    const where = status ? { status } : {};

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              nickname: true,
            },
          },
          address: true,
          items: {
            include: {
              variant: {
                include: {
                  product: {
                    select: {
                      name: true,
                      slug: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      orders,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Obtener detalle de una orden
   */
  async getOrderById(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            nickname: true,
            phone: true,
          },
        },
        address: true,
        items: {
          include: {
            variant: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Orden con ID ${orderId} no encontrada`);
    }

    return order;
  }

  /**
   * Aprobar pago de una orden
   */
  async approvePayment(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Orden con ID ${orderId} no encontrada`);
    }

    if (order.status !== 'PENDING_PAYMENT') {
      throw new BadRequestException(
        'Solo se pueden aprobar órdenes pendientes de pago',
      );
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'PAGO_CONFIRMADO',
        paidAt: new Date(),
      },
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    return {
      message: 'Pago aprobado exitosamente',
      order: updatedOrder,
    };
  }

  /**
   * Cambiar estado de una orden
   */
  async updateOrderStatus(orderId: string, newStatus: OrderStatus) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Orden con ID ${orderId} no encontrada`);
    }

    // Validar transiciones de estado
    if (order.status === 'CANCELADO') {
      throw new BadRequestException(
        'No se puede modificar una orden cancelada',
      );
    }

    if (newStatus === 'CANCELADO' && order.status === 'ENTREGADO') {
      throw new BadRequestException('No se puede cancelar una orden entregada');
    }

    const updateData: {
      status: OrderStatus;
      shippedAt?: Date;
      deliveredAt?: Date;
      cancelledAt?: Date;
    } = {
      status: newStatus,
    };

    // Agregar timestamps según el estado
    if (newStatus === 'EN_CAMINO') {
      updateData.shippedAt = new Date();
    } else if (newStatus === 'ENTREGADO') {
      updateData.deliveredAt = new Date();
    } else if (newStatus === 'CANCELADO') {
      updateData.cancelledAt = new Date();
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: updateData,
    });

    return {
      message: `Estado de orden actualizado a ${newStatus}`,
      order: updatedOrder,
    };
  }

  // ==================== GESTIÓN DE USUARIOS ====================

  /**
   * Listar todos los usuarios
   */
  async getAllUsers() {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        nickname: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            orders: true,
            favorites: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      total: users.length,
      users,
    };
  }

  /**
   * Obtener detalle de un usuario
   */
  async getUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        nickname: true,
        avatar: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        addresses: true,
        orders: {
          select: {
            id: true,
            status: true,
            total: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        favorites: {
          select: {
            id: true,
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
    }

    return user;
  }

  /**
   * Cambiar rol de un usuario
   */
  async updateUserRole(userId: string, updateUserRoleDto: UpdateUserRoleDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { role: updateUserRoleDto.role },
      select: {
        id: true,
        email: true,
        name: true,
        nickname: true,
        role: true,
      },
    });

    return {
      message: 'Rol de usuario actualizado exitosamente',
      user: updatedUser,
    };
  }

  /**
   * Banear/desbanear usuario
   */
  async toggleUserBan(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: !user.isActive },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
      },
    });

    return {
      message: updatedUser.isActive
        ? 'Usuario desbaneado exitosamente'
        : 'Usuario baneado exitosamente',
      user: updatedUser,
    };
  }
}
