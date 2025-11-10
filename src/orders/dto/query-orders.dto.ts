import { IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus } from '@prisma/client';

/**
 * DTO para consultar y filtrar órdenes
 * Usado en GET /orders con query params
 */
export class QueryOrdersDto {
  /**
   * Filtrar por estado de la orden
   * @example "PAGO_CONFIRMADO"
   */
  @IsEnum(OrderStatus, { message: 'status debe ser un estado válido' })
  @IsOptional()
  status?: OrderStatus;

  /**
   * Número de página (para paginación)
   * @example 1
   */
  @Type(() => Number)
  @IsInt({ message: 'page debe ser un número entero' })
  @Min(1, { message: 'page debe ser al menos 1' })
  @IsOptional()
  page?: number = 1;

  /**
   * Cantidad de resultados por página
   * @example 10
   */
  @Type(() => Number)
  @IsInt({ message: 'limit debe ser un número entero' })
  @Min(1, { message: 'limit debe ser al menos 1' })
  @Max(50, { message: 'limit no puede ser mayor a 50' })
  @IsOptional()
  limit?: number = 10;
}
