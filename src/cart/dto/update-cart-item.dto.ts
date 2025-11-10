import { IsInt, Min, IsNotEmpty } from 'class-validator';

/**
 * DTO para actualizar la cantidad de un item del carrito
 */
export class UpdateCartItemDto {
  /**
   * Nueva cantidad de unidades
   * @example 5
   */
  @IsInt({ message: 'quantity debe ser un número entero' })
  @Min(1, { message: 'quantity debe ser al menos 1' })
  @IsNotEmpty({ message: 'quantity es obligatorio' })
  quantity: number;
}
