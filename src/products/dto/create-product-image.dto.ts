import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsUrl,
  IsOptional,
} from 'class-validator';

/**
 * DTO para agregar una imagen a un producto
 */
export class CreateProductImageDto {
  /**
   * UUID del producto
   * @example "550e8400-e29b-41d4-a716-446655440000"
   */
  @IsUUID('4', { message: 'productId debe ser un UUID válido' })
  @IsNotEmpty({ message: 'productId es obligatorio' })
  productId: string;

  /**
   * UUID de la variante (opcional)
   * Si se omite, la imagen es general del producto
   * @example "550e8400-e29b-41d4-a716-446655440001"
   */
  @IsOptional()
  @IsUUID('4', { message: 'variantId debe ser un UUID válido' })
  variantId?: string | null;

  /**
   * URL de la imagen (Cloudinary)
   * @example "https://res.cloudinary.com/delcarajo/image/upload/v1234567890/products/goyo-classic.jpg"
   */
  @IsUrl({}, { message: 'url debe ser una URL válida' })
  @IsNotEmpty({ message: 'url es obligatoria' })
  url: string;

  /**
   * Public ID de Cloudinary (para eliminación)
   * @example "delcarajo/products/goyo-classic"
   */
  @IsString({ message: 'publicId debe ser un texto' })
  @IsNotEmpty({ message: 'publicId es obligatorio' })
  publicId: string;

  /**
   * Texto alternativo para SEO y accesibilidad
   * @example "Franela Goyo Classic color negro talla M"
   */
  @IsString({ message: 'alt debe ser un texto' })
  @IsNotEmpty({ message: 'alt es obligatorio' })
  alt: string;

  /**
   * Orden de visualización (0 = portada, 1-4 = galería)
   * @example 0
   */
  @IsInt({ message: 'order debe ser un número entero' })
  @Min(0, { message: 'order debe ser mayor o igual a 0' })
  @Max(4, { message: 'order no puede ser mayor a 4' })
  @IsNotEmpty({ message: 'order es obligatorio' })
  order: number;
}
