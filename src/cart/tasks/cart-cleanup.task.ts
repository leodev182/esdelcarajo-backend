import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CartCleanupTask {
  private readonly logger = new Logger(CartCleanupTask.name);

  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupExpiredCartItems() {
    this.logger.log('Iniciando limpieza de items de carrito expirados...');

    try {
      const now = new Date();

      const result = await this.prisma.cartItem.deleteMany({
        where: {
          expiresAt: {
            lt: now,
          },
        },
      });

      this.logger.log(`Limpieza completada: ${result.count} items eliminados`);

      return {
        success: true,
        deletedCount: result.count,
        timestamp: now,
      };
    } catch (error) {
      this.logger.error('Error en limpieza de carritos:', error);
      throw error;
    }
  }

  @Cron(CronExpression.EVERY_WEEK)
  async cleanupEmptyCarts() {
    this.logger.log('Iniciando limpieza de carritos vacíos...');

    try {
      const cartsWithoutItems = await this.prisma.cart.findMany({
        where: {
          items: {
            none: {},
          },
        },
        select: {
          id: true,
        },
      });

      const cartIds = cartsWithoutItems.map((cart) => cart.id);

      const result = await this.prisma.cart.deleteMany({
        where: {
          id: {
            in: cartIds,
          },
        },
      });

      this.logger.log(
        `Limpieza de carritos vacíos completada: ${result.count} carritos eliminados`,
      );

      return {
        success: true,
        deletedCount: result.count,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('Error en limpieza de carritos vacíos:', error);
      throw error;
    }
  }
}
