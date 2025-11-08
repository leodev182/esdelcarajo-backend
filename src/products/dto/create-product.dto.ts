import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsBoolean,
  MaxLength,
} from 'class-validator';

/**
 * DTO para crear un nuevo producto
 */
export class CreateProductDto {
  /**
   * Nombre del producto
   * @example "Franela Goyo Classic"
   */
  @IsString({ message: 'El nombre debe ser un texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(200, { message: 'El nombre no puede exceder 200 caracteres' })
  name: string;

  /**
   * Descripción detallada del producto
   * @example "Franela de algodón 100% con diseño exclusivo de Goyo"
   */
  @IsString({ message: 'La descripción debe ser un texto' })
  @IsNotEmpty({ message: 'La descripción es obligatoria' })
  description: string;

  /**
   * UUID de la categoría
   * @example "1194ebe5-3d97-4c87-98ea-d82c6a740bd3"
   */
  @IsUUID('4', { message: 'categoryId debe ser un UUID válido' })
  @IsNotEmpty({ message: 'categoryId es obligatorio' })
  categoryId: string;

  /**
   * UUID de la subcategoría (opcional)
   * @example "1f9c375a-eff8-413c-ab3a-899e90d7a897"
   */
  @IsUUID('4', { message: 'subcategoryId debe ser un UUID válido' })
  @IsOptional()
  subcategoryId?: string;

  /**
   * Título meta para SEO
   * @example "Franela Goyo Classic - Del Carajo"
   */
  @IsString({ message: 'El metaTitle debe ser un texto' })
  @IsOptional()
  @MaxLength(60, { message: 'El metaTitle no puede exceder 60 caracteres' })
  metaTitle?: string;

  /**
   * Descripción meta para SEO
   * @example "Compra la Franela Goyo Classic, diseño exclusivo de ropa urbana venezolana"
   */
  @IsString({ message: 'La metaDescription debe ser un texto' })
  @IsOptional()
  @MaxLength(160, {
    message: 'La metaDescription no puede exceder 160 caracteres',
  })
  metaDescription?: string;

  /**
   * Marcar como producto destacado
   * @example true
   */
  @IsBoolean({ message: 'isFeatured debe ser verdadero o falso' })
  @IsOptional()
  isFeatured?: boolean;
}
