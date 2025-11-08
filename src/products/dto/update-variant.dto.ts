import { PartialType } from '@nestjs/mapped-types';
import { CreateVariantDto } from './create-variant.dto';
import { IsBoolean, IsOptional } from 'class-validator';

/**
 * DTO para actualizar una variante existente
 */
export class UpdateVariantDto extends PartialType(CreateVariantDto) {
  /**
   * Estado activo/inactivo de la variante
   * Se desactiva automáticamente cuando stock = 0
   * @example true
   */
  @IsBoolean({ message: 'isActive debe ser verdadero o falso' })
  @IsOptional()
  isActive?: boolean;
}
