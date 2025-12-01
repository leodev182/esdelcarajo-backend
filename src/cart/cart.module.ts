import { Module } from '@nestjs/common';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CartCleanupTask } from './tasks/cart-cleanup.task';

@Module({
  imports: [PrismaModule],
  controllers: [CartController],
  providers: [CartService, CartCleanupTask],
  exports: [CartService],
})
export class CartModule {}
