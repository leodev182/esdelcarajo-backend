import {
  IsOptional,
  IsUUID,
  IsEnum,
  IsString,
  IsBoolean,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Gender, Size } from '@prisma/client';

/**
 * DTO para consultar y filtrar productos
 * Usado en GET /products con query params
 */
export class QueryProductsDto {
  /**
   * Buscar por nombre o descripción
   * @example "franela"
   */
  @IsString({ message: 'search debe ser un texto' })
  @IsOptional()
  search?: string;

  /**
   * Filtrar por categoría
   * @example "1194ebe5-3d97-4c87-98ea-d82c6a740bd3"
   */
  @IsUUID('4', { message: 'categoryId debe ser un UUID válido' })
  @IsOptional()
  categoryId?: string;

  /**
   * Filtrar por subcategoría
   * @example "1f9c375a-eff8-413c-ab3a-899e90d7a897"
   */
  @IsUUID('4', { message: 'subcategoryId debe ser un UUID válido' })
  @IsOptional()
  subcategoryId?: string;

  /**
   * Filtrar por género
   * @example "MEN"
   */
  @IsEnum(Gender, { message: 'gender debe ser MEN, WOMEN o KIDS' })
  @IsOptional()
  gender?: Gender;

  /**
   * Filtrar por talla
   * @example "M"
   */
  @IsEnum(Size, { message: 'size debe ser S, M, L o XL' })
  @IsOptional()
  size?: Size;

  /**
   * Solo productos destacados
   * @example true
   */
  @IsBoolean({ message: 'isFeatured debe ser verdadero o falso' })
  @IsOptional()
  @Type(() => Boolean)
  isFeatured?: boolean;

  /**
   * Solo productos con stock disponible
   * @example true
   */
  @IsBoolean({ message: 'inStock debe ser verdadero o falso' })
  @IsOptional()
  @Type(() => Boolean)
  inStock?: boolean;

  /**
   * Número de página (para paginación)
   * @example 1
   */
  @IsInt({ message: 'page debe ser un número entero' })
  @Min(1, { message: 'page debe ser mayor o igual a 1' })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  /**
   * Cantidad de items por página
   * @example 12
   */
  @IsInt({ message: 'limit debe ser un número entero' })
  @Min(1, { message: 'limit debe ser mayor o igual a 1' })
  @Max(100, { message: 'limit no puede ser mayor a 100' })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 12;

  /**
   * Ordenar por campo
   * @example "createdAt"
   */
  @IsString({ message: 'sortBy debe ser un texto' })
  @IsOptional()
  sortBy?: string = 'createdAt';

  /**
   * Dirección del ordenamiento
   * @example "desc"
   */
  @IsEnum(['asc', 'desc'], { message: 'sortOrder debe ser asc o desc' })
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';
}
