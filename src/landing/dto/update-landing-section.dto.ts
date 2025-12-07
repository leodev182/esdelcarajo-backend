import { PartialType } from '@nestjs/mapped-types';
import { CreateLandingSectionDto } from './create-landing-section.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateLandingSectionDto extends PartialType(
  CreateLandingSectionDto,
) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
