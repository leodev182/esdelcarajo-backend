import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para agregar un producto a favoritos
 */
export class AddFavoriteDto {
  @ApiProperty({
    description: 'ID del producto a agregar a favoritos (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString({ message: 'El productId debe ser un string (UUID)' })
  @IsNotEmpty({ message: 'El productId es requerido' })
  productId: string;
}
