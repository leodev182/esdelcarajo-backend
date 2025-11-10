import { IsUUID, IsInt, Min, IsNotEmpty } from 'class-validator';

/**
 * DTO para agregar un producto al carrito
 */
export class AddToCartDto {
  /**
   * UUID de la variante del producto
   * @example "550e8400-e29b-41d4-a716-446655440000"
   */
  @IsUUID('4', { message: 'variantId debe ser un UUID válido' })
  @IsNotEmpty({ message: 'variantId es obligatorio' })
  variantId: string;

  /**
   * Cantidad de unidades a agregar
   * @example 2
   */
  @IsInt({ message: 'quantity debe ser un número entero' })
  @Min(1, { message: 'quantity debe ser al menos 1' })
  @IsNotEmpty({ message: 'quantity es obligatorio' })
  quantity: number;
}
