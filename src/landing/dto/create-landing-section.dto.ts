import { IsString, IsEnum, IsOptional, IsInt, Min, Max } from 'class-validator';
import { SectionType, TextPosition } from '@prisma/client';

export class CreateLandingSectionDto {
  @IsEnum(SectionType)
  type: SectionType;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(TextPosition)
  textPosition: TextPosition;

  @IsString()
  bgColor: string;

  @IsInt()
  @Min(0)
  order: number;
}
