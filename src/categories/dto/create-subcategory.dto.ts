import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsInt,
  Min,
} from 'class-validator';

/**
 * DTO for creating a new subcategory
 */
export class CreateSubcategoryDto {
  /**
   * Parent category UUID
   */
  @IsUUID('4', { message: 'categoryId must be a valid UUID' })
  @IsNotEmpty({ message: 'categoryId is required' })
  categoryId: string;

  /**
   * Subcategory name
   */
  @IsString({ message: 'name must be a string' })
  @IsNotEmpty({ message: 'name is required' })
  name: string;

  /**
   * Subcategory description
   */
  @IsString({ message: 'description must be a string' })
  @IsOptional()
  description?: string;

  /**
   * Icon identifier for UI
   */
  @IsString({ message: 'icon must be a string' })
  @IsOptional()
  icon?: string;

  /**
   * Display order within category
   */
  @IsInt({ message: 'order must be an integer' })
  @Min(0, { message: 'order must be >= 0' })
  @IsOptional()
  order?: number;
}
