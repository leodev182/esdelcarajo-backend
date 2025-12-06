import { Module } from '@nestjs/common';
import { BcvService } from './bcv.service';
import { BcvController } from './bcv.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BcvController],
  providers: [BcvService],
  exports: [BcvService],
})
export class BcvModule {}
