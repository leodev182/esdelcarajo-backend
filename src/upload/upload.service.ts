import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { UploadResponseDto } from './dto/upload-response.dto';
import { Readable } from 'stream';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  async uploadImage(file: Express.Multer.File): Promise<UploadResponseDto> {
    this.logger.log(
      `Subiendo imagen a Cloudinary - Tamaño: ${file.size} bytes, Tipo: ${file.mimetype}`,
    );

    if (!file) {
      throw new BadRequestException('No se proporcionó ningún archivo');
    }

    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      this.logger.warn(`Formato inválido rechazado: ${file.mimetype}`);
      throw new BadRequestException(
        'Formato de imagen no válido. Solo se permiten: JPG, PNG, WEBP',
      );
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      this.logger.warn(
        `Imagen demasiado grande rechazada: ${file.size} bytes (máx: ${maxSize})`,
      );
      throw new BadRequestException(
        'La imagen es demasiado grande. Tamaño máximo: 5MB',
      );
    }

    try {
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

        const bufferStream = new Readable();
        bufferStream.push(file.buffer);
        bufferStream.push(null);
        bufferStream.pipe(uploadStream);
      });

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

      this.logger.log(
        `Imagen subida exitosamente - PublicId: ${result.public_id}, URL: ${result.secure_url}`,
      );

      return {
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        width: result.width,
        height: result.height,
        size: result.bytes,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error('Error subiendo imagen a Cloudinary', err.stack, {
        fileSize: file.size,
        mimetype: file.mimetype,
      });
      throw new BadRequestException(
        `Error al subir la imagen a Cloudinary: ${err.message}`,
      );
    }
  }

  async deleteImage(publicId: string): Promise<{ message: string }> {
    this.logger.log(`Eliminando imagen de Cloudinary - PublicId: ${publicId}`);

    if (!publicId) {
      throw new BadRequestException('Se requiere el publicId de la imagen');
    }

    try {
      const result: unknown = await cloudinary.uploader.destroy(publicId);

      if (!result || typeof result !== 'object') {
        throw new BadRequestException(
          'Error al procesar la respuesta de Cloudinary',
        );
      }

      const deleteResult = result as { result: string };

      if (deleteResult.result !== 'ok') {
        this.logger.warn(
          `Cloudinary no pudo eliminar imagen - PublicId: ${publicId}, Resultado: ${deleteResult.result}`,
        );
        throw new BadRequestException('No se pudo eliminar la imagen');
      }

      this.logger.log(`Imagen eliminada exitosamente - PublicId: ${publicId}`);

      return {
        message: 'Imagen eliminada exitosamente',
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(
        `Error eliminando imagen de Cloudinary - PublicId: ${publicId}`,
        err.stack,
        { publicId },
      );
      throw new BadRequestException(
        `Error al eliminar la imagen: ${err.message}`,
      );
    }
  }

  async uploadMultipleImages(
    files: Express.Multer.File[],
  ): Promise<UploadResponseDto[]> {
    this.logger.log(`Subiendo múltiples imágenes - Cantidad: ${files.length}`);

    if (!files || files.length === 0) {
      throw new BadRequestException('No se proporcionaron archivos');
    }

    if (files.length > 5) {
      this.logger.warn(
        `Intento de subir más de 5 imágenes - Cantidad: ${files.length}`,
      );
      throw new BadRequestException(
        'Máximo 5 imágenes por producto permitidas',
      );
    }

    try {
      const uploadPromises = files.map((file) => this.uploadImage(file));
      const results = await Promise.all(uploadPromises);

      this.logger.log(
        `${results.length} imágenes subidas exitosamente a Cloudinary`,
      );

      return results;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error('Error subiendo múltiples imágenes', err.stack, {
        filesCount: files.length,
      });
      throw error;
    }
  }

  async uploadPaymentProof(
    file: Express.Multer.File,
  ): Promise<UploadResponseDto> {
    this.logger.log(
      `Subiendo comprobante de pago - Tamaño: ${file.size} bytes`,
    );

    if (!file) {
      throw new BadRequestException('No se proporcionó ningún archivo');
    }

    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      this.logger.warn(
        `Formato de comprobante inválido rechazado: ${file.mimetype}`,
      );
      throw new BadRequestException(
        'Formato de imagen no válido. Solo se permiten: JPG, PNG, WEBP',
      );
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      this.logger.warn(
        `Comprobante demasiado grande rechazado: ${file.size} bytes`,
      );
      throw new BadRequestException(
        'La imagen es demasiado grande. Tamaño máximo: 5MB',
      );
    }

    try {
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'delcarajo/payment-proofs',
            resource_type: 'image',
          },
          (error, result) => {
            if (error) {
              reject(new Error(error.message || 'Error al subir comprobante'));
            } else {
              resolve(result);
            }
          },
        );

        const bufferStream = new Readable();
        bufferStream.push(file.buffer);
        bufferStream.push(null);
        bufferStream.pipe(uploadStream);
      });

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

      this.logger.log(
        `Comprobante de pago subido exitosamente - PublicId: ${result.public_id}`,
      );

      return {
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        width: result.width,
        height: result.height,
        size: result.bytes,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error('Error subiendo comprobante de pago', err.stack, {
        fileSize: file.size,
        mimetype: file.mimetype,
      });
      throw new BadRequestException(
        `Error al subir el comprobante a Cloudinary: ${err.message}`,
      );
    }
  }
}
