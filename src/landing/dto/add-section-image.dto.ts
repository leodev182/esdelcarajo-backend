import { IsString, IsInt, Min, IsOptional } from 'class-validator';

export class AddSectionImageDto {
  @IsString()
  sectionId: string;

  @IsString()
  url: string;

  @IsString()
  publicId: string;

  @IsOptional()
  @IsString()
  alt?: string;

  @IsInt()
  @Min(0)
  order: number;
}
