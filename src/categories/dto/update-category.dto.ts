import { PartialType } from '@nestjs/mapped-types';
import { CreateCategoryDto } from './create-category.dto';
import { IsBoolean, IsOptional } from 'class-validator';

/**
 * DTO para actualizar una categoría existente
 */
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {
  /**
   * Estado activo/inactivo de la categoría (soft delete)
   * @example true
   */
  @IsBoolean({ message: 'isActive debe ser verdadero o falso' })
  @IsOptional()
  isActive?: boolean;
}
