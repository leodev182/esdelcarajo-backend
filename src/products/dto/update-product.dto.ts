import { PartialType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto';
import { IsBoolean, IsOptional } from 'class-validator';

/**
 * DTO para actualizar un producto existente
 */
export class UpdateProductDto extends PartialType(CreateProductDto) {
  /**
   * Estado activo/inactivo del producto (soft delete)
   * @example true
   */
  @IsBoolean({ message: 'isActive debe ser verdadero o falso' })
  @IsOptional()
  isActive?: boolean;
}
