import { IsString, IsEnum, IsOptional, IsInt, Min } from 'class-validator';
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

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsInt()
  @Min(0)
  order: number;
}
