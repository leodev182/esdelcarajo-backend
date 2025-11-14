import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO de respuesta después de subir una imagen
 */
export class UploadResponseDto {
  @ApiProperty({
    description: 'URL pública de la imagen en Cloudinary',
    example:
      'https://res.cloudinary.com/dxxxxxxx/image/upload/v1234567890/products/abc123.jpg',
  })
  url: string;

  @ApiProperty({
    description: 'ID público de la imagen en Cloudinary',
    example: 'products/abc123',
  })
  publicId: string;

  @ApiProperty({
    description: 'Formato de la imagen',
    example: 'jpg',
  })
  format: string;

  @ApiProperty({
    description: 'Ancho de la imagen en píxeles',
    example: 1920,
  })
  width: number;

  @ApiProperty({
    description: 'Alto de la imagen en píxeles',
    example: 1080,
  })
  height: number;

  @ApiProperty({
    description: 'Tamaño del archivo en bytes',
    example: 245678,
  })
  size: number;
}
