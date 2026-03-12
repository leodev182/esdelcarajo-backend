import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  product: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  category: {
    findUnique: jest.fn(),
  },
  subcategory: {
    findUnique: jest.fn(),
  },
};

const mockProduct = {
  id: 'prod-1',
  name: 'Franela Del Carajo',
  slug: 'franela-del-carajo',
  description: 'Una franela brutal',
  price: 25.0,
  categoryId: 'cat-1',
  subcategoryId: 'sub-1',
  isActive: true,
  isFeatured: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  category: { id: 'cat-1', name: 'Carajos', slug: 'carajos' },
  subcategory: { id: 'sub-1', name: 'Franelas', slug: 'carajos-franelas' },
  variants: [],
  images: [],
};

describe('ProductsService', () => {
  let service: ProductsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    jest.clearAllMocks();
  });

  it('debería estar definido', () => {
    expect(service).toBeDefined();
  });

  // ─────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────
  describe('findAll', () => {
    beforeEach(() => {
      mockPrisma.product.findMany.mockResolvedValue([mockProduct]);
      mockPrisma.product.count.mockResolvedValue(1);
    });

    it('devuelve productos paginados con metadata correcta', async () => {
      const result = await service.findAll({ page: 1, limit: 12 });

      expect(result.data).toHaveLength(1);
      expect(result.meta).toMatchObject({
        total: 1,
        page: 1,
        limit: 12,
      });
    });

    it('aplica filtro de categoryId cuando se proporciona', async () => {
      await service.findAll({ categoryId: 'cat-1' });

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ categoryId: 'cat-1' }),
        }),
      );
    });

    it('aplica filtro de subcategoryId cuando se proporciona', async () => {
      await service.findAll({ subcategoryId: 'sub-1' });

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ subcategoryId: 'sub-1' }),
        }),
      );
    });

    it('aplica búsqueda en nombre y descripción cuando se proporciona search', async () => {
      await service.findAll({ search: 'franela' });

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                name: expect.objectContaining({ contains: 'franela' }),
              }),
            ]),
          }),
        }),
      );
    });

    it('calcula el skip correcto para paginación', async () => {
      await service.findAll({ page: 3, limit: 10 });

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it('filtra solo productos activos', async () => {
      await service.findAll({});

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        }),
      );
    });

    it('devuelve array vacío y total 0 cuando no hay productos para la categoría', async () => {
      mockPrisma.product.findMany.mockResolvedValueOnce([]);
      mockPrisma.product.count.mockResolvedValueOnce(0);

      const result = await service.findAll({ categoryId: 'cat-sin-productos' });

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });
  });

  // ─────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────
  describe('create', () => {
    const dto = {
      name: 'Franela Nueva',
      description: 'Descripción',
      price: 20.0,
      categoryId: 'cat-1',
    };

    it('crea el producto con slug generado a partir del nombre', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(null);
      mockPrisma.category.findUnique.mockResolvedValueOnce({ id: 'cat-1' });
      mockPrisma.product.create.mockResolvedValueOnce({
        ...mockProduct,
        name: 'Franela Nueva',
        slug: 'franela-nueva',
      });

      const result = await service.create(dto);

      expect(result.slug).toBe('franela-nueva');
      expect(mockPrisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ slug: 'franela-nueva' }),
        }),
      );
    });

    it('lanza ConflictException si el slug ya existe', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(mockProduct);

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      expect(mockPrisma.product.create).not.toHaveBeenCalled();
    });

    it('lanza NotFoundException si la categoría no existe', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(null);
      mockPrisma.category.findUnique.mockResolvedValueOnce(null);

      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.product.create).not.toHaveBeenCalled();
    });
  });
});
