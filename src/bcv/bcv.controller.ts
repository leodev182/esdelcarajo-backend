import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BcvService } from './bcv.service';
import { BcvRateDto } from './dto/bcv-rate.dto';

@ApiTags('BCV')
@Controller('bcv')
export class BcvController {
  constructor(private readonly bcvService: BcvService) {}

  @Get('rate')
  @ApiOperation({
    summary: 'Obtener tasa de cambio BCV (EUR a VES)',
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
}
