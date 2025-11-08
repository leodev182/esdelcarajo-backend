import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsHexColor,
  IsInt,
  Min,
} from 'class-validator';

/**
 * DTO para crear una nueva categoría
 */
export class CreateCategoryDto {
  /**
   * Nombre de la categoría
   * @example "Carajos"
   */
  @IsString({ message: 'El nombre debe ser un texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  name: string;

  /**
   * Descripción de la categoría
   * @example "Ropa urbana para hombres"
   */
  @IsString({ message: 'La descripción debe ser un texto' })
  @IsOptional()
  description?: string;

  /**
   * Color en formato hexadecimal
   * @example "#FF6501"
   */
  @IsHexColor({
    message: 'El color debe ser un hexadecimal válido (ejemplo: #FF6501)',
  })
  @IsNotEmpty({ message: 'El color es obligatorio' })
  color: string;

  /**
   * Identificador del icono para UI
   * @example "shirt"
   */
  @IsString({ message: 'El icono debe ser un texto' })
  @IsOptional()
  icon?: string;

  /**
   * Orden de visualización en el menú
   * @example 1
   */
  @IsInt({ message: 'El orden debe ser un número entero' })
  @Min(0, { message: 'El orden debe ser mayor o igual a 0' })
  @IsOptional()
  order?: number;
}
