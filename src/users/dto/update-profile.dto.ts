import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para actualizar el perfil del usuario
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({
    description: 'Nombre completo del usuario',
    example: 'Juan Pérez',
  })
  @IsOptional()
  @IsString({ message: 'El nombre debe ser un string' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  name?: string;

  @ApiPropertyOptional({
    description: 'Nickname o apodo del usuario',
    example: 'juancho',
  })
  @IsOptional()
  @IsString({ message: 'El nickname debe ser un string' })
  @MaxLength(50, { message: 'El nickname no puede exceder 50 caracteres' })
  nickname?: string;

  @ApiPropertyOptional({
    description: 'Teléfono del usuario',
    example: '+58 412 1234567',
  })
  @IsOptional()
  @IsString({ message: 'El teléfono debe ser un string' })
  @MaxLength(20, { message: 'El teléfono no puede exceder 20 caracteres' })
  phone?: string;
}
