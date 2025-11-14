import { Injectable, BadRequestException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { UploadResponseDto } from './dto/upload-response.dto';
import { Readable } from 'stream';

@Injectable()
export class UploadService {
  /**
   * Subir una imagen a Cloudinary
   */
  async uploadImage(file: Express.Multer.File): Promise<UploadResponseDto> {
    // Validar que el archivo exista
    if (!file) {
      throw new BadRequestException('No se proporcionó ningún archivo');
    }

    // Validar tipo de archivo
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Formato de imagen no válido. Solo se permiten: JPG, PNG, WEBP',
      );
    }

    // Validar tamaño (máximo 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB en bytes
    if (file.size > maxSize) {
      throw new BadRequestException(
        'La imagen es demasiado grande. Tamaño máximo: 5MB',
      );
    }

    try {
      // Subir a Cloudinary usando stream
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'delcarajo/products',
            resource_type: 'image',
            transformation: [
              { width: 1920, height: 1920, crop: 'limit' },
              { quality: 'auto' },
              { fetch_format: 'auto' },
            ],
          },
          (error, result) => {
            if (error) {
              reject(new Error(error.message || 'Error al subir imagen'));
            } else {
              resolve(result);
            }
          },
        );

        // Convertir buffer a stream y hacer pipe
        const bufferStream = new Readable();
        bufferStream.push(file.buffer);
        bufferStream.push(null);
        bufferStream.pipe(uploadStream);
      });

      // Verificar que uploadResult tenga las propiedades necesarias
      if (!uploadResult || typeof uploadResult !== 'object') {
        throw new BadRequestException(
          'Error al procesar la respuesta de Cloudinary',
        );
      }

      const result = uploadResult as {
        secure_url: string;
        public_id: string;
        format: string;
        width: number;
        height: number;
        bytes: number;
      };

      // Retornar información de la imagen subida
      return {
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        width: result.width,
        height: result.height,
        size: result.bytes,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error desconocido';
      throw new BadRequestException(
        `Error al subir la imagen a Cloudinary: ${errorMessage}`,
      );
    }
  }

  /**
   * Eliminar una imagen de Cloudinary
   */
  async deleteImage(publicId: string): Promise<{ message: string }> {
    if (!publicId) {
      throw new BadRequestException('Se requiere el publicId de la imagen');
    }

    try {
      const result: unknown = await cloudinary.uploader.destroy(publicId);

      // Verificar el resultado
      if (!result || typeof result !== 'object') {
        throw new BadRequestException(
          'Error al procesar la respuesta de Cloudinary',
        );
      }

      const deleteResult = result as { result: string };

      if (deleteResult.result !== 'ok') {
        throw new BadRequestException('No se pudo eliminar la imagen');
      }

      return {
        message: 'Imagen eliminada exitosamente',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error desconocido';
      throw new BadRequestException(
        `Error al eliminar la imagen: ${errorMessage}`,
      );
    }
  }

  /**
   * Subir múltiples imágenes
   */
  async uploadMultipleImages(
    files: Express.Multer.File[],
  ): Promise<UploadResponseDto[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No se proporcionaron archivos');
    }

    // Validar que no se suban más de 5 imágenes
    if (files.length > 5) {
      throw new BadRequestException(
        'Máximo 5 imágenes por producto permitidas',
      );
    }

    // Subir todas las imágenes en paralelo
    const uploadPromises = files.map((file) => this.uploadImage(file));
    const results = await Promise.all(uploadPromises);

    return results;
  }
}
