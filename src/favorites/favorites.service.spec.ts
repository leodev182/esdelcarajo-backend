import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  product: {
    findUnique: jest.fn(),
  },
  favorite: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
};

const mockProduct = {
  id: 'prod-1',
  name: 'Franela Del Carajo',
  slug: 'franela-del-carajo',
  isActive: true,
};

const mockFavorite = {
  id: 'fav-1',
  userId: 'user-1',
  productId: 'prod-1',
  createdAt: new Date(),
  product: {
    ...mockProduct,
    isActive: true,
    images: [],
    category: { id: 'cat-1', name: 'Carajos' },
    subcategory: { id: 'sub-1', name: 'Franelas' },
    variants: [],
  },
};

describe('FavoritesService', () => {
  let service: FavoritesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FavoritesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<FavoritesService>(FavoritesService);
    jest.clearAllMocks();
  });

  it('debería estar definido', () => {
    expect(service).toBeDefined();
  });

  // ─────────────────────────────────────────────
  // addFavorite
  // ─────────────────────────────────────────────
  describe('addFavorite', () => {
    it('agrega el producto a favoritos exitosamente', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(mockProduct);
      mockPrisma.favorite.findFirst.mockResolvedValueOnce(null);
      mockPrisma.favorite.create.mockResolvedValueOnce(mockFavorite);

      const result = await service.addFavorite('user-1', { productId: 'prod-1' });

      expect(result.message).toBe('Producto agregado a favoritos');
      expect(mockPrisma.favorite.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { userId: 'user-1', productId: 'prod-1' },
        }),
      );
    });

    it('lanza NotFoundException si el producto no existe', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.addFavorite('user-1', { productId: 'prod-inexistente' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.favorite.create).not.toHaveBeenCalled();
    });

    it('lanza ConflictException si el producto está inactivo', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce({
        ...mockProduct,
        isActive: false,
      });

      await expect(
        service.addFavorite('user-1', { productId: 'prod-1' }),
      ).rejects.toThrow(ConflictException);
      expect(mockPrisma.favorite.create).not.toHaveBeenCalled();
    });

    it('lanza ConflictException si el producto ya está en favoritos', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(mockProduct);
      mockPrisma.favorite.findFirst.mockResolvedValueOnce(mockFavorite);

      await expect(
        service.addFavorite('user-1', { productId: 'prod-1' }),
      ).rejects.toThrow(ConflictException);
      expect(mockPrisma.favorite.create).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // getFavorites
  // ─────────────────────────────────────────────
  describe('getFavorites', () => {
    it('devuelve solo favoritos de productos activos', async () => {
      const inactiveFav = {
        ...mockFavorite,
        id: 'fav-2',
        product: { ...mockFavorite.product, isActive: false },
      };
      mockPrisma.favorite.findMany.mockResolvedValueOnce([mockFavorite, inactiveFav]);

      const result = await service.getFavorites('user-1');

      expect(result.total).toBe(1);
      expect(result.favorites).toHaveLength(1);
      expect(result.favorites[0].id).toBe('fav-1');
    });

    it('devuelve total 0 si el usuario no tiene favoritos activos', async () => {
      mockPrisma.favorite.findMany.mockResolvedValueOnce([]);

      const result = await service.getFavorites('user-1');

      expect(result.total).toBe(0);
      expect(result.favorites).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────
  // removeFavorite
  // ─────────────────────────────────────────────
  describe('removeFavorite', () => {
    it('elimina el favorito exitosamente', async () => {
      mockPrisma.favorite.findFirst.mockResolvedValueOnce(mockFavorite);
      mockPrisma.favorite.delete.mockResolvedValueOnce({});

      const result = await service.removeFavorite('user-1', 'fav-1');

      expect(result.message).toBe('Producto eliminado de favoritos');
      expect(mockPrisma.favorite.delete).toHaveBeenCalledWith({
        where: { id: 'fav-1' },
      });
    });

    it('lanza NotFoundException si el favorito no existe o no pertenece al usuario', async () => {
      mockPrisma.favorite.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.removeFavorite('user-1', 'fav-inexistente'),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.favorite.delete).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // isFavorite
  // ─────────────────────────────────────────────
  describe('isFavorite', () => {
    it('devuelve true si el producto está en favoritos', async () => {
      mockPrisma.favorite.findFirst.mockResolvedValueOnce(mockFavorite);

      const result = await service.isFavorite('user-1', 'prod-1');

      expect(result).toBe(true);
    });

    it('devuelve false si el producto no está en favoritos', async () => {
      mockPrisma.favorite.findFirst.mockResolvedValueOnce(null);

      const result = await service.isFavorite('user-1', 'prod-no-fav');

      expect(result).toBe(false);
    });
  });

  // ─────────────────────────────────────────────
  // clearFavorites
  // ─────────────────────────────────────────────
  describe('clearFavorites', () => {
    it('elimina todos los favoritos y devuelve el conteo', async () => {
      mockPrisma.favorite.deleteMany.mockResolvedValueOnce({ count: 3 });

      const result = await service.clearFavorites('user-1');

      expect(result.deleted).toBe(3);
      expect(result.message).toBe('Todos los favoritos han sido eliminados');
      expect(mockPrisma.favorite.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });

    it('devuelve deleted: 0 si no había favoritos', async () => {
      mockPrisma.favorite.deleteMany.mockResolvedValueOnce({ count: 0 });

      const result = await service.clearFavorites('user-1');

      expect(result.deleted).toBe(0);
    });
  });
});
