import {
  IsEnum,
  IsString,
  IsOptional,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';
import { OrderStatus } from '@prisma/client';

/**
 * DTO para actualizar el estado de una orden (solo ADMIN)
 */
export class UpdateOrderStatusDto {
  /**
   * Nuevo estado de la orden
   * @example "PAGO_CONFIRMADO"
   */
  @IsEnum(OrderStatus, { message: 'status debe ser un estado válido' })
  @IsNotEmpty({ message: 'status es obligatorio' })
  status: OrderStatus;

  /**
   * Notas del administrador (opcional)
   * @example "Pago verificado, procesando envío"
   */
  @IsString({ message: 'adminNotes debe ser un texto' })
  @IsOptional()
  @MaxLength(500, { message: 'adminNotes no puede exceder 500 caracteres' })
  adminNotes?: string;
}
