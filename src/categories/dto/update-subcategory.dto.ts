import { PartialType } from '@nestjs/mapped-types';
import { CreateSubcategoryDto } from './create-subcategory.dto';
import { IsBoolean, IsOptional } from 'class-validator';

/**
 * DTO for updating an existing subcategory
 */
export class UpdateSubcategoryDto extends PartialType(CreateSubcategoryDto) {
  /**
   * Soft delete flag
   */
  @IsBoolean({ message: 'isActive must be a boolean' })
  @IsOptional()
  isActive?: boolean;
}
