import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLandingSectionDto } from './dto/create-landing-section.dto';
import { UpdateLandingSectionDto } from './dto/update-landing-section.dto';
import { AddSectionImageDto } from './dto/add-section-image.dto';

@Injectable()
export class LandingService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateLandingSectionDto) {
    return this.prisma.landingSection.create({
      data: createDto,
      include: {
        images: {
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  async findAll() {
    return this.prisma.landingSection.findMany({
      where: { isActive: true },
      include: {
        images: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { order: 'asc' },
    });
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
      throw new NotFoundException(`Sección con ID ${id} no encontrada`);
    }

    return section;
  }

  async update(id: string, updateDto: UpdateLandingSectionDto) {
    await this.findOne(id);

    return this.prisma.landingSection.update({
      where: { id },
      data: updateDto,
      include: {
        images: {
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.landingSection.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async addImage(addImageDto: AddSectionImageDto) {
    const section = await this.prisma.landingSection.findUnique({
      where: { id: addImageDto.sectionId },
      include: {
        images: true,
      },
    });

    if (!section) {
      throw new NotFoundException(
        `Sección con ID ${addImageDto.sectionId} no encontrada`,
      );
    }

    if (section.images.length >= 5) {
      throw new BadRequestException(
        'No se pueden agregar más de 5 imágenes por sección',
      );
    }

    return this.prisma.sectionImage.create({
      data: addImageDto,
    });
  }

  async removeImage(imageId: string) {
    const image = await this.prisma.sectionImage.findUnique({
      where: { id: imageId },
    });

    if (!image) {
      throw new NotFoundException(`Imagen con ID ${imageId} no encontrada`);
    }

    return this.prisma.sectionImage.delete({
      where: { id: imageId },
    });
  }
}
