import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  category: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  subcategory: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

const mockCategory = {
  id: 'cat-1',
  name: 'Carajos',
  slug: 'carajos',
  description: 'Ropa para carajos',
  color: '#FF6501',
  isActive: true,
  order: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  subcategories: [],
  products: [],
};

const mockSubcategory = {
  id: 'sub-1',
  name: 'Franelas',
  slug: 'carajos-franelas',
  categoryId: 'cat-1',
  isActive: true,
  order: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('CategoriesService', () => {
  let service: CategoriesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    jest.clearAllMocks();
  });

  it('debería estar definido', () => {
    expect(service).toBeDefined();
  });

  // ─────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────
  describe('findAll', () => {
    it('devuelve las categorías activas con sus subcategorías', async () => {
      mockPrisma.category.findMany.mockResolvedValueOnce([mockCategory]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe('carajos');
      expect(mockPrisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
        }),
      );
    });

    it('devuelve array vacío si no hay categorías activas', async () => {
      mockPrisma.category.findMany.mockResolvedValueOnce([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────
  // findOne
  // ─────────────────────────────────────────────
  describe('findOne', () => {
    it('devuelve la categoría cuando el ID existe', async () => {
      mockPrisma.category.findUnique.mockResolvedValueOnce(mockCategory);

      const result = await service.findOne('cat-1');

      expect(result.id).toBe('cat-1');
      expect(result.name).toBe('Carajos');
    });

    it('lanza NotFoundException si la categoría no existe', async () => {
      mockPrisma.category.findUnique.mockResolvedValueOnce(null);

      await expect(service.findOne('id-inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─────────────────────────────────────────────
  // findBySlug
  // ─────────────────────────────────────────────
  describe('findBySlug', () => {
    it('devuelve la categoría cuando el slug existe', async () => {
      mockPrisma.category.findFirst.mockResolvedValueOnce(mockCategory);

      const result = await service.findBySlug('carajos');

      expect(result.slug).toBe('carajos');
      expect(mockPrisma.category.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ slug: 'carajos', isActive: true }),
        }),
      );
    });

    it('lanza NotFoundException si el slug no existe', async () => {
      mockPrisma.category.findFirst.mockResolvedValueOnce(null);

      await expect(service.findBySlug('slug-inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────
  describe('create', () => {
    const dto = { name: 'Carajas', color: '#FF6501', description: 'Ropa para carajas' };

    it('crea la categoría con el slug generado correctamente', async () => {
      mockPrisma.category.findUnique.mockResolvedValueOnce(null); // slug libre
      mockPrisma.category.create.mockResolvedValueOnce({
        ...mockCategory,
        name: 'Carajas',
        slug: 'carajas',
      });

      const result = await service.create(dto);

      expect(result.slug).toBe('carajas');
      expect(mockPrisma.category.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ slug: 'carajas' }),
        }),
      );
    });

    it('genera slug sin tildes ni caracteres especiales', async () => {
      mockPrisma.category.findUnique.mockResolvedValueOnce(null);
      mockPrisma.category.create.mockResolvedValueOnce({
        ...mockCategory,
        name: 'Ñoños & Cía.',
        slug: 'nonos-cia',
      });

      await service.create({ name: 'Ñoños & Cía.', color: '#FF6501' });

      expect(mockPrisma.category.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ slug: 'nonos-cia' }),
        }),
      );
    });

    it('lanza ConflictException si el slug ya existe', async () => {
      mockPrisma.category.findUnique.mockResolvedValueOnce(mockCategory); // slug ocupado

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      expect(mockPrisma.category.create).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // findAllSubcategories
  // ─────────────────────────────────────────────
  describe('findAllSubcategories', () => {
    it('devuelve las subcategorías activas de una categoría', async () => {
      mockPrisma.category.findUnique.mockResolvedValueOnce(mockCategory);
      mockPrisma.subcategory.findMany.mockResolvedValueOnce([mockSubcategory]);

      const result = await service.findAllSubcategories('cat-1');

      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe('carajos-franelas');
    });

    it('lanza NotFoundException si la categoría padre no existe', async () => {
      mockPrisma.category.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.findAllSubcategories('cat-inexistente'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
