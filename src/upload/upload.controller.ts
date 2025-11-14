import {
  Controller,
  Post,
  Delete,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Upload')
@ApiBearerAuth()
@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('image')
  @ApiOperation({ summary: 'Subir una imagen a Cloudinary' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No se proporcionó ningún archivo');
    }
    return this.uploadService.uploadImage(file);
  }

  @Post('images')
  @ApiOperation({ summary: 'Subir múltiples imágenes (máximo 5)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', 5))
  async uploadMultipleImages(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No se proporcionaron archivos');
    }
    return this.uploadService.uploadMultipleImages(files);
  }

  @Delete('image')
  @ApiOperation({ summary: 'Eliminar una imagen de Cloudinary' })
  async deleteImage(@Body('publicId') publicId: string) {
    if (!publicId) {
      throw new BadRequestException('Se requiere el publicId de la imagen');
    }
    return this.uploadService.deleteImage(publicId);
  }
}
