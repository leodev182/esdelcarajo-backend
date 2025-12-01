import { ApiProperty } from '@nestjs/swagger';

export class BcvRateDto {
  @ApiProperty({
    description: 'Tasa de cambio USD a VES del BCV',
    example: 102.5,
  })
  rate: number;

  @ApiProperty({
    description: 'Fecha de la última actualización',
    example: '2024-12-01T10:30:00Z',
  })
  lastUpdate: Date;

  @ApiProperty({
    description: 'Fuente de la tasa',
    example: 'Banco Central de Venezuela',
  })
  source: string;
}
