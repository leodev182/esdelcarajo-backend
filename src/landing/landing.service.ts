import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLandingSectionDto } from './dto/create-landing-section.dto';
import { UpdateLandingSectionDto } from './dto/update-landing-section.dto';
import { AddSectionImageDto } from './dto/add-section-image.dto';

@Injectable()
export class LandingService {
  private readonly logger = new Logger(LandingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateLandingSectionDto) {
    this.logger.log(`Creando sección de landing: ${createDto.title}`);

    try {
      const section = await this.prisma.landingSection.create({
        data: createDto,
        include: {
          images: {
            orderBy: { order: 'asc' },
          },
        },
      });

      this.logger.log(
        `Sección de landing creada exitosamente - ID: ${section.id}`,
      );

      return section;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(
        `Error creando sección de landing: ${createDto.title}`,
        err.stack,
      );
      throw error;
    }
  }

  async findAll() {
    this.logger.log('Consultando todas las secciones de landing');

    try {
      const sections = await this.prisma.landingSection.findMany({
        where: { isActive: true },
        include: {
          images: {
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { order: 'asc' },
      });

      this.logger.log(`${sections.length} secciones de landing encontradas`);

      return sections;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error('Error consultando secciones de landing', err.stack);
      throw error;
    }
  }

  async findOne(id: string) {
    const section = await this.prisma.landingSection.findUnique({
      where: { id },
      include: {
        images: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!section) {
      this.logger.warn(`Sección de landing ${id} no encontrada`);
      throw new NotFoundException(`Sección con ID ${id} no encontrada`);
    }

    return section;
  }

  async update(id: string, updateDto: UpdateLandingSectionDto) {
    this.logger.log(`Actualizando sección de landing ${id}`);

    try {
      await this.findOne(id);

      const updated = await this.prisma.landingSection.update({
        where: { id },
        data: updateDto,
        include: {
          images: {
            orderBy: { order: 'asc' },
          },
        },
      });

      this.logger.log(`Sección de landing ${id} actualizada exitosamente`);

      return updated;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(
        `Error actualizando sección de landing ${id}`,
        err.stack,
        { id },
      );
      throw error;
    }
  }

  async remove(id: string) {
    this.logger.log(`Desactivando sección de landing ${id}`);

    try {
      await this.findOne(id);

      const deleted = await this.prisma.landingSection.update({
        where: { id },
        data: { isActive: false },
      });

      this.logger.log(`Sección de landing ${id} desactivada exitosamente`);

      return deleted;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(
        `Error desactivando sección de landing ${id}`,
        err.stack,
        { id },
      );
      throw error;
    }
  }

  async addImage(addImageDto: AddSectionImageDto) {
    this.logger.log(
      `Agregando imagen a sección de landing ${addImageDto.sectionId}`,
    );

    try {
      const section = await this.prisma.landingSection.findUnique({
        where: { id: addImageDto.sectionId },
        include: {
          images: true,
        },
      });

      if (!section) {
        this.logger.warn(
          `Sección de landing ${addImageDto.sectionId} no encontrada`,
        );
        throw new NotFoundException(
          `Sección con ID ${addImageDto.sectionId} no encontrada`,
        );
      }

      const maxImages = section.type === 'GALLERY' ? 20 : 5;
      if (section.images.length >= maxImages) {
        this.logger.warn(
          `Sección ${addImageDto.sectionId} ya tiene ${maxImages} imágenes`,
        );
        throw new BadRequestException(
          `No se pueden agregar más de ${maxImages} imágenes por sección`,
        );
      }

      const image = await this.prisma.sectionImage.create({
        data: addImageDto,
      });

      this.logger.log(
        `Imagen agregada exitosamente - ID: ${image.id}, Sección: ${addImageDto.sectionId}`,
      );

      return image;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(
        `Error agregando imagen a sección ${addImageDto.sectionId}`,
        err.stack,
        { sectionId: addImageDto.sectionId },
      );
      throw error;
    }
  }

  async removeImage(imageId: string) {
    this.logger.log(`Eliminando imagen ${imageId} de sección de landing`);

    try {
      const image = await this.prisma.sectionImage.findUnique({
        where: { id: imageId },
      });

      if (!image) {
        this.logger.warn(`Imagen ${imageId} no encontrada`);
        throw new NotFoundException(`Imagen con ID ${imageId} no encontrada`);
      }

      const deleted = await this.prisma.sectionImage.delete({
        where: { id: imageId },
      });

      this.logger.log(`Imagen ${imageId} eliminada exitosamente`);

      return deleted;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(`Error eliminando imagen ${imageId}`, err.stack, {
        imageId,
      });
      throw error;
    }
  }
}
