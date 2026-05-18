import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtener estadísticas generales del dashboard
   */
  async getDashboardStats() {
    this.logger.log('Consultando estadísticas del dashboard');

    try {
      const [totalProducts, activeProducts] = await Promise.all([
        this.prisma.product.count(),
        this.prisma.product.count({ where: { isActive: true } }),
      ]);

      const [totalUsers, adminUsers, superAdminUsers] = await Promise.all([
        this.prisma.user.count({ where: { isActive: true } }),
        this.prisma.user.count({ where: { role: 'ADMIN', isActive: true } }),
        this.prisma.user.count({
          where: { role: 'SUPER_ADMIN', isActive: true },
        }),
      ]);

      const orderCountsByStatus = await this.prisma.order.groupBy({
        by: ['status'],
        _count: { id: true },
      });

      const countByStatus = (status: string): number =>
        orderCountsByStatus.find((r) => r.status === status)?._count.id ?? 0;

      const pendingPayment = countByStatus('PENDING_PAYMENT');
      const confirmedPayment = countByStatus('PAGO_CONFIRMADO');
      const inTransit = countByStatus('EN_CAMINO');
      const delivered = countByStatus('ENTREGADO');
      const cancelled = countByStatus('CANCELADO');
      const totalOrders = orderCountsByStatus.reduce(
        (sum, r) => sum + r._count.id,
        0,
      );

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

      this.logger.log(
        `Estadísticas calculadas - Productos: ${totalProducts}, Órdenes: ${totalOrders}, Ventas: €${Number(totalSales)}`,
      );

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
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(
        'Error consultando estadísticas del dashboard',
        err.stack,
      );
      throw error;
    }
  }

  /**
   * Obtener órdenes recientes
   */
  async getRecentOrders(limit: number = 10) {
    this.logger.log(`Consultando ${limit} órdenes recientes`);

    try {
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

      this.logger.log(`${orders.length} órdenes recientes obtenidas`);

      return {
        total: orders.length,
        orders,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error('Error consultando órdenes recientes', err.stack);
      throw error;
    }
  }

  /**
   * Listar todas las órdenes con filtros y paginación
   */
  async getAllOrders(queryOrdersDto: QueryOrdersDto) {
    this.logger.log(
      `Consultando órdenes - Página: ${queryOrdersDto.page || 1}, Estado: ${queryOrdersDto.status || 'todos'}`,
    );

    try {
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

      this.logger.log(
        `${total} órdenes encontradas - Página ${page}/${Math.ceil(total / limit)}`,
      );

      return {
        orders,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error('Error consultando órdenes', err.stack);
      throw error;
    }
  }

  /**
   * Obtener detalle de una orden
   */
  async getOrderById(orderId: string) {
    this.logger.log(`Consultando orden ${orderId}`);

    try {
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
        this.logger.warn(`Orden ${orderId} no encontrada`);
        throw new NotFoundException(`Orden con ID ${orderId} no encontrada`);
      }

      this.logger.log(`Orden ${orderId} consultada exitosamente`);

      return order;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(`Error consultando orden ${orderId}`, err.stack, {
        orderId,
      });
      throw error;
    }
  }

  /**
   * Aprobar pago de una orden
   */
  async approvePayment(orderId: string) {
    this.logger.log(`Aprobando pago de orden ${orderId}`);

    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        this.logger.warn(`Orden ${orderId} no encontrada para aprobar pago`);
        throw new NotFoundException(`Orden con ID ${orderId} no encontrada`);
      }

      if (order.status !== 'PENDING_PAYMENT') {
        this.logger.warn(
          `Intento de aprobar pago de orden ${orderId} con estado ${order.status}`,
        );
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

      this.logger.log(`Pago aprobado exitosamente para orden ${orderId}`);

      return {
        message: 'Pago aprobado exitosamente',
        order: updatedOrder,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(`Error aprobando pago de orden ${orderId}`, err.stack, {
        orderId,
      });
      throw error;
    }
  }

  /**
   * Cambiar estado de una orden
   */
  async updateOrderStatus(orderId: string, newStatus: OrderStatus) {
    this.logger.log(`Actualizando estado de orden ${orderId} a ${newStatus}`);

    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        this.logger.warn(`Orden ${orderId} no encontrada para cambiar estado`);
        throw new NotFoundException(`Orden con ID ${orderId} no encontrada`);
      }

      if (order.status === 'CANCELADO') {
        this.logger.warn(`Intento de modificar orden cancelada ${orderId}`);
        throw new BadRequestException(
          'No se puede modificar una orden cancelada',
        );
      }

      if (newStatus === 'CANCELADO' && order.status === 'ENTREGADO') {
        this.logger.warn(`Intento de cancelar orden entregada ${orderId}`);
        throw new BadRequestException(
          'No se puede cancelar una orden entregada',
        );
      }

      const updateData: {
        status: OrderStatus;
        shippedAt?: Date;
        deliveredAt?: Date;
        cancelledAt?: Date;
      } = {
        status: newStatus,
      };

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

      this.logger.log(
        `Estado de orden ${orderId} actualizado exitosamente a ${newStatus}`,
      );

      return {
        message: `Estado de orden actualizado a ${newStatus}`,
        order: updatedOrder,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(
        `Error actualizando estado de orden ${orderId}`,
        err.stack,
        { orderId, newStatus },
      );
      throw error;
    }
  }
}
