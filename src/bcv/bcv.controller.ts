import {
  Controller,
  Get,
  Post,
  Headers,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BcvService } from './bcv.service';
import { BcvRateDto } from './dto/bcv-rate.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('BCV')
@Controller('bcv')
export class BcvController {
  constructor(private readonly bcvService: BcvService) {}

  @Get('rate')
  @ApiOperation({
    summary: 'Obtener tasa de cambio BCV (USD a VES)',
    description:
      'Retorna la tasa de cambio actual del Banco Central de Venezuela. Cachea el resultado por 1 hora.',
  })
  @ApiResponse({
    status: 200,
    description: 'Tasa obtenida exitosamente',
    type: BcvRateDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Error al obtener la tasa',
  })
  async getBcvRate(): Promise<BcvRateDto> {
    return this.bcvService.getBcvRate();
  }

  @Post('refresh')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Forzar actualización de tasa BCV (Solo SUPER_ADMIN)' })
  @ApiResponse({ status: 200, description: 'Tasa actualizada exitosamente' })
  async forceRefresh(): Promise<BcvRateDto> {
    await this.bcvService.updateExchangeRates();
    return this.bcvService.getBcvRate();
  }

  @Post('force-update')
  @ApiOperation({ summary: 'Forzar actualización de tasa BCV con clave secreta' })
  @ApiResponse({ status: 200, description: 'Tasa actualizada exitosamente' })
  async forceUpdate(
    @Headers('x-bcv-secret') secret: string,
  ): Promise<BcvRateDto> {
    const expected = process.env.BCV_REFRESH_SECRET;
    if (!expected || secret !== expected) {
      throw new UnauthorizedException('Clave inválida');
    }
    await this.bcvService.updateExchangeRates();
    return this.bcvService.getBcvRate();
  }
}
