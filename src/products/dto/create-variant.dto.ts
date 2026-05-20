import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsEnum,
  IsInt,
  IsNumber,
  Min,
  IsOptional,
  IsHexColor,
  Matches,
} from 'class-validator';
import { Gender, Size } from '@prisma/client';

/**
 * DTO para crear una nueva variante de producto
 */
export class CreateVariantDto {
  /**
   * UUID del producto padre
   * @example "550e8400-e29b-41d4-a716-446655440000"
   */
  @IsUUID('4', { message: 'productId debe ser un UUID válido' })
  @IsNotEmpty({ message: 'productId es obligatorio' })
  productId: string;

  /**
   * Género de la variante
   * @example "MEN"
   */
  @IsEnum(Gender, { message: 'gender debe ser MEN, WOMEN o KIDS' })
  @IsNotEmpty({ message: 'gender es obligatorio' })
  gender: Gender;

  /**
   * Talla de la variante
   * @example "M"
   */
  @IsEnum(Size, { message: 'size debe ser S, M, L, XL, XXL o XXXL' })
  @IsNotEmpty({ message: 'size es obligatorio' })
  size: Size;

  /**
   * Color de la variante
   * @example "Negro"
   */
  @IsString({ message: 'El color debe ser un texto' })
  @IsNotEmpty({ message: 'El color es obligatorio' })
  color: string;

  /**
   * Código hexadecimal del color (opcional)
   * @example "#000000"
   */
  @IsHexColor({ message: 'colorHex debe ser un hexadecimal válido' })
  @IsOptional()
  colorHex?: string;

  @IsString({ message: 'El color de franela debe ser un texto' })
  @IsOptional()
  shirtColor?: string;

  /**
   * SKU único de la variante
   * @example "GOYO-MEN-M-NEG"
   */
  @IsString({ message: 'El SKU debe ser un texto' })
  @IsNotEmpty({ message: 'El SKU es obligatorio' })
  @Matches(/^[A-Z0-9-]+$/, {
    message: 'El SKU solo puede contener letras mayúsculas, números y guiones',
  })
  sku: string;

  /**
   * Stock disponible
   * @example 50
   */
  @IsInt({ message: 'El stock debe ser un número entero' })
  @Min(0, { message: 'El stock no puede ser negativo' })
  @IsNotEmpty({ message: 'El stock es obligatorio' })
  stock: number;

  /**
   * Precio en USD con hasta 2 decimales
   * @example 12.99
   */
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El precio debe ser un número válido (máx 2 decimales)' })
  @Min(0, { message: 'El precio no puede ser negativo' })
  @IsNotEmpty({ message: 'El precio es obligatorio' })
  price: number;

  /**
   * Descripción corta específica de esta variante (max 300 palabras)
   * @example "Franela Goyo en color Azul, perfecta para el día a día..."
   */
  @IsString({ message: 'La descripción corta debe ser un texto' })
  @IsOptional()
  shortDescription?: string;

  /**
   * Características en formato JSON para lista con viñetas
   * @example '{"material":"100% Algodón Premium","corte":"Regular Fit","cuello":"Redondo"}'
   */
  @IsString({ message: 'Las características deben ser un texto' })
  @IsOptional()
  features?: string;
}
