import {
  IsUUID,
  IsEnum,
  IsString,
  IsOptional,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';

/**
 * DTO para crear una nueva orden desde el carrito
 */
export class CreateOrderDto {
  /**
   * UUID de la dirección de entrega
   * @example "550e8400-e29b-41d4-a716-446655440000"
   */
  @IsUUID('4', { message: 'addressId debe ser un UUID válido' })
  @IsNotEmpty({ message: 'addressId es obligatorio' })
  addressId: string;

  /**
   * Método de pago seleccionado
   * @example "PAGO_MOVIL"
   */
  @IsEnum(PaymentMethod, { message: 'paymentMethod debe ser un método válido' })
  @IsNotEmpty({ message: 'paymentMethod es obligatorio' })
  paymentMethod: PaymentMethod;

  /**
   * Notas adicionales del cliente (opcional)
   * @example "Por favor llamar antes de llegar"
   */
  @IsString({ message: 'customerNotes debe ser un texto' })
  @IsOptional()
  @MaxLength(500, { message: 'customerNotes no puede exceder 500 caracteres' })
  customerNotes?: string;
}
