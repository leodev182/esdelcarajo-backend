import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LandingService } from './landing.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  landingSection: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  sectionImage: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
};

const mockSection = {
  id: 'section-1',
  title: 'Hero Banner',
  subtitle: 'Nueva colección',
  type: 'HERO',
  isActive: true,
  order: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  images: [],
};

const mockImage = {
  id: 'img-1',
  sectionId: 'section-1',
  url: 'https://res.cloudinary.com/test/image.jpg',
  alt: 'Banner principal',
  order: 1,
  isActive: true,
};

describe('LandingService', () => {
  let service: LandingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LandingService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<LandingService>(LandingService);
    jest.clearAllMocks();
  });

  it('debería estar definido', () => {
    expect(service).toBeDefined();
  });

  // ─────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────
  describe('create', () => {
    it('crea una sección de landing exitosamente', async () => {
      mockPrisma.landingSection.create.mockResolvedValueOnce(mockSection);

      const result = await service.create({ title: 'Hero Banner' } as any);

      expect(result.id).toBe('section-1');
      expect(result.title).toBe('Hero Banner');
      expect(mockPrisma.landingSection.create).toHaveBeenCalledTimes(1);
    });
  });

  // ─────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────
  describe('findAll', () => {
    it('devuelve todas las secciones activas', async () => {
      mockPrisma.landingSection.findMany.mockResolvedValueOnce([mockSection]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(mockPrisma.landingSection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
        }),
      );
    });

    it('devuelve array vacío si no hay secciones activas', async () => {
      mockPrisma.landingSection.findMany.mockResolvedValueOnce([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────
  // findOne
  // ─────────────────────────────────────────────
  describe('findOne', () => {
    it('devuelve la sección cuando existe', async () => {
      mockPrisma.landingSection.findUnique.mockResolvedValueOnce(mockSection);

      const result = await service.findOne('section-1');

      expect(result.id).toBe('section-1');
      expect(result.title).toBe('Hero Banner');
    });

    it('lanza NotFoundException si la sección no existe', async () => {
      mockPrisma.landingSection.findUnique.mockResolvedValueOnce(null);

      await expect(service.findOne('id-inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────
  describe('update', () => {
    it('actualiza la sección exitosamente', async () => {
      const updateDto = { title: 'Nuevo Título' };
      mockPrisma.landingSection.findUnique.mockResolvedValueOnce(mockSection);
      mockPrisma.landingSection.update.mockResolvedValueOnce({
        ...mockSection,
        ...updateDto,
      });

      const result = await service.update('section-1', updateDto as any);

      expect(result.title).toBe('Nuevo Título');
    });

    it('lanza NotFoundException si la sección no existe', async () => {
      mockPrisma.landingSection.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.update('id-inexistente', { title: 'X' } as any),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.landingSection.update).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // remove
  // ─────────────────────────────────────────────
  describe('remove', () => {
    it('desactiva la sección (soft delete con isActive: false)', async () => {
      mockPrisma.landingSection.findUnique.mockResolvedValueOnce(mockSection);
      mockPrisma.landingSection.update.mockResolvedValueOnce({
        ...mockSection,
        isActive: false,
      });

      await service.remove('section-1');

      expect(mockPrisma.landingSection.update).toHaveBeenCalledWith({
        where: { id: 'section-1' },
        data: { isActive: false },
      });
    });

    it('lanza NotFoundException si la sección no existe', async () => {
      mockPrisma.landingSection.findUnique.mockResolvedValueOnce(null);

      await expect(service.remove('id-inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─────────────────────────────────────────────
  // addImage
  // ─────────────────────────────────────────────
  describe('addImage', () => {
    it('agrega una imagen a la sección exitosamente', async () => {
      const sectionWith2Images = {
        ...mockSection,
        images: [mockImage, mockImage],
      };
      mockPrisma.landingSection.findUnique.mockResolvedValueOnce(
        sectionWith2Images,
      );
      mockPrisma.sectionImage.create.mockResolvedValueOnce(mockImage);

      const result = await service.addImage({
        sectionId: 'section-1',
        url: 'https://example.com/img.jpg',
        alt: 'Alt',
        order: 3,
      } as any);

      expect(result.id).toBe('img-1');
      expect(mockPrisma.sectionImage.create).toHaveBeenCalledTimes(1);
    });

    it('lanza BadRequestException si la sección ya tiene 5 imágenes', async () => {
      const images = Array(5).fill(mockImage);
      mockPrisma.landingSection.findUnique.mockResolvedValueOnce({
        ...mockSection,
        images,
      });

      await expect(
        service.addImage({
          sectionId: 'section-1',
          url: 'url',
          alt: 'alt',
          order: 6,
        } as any),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.sectionImage.create).not.toHaveBeenCalled();
    });

    it('lanza NotFoundException si la sección no existe', async () => {
      mockPrisma.landingSection.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.addImage({
          sectionId: 'id-inexistente',
          url: 'url',
          alt: 'alt',
          order: 1,
        } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────
  // removeImage
  // ─────────────────────────────────────────────
  describe('removeImage', () => {
    it('elimina la imagen exitosamente', async () => {
      mockPrisma.sectionImage.findUnique.mockResolvedValueOnce(mockImage);
      mockPrisma.sectionImage.delete.mockResolvedValueOnce(mockImage);

      await service.removeImage('img-1');

      expect(mockPrisma.sectionImage.delete).toHaveBeenCalledWith({
        where: { id: 'img-1' },
      });
    });

    it('lanza NotFoundException si la imagen no existe', async () => {
      mockPrisma.sectionImage.findUnique.mockResolvedValueOnce(null);

      await expect(service.removeImage('img-inexistente')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.sectionImage.delete).not.toHaveBeenCalled();
    });
  });
});
