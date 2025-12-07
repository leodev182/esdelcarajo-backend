import { Module } from '@nestjs/common';
import { LandingService } from './landing.service';
import { LandingController } from './landing.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [LandingController],
  providers: [LandingService],
  exports: [LandingService],
})
export class LandingModule {}
