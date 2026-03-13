import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CartService } from './cart.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  cart: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  cartItem: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  productVariant: {
    findFirst: jest.fn(),
  },
};

const mockVariant = {
  id: 'variant-1',
  productId: 'prod-1',
  sku: 'SKU-001',
  size: 'M',
  color: 'Negro',
  gender: 'UNISEX',
  stock: 10,
  price: 25.0,
  isActive: true,
  product: {
    id: 'prod-1',
    name: 'Franela Del Carajo',
    slug: 'franela-del-carajo',
    isActive: true,
  },
};

const mockCartItem = {
  id: 'item-1',
  cartId: 'cart-1',
  variantId: 'variant-1',
  quantity: 2,
  expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5), // expira en 5 días
  variant: {
    ...mockVariant,
    product: {
      id: 'prod-1',
      name: 'Franela Del Carajo',
      slug: 'franela-del-carajo',
      images: [],
    },
  },
};

const mockCart = {
  id: 'cart-1',
  userId: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  items: [mockCartItem],
};

const mockCartWithTotals = {
  ...mockCart,
  subtotal: 50.0,
  totalItems: 2,
};

describe('CartService', () => {
  let service: CartService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CartService>(CartService);
    jest.clearAllMocks();
  });

  it('debería estar definido', () => {
    expect(service).toBeDefined();
  });

  // ─────────────────────────────────────────────
  // getOrCreateCart
  // ─────────────────────────────────────────────
  describe('getOrCreateCart', () => {
    it('crea un carrito nuevo si el usuario no tiene uno', async () => {
      mockPrisma.cart.findUnique.mockResolvedValueOnce(null);
      mockPrisma.cart.create.mockResolvedValueOnce({ ...mockCart, items: [] });

      const result = await service.getOrCreateCart('user-1');

      expect(mockPrisma.cart.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { userId: 'user-1' } }),
      );
      expect(result.userId).toBe('user-1');
    });

    it('devuelve el carrito existente y limpia items expirados', async () => {
      mockPrisma.cart.findUnique
        .mockResolvedValueOnce(mockCart) // 1ra: carrito encontrado
        .mockResolvedValueOnce({ ...mockCart, items: [] }); // 2da: carrito actualizado
      mockPrisma.cartItem.deleteMany.mockResolvedValueOnce({ count: 2 });

      const result = await service.getOrCreateCart('user-1');

      expect(mockPrisma.cartItem.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ cartId: 'cart-1' }),
        }),
      );
      expect(result.items).toHaveLength(0);
    });
  });

  // ─────────────────────────────────────────────
  // addToCart
  // ─────────────────────────────────────────────
  describe('addToCart', () => {
    beforeEach(() => {
      jest
        .spyOn(service, 'getOrCreateCart')
        .mockResolvedValue(mockCart as any);
      jest
        .spyOn(service, 'getCartWithTotals')
        .mockResolvedValue(mockCartWithTotals as any);
    });

    it('agrega un item nuevo al carrito', async () => {
      mockPrisma.productVariant.findFirst.mockResolvedValueOnce(mockVariant);
      mockPrisma.cartItem.findUnique.mockResolvedValueOnce(null);
      mockPrisma.cartItem.create.mockResolvedValueOnce(mockCartItem);

      const result = await service.addToCart('user-1', {
        variantId: 'variant-1',
        quantity: 1,
      });

      expect(mockPrisma.cartItem.create).toHaveBeenCalledTimes(1);
      expect(result.subtotal).toBe(50.0);
    });

    it('acumula cantidad si el item ya existe en el carrito', async () => {
      const existingItem = { id: 'item-1', quantity: 2 };
      mockPrisma.productVariant.findFirst.mockResolvedValueOnce(mockVariant);
      mockPrisma.cartItem.findUnique.mockResolvedValueOnce(existingItem);
      mockPrisma.cartItem.update.mockResolvedValueOnce({});

      await service.addToCart('user-1', { variantId: 'variant-1', quantity: 1 });

      expect(mockPrisma.cartItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ quantity: 3 }), // 2 + 1
        }),
      );
    });

    it('lanza NotFoundException si la variante no existe o está inactiva', async () => {
      mockPrisma.productVariant.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.addToCart('user-1', {
          variantId: 'variant-inexistente',
          quantity: 1,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza BadRequestException si el stock inicial es insuficiente', async () => {
      mockPrisma.productVariant.findFirst.mockResolvedValueOnce({
        ...mockVariant,
        stock: 3,
      });

      await expect(
        service.addToCart('user-1', { variantId: 'variant-1', quantity: 10 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si la cantidad total supera el stock', async () => {
      const existingItem = { id: 'item-1', quantity: 8 }; // ya hay 8 en el carrito
      mockPrisma.productVariant.findFirst.mockResolvedValueOnce({
        ...mockVariant,
        stock: 10,
      });
      mockPrisma.cartItem.findUnique.mockResolvedValueOnce(existingItem);

      // 8 + 5 = 13 > stock 10
      await expect(
        service.addToCart('user-1', { variantId: 'variant-1', quantity: 5 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────
  // updateCartItem
  // ─────────────────────────────────────────────
  describe('updateCartItem', () => {
    beforeEach(() => {
      jest
        .spyOn(service, 'getCartWithTotals')
        .mockResolvedValue(mockCartWithTotals as any);
    });

    it('actualiza la cantidad del item exitosamente', async () => {
      mockPrisma.cartItem.findFirst.mockResolvedValueOnce(mockCartItem);
      mockPrisma.cartItem.update.mockResolvedValueOnce({});

      await service.updateCartItem('user-1', 'item-1', { quantity: 3 });

      expect(mockPrisma.cartItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ quantity: 3 }),
        }),
      );
    });

    it('lanza NotFoundException si el item no existe o no pertenece al usuario', async () => {
      mockPrisma.cartItem.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.updateCartItem('user-1', 'item-inexistente', { quantity: 1 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza BadRequestException si el item ya expiró', async () => {
      const expiredItem = {
        ...mockCartItem,
        expiresAt: new Date(Date.now() - 1000), // expiró hace 1 segundo
      };
      mockPrisma.cartItem.findFirst.mockResolvedValueOnce(expiredItem);

      await expect(
        service.updateCartItem('user-1', 'item-1', { quantity: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si la cantidad supera el stock disponible', async () => {
      const itemWithLowStock = {
        ...mockCartItem,
        variant: { ...mockCartItem.variant, stock: 3 },
      };
      mockPrisma.cartItem.findFirst.mockResolvedValueOnce(itemWithLowStock);

      await expect(
        service.updateCartItem('user-1', 'item-1', { quantity: 10 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────
  // removeCartItem
  // ─────────────────────────────────────────────
  describe('removeCartItem', () => {
    beforeEach(() => {
      jest
        .spyOn(service, 'getCartWithTotals')
        .mockResolvedValue(mockCartWithTotals as any);
    });

    it('elimina el item del carrito exitosamente', async () => {
      mockPrisma.cartItem.findFirst.mockResolvedValueOnce(mockCartItem);
      mockPrisma.cartItem.delete.mockResolvedValueOnce({});

      await service.removeCartItem('user-1', 'item-1');

      expect(mockPrisma.cartItem.delete).toHaveBeenCalledWith({
        where: { id: 'item-1' },
      });
    });

    it('lanza NotFoundException si el item no existe', async () => {
      mockPrisma.cartItem.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.removeCartItem('user-1', 'item-inexistente'),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.cartItem.delete).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // clearCart
  // ─────────────────────────────────────────────
  describe('clearCart', () => {
    it('vacía todos los items del carrito', async () => {
      jest
        .spyOn(service, 'getOrCreateCart')
        .mockResolvedValue(mockCart as any);
      jest.spyOn(service, 'getCartWithTotals').mockResolvedValue({
        ...mockCart,
        items: [],
        subtotal: 0,
        totalItems: 0,
      } as any);
      mockPrisma.cartItem.deleteMany.mockResolvedValueOnce({ count: 2 });

      await service.clearCart('user-1');

      expect(mockPrisma.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { cartId: 'cart-1' },
      });
    });
  });

  // ─────────────────────────────────────────────
  // cleanupExpiredItems
  // ─────────────────────────────────────────────
  describe('cleanupExpiredItems', () => {
    it('elimina todos los items expirados de todos los carritos', async () => {
      mockPrisma.cartItem.deleteMany.mockResolvedValueOnce({ count: 5 });

      const result = await service.cleanupExpiredItems();

      expect(result.deletedCount).toBe(5);
      expect(mockPrisma.cartItem.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            expiresAt: expect.objectContaining({ lt: expect.any(Date) }),
          }),
        }),
      );
    });

    it('devuelve deletedCount: 0 si no hay items expirados', async () => {
      mockPrisma.cartItem.deleteMany.mockResolvedValueOnce({ count: 0 });

      const result = await service.cleanupExpiredItems();

      expect(result.deletedCount).toBe(0);
    });
  });
});
