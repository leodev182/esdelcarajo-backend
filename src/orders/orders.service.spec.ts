import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { OrderStatus, PaymentMethod, Role } from '@prisma/client';

const mockPrisma = {
  cart: { findUnique: jest.fn() },
  address: { findFirst: jest.fn() },
  order: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  productVariant: {
    update: jest.fn(),
    findUnique: jest.fn(),
  },
  cartItem: { deleteMany: jest.fn() },
};

const mockMailService = {
  sendOrderCreatedEmail: jest.fn().mockResolvedValue(undefined),
  sendOrderStatusEmail: jest.fn().mockResolvedValue(undefined),
};

const mockVariant = {
  id: 'var-1',
  productId: 'prod-1',
  price: 25.0,
  stock: 10,
  isActive: true,
  size: 'M',
  color: 'Negro',
  gender: 'MEN',
  product: { id: 'prod-1', name: 'Franela Del Carajo', isActive: true },
};

const mockCartWithItems = {
  id: 'cart-1',
  userId: 'user-1',
  items: [
    { id: 'item-1', cartId: 'cart-1', variantId: 'var-1', quantity: 2, variant: mockVariant },
  ],
};

const mockAddress = {
  id: 'addr-1',
  userId: 'user-1',
  isActive: true,
  street: 'Av. Principal',
  city: 'Caracas',
};

const mockOrder = {
  id: 'order-1',
  userId: 'user-1',
  addressId: 'addr-1',
  status: OrderStatus.PENDING_PAYMENT,
  subtotal: 50.0,
  total: 50.0,
  paymentMethod: PaymentMethod.ZELLE,
  items: [],
  address: mockAddress,
  user: { id: 'user-1', email: 'test@delcarajo.com', name: 'Test', phone: null },
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('OrdersService', () => {
  let service: OrdersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    jest.clearAllMocks();
  });

  it('debería estar definido', () => {
    expect(service).toBeDefined();
  });

  // ─────────────────────────────────────────────
  // createOrder
  // ─────────────────────────────────────────────
  describe('createOrder', () => {
    const dto = { addressId: 'addr-1', paymentMethod: PaymentMethod.ZELLE };

    beforeEach(() => {
      mockPrisma.cart.findUnique.mockResolvedValue(mockCartWithItems);
      mockPrisma.address.findFirst.mockResolvedValue(mockAddress);
      mockPrisma.order.create.mockResolvedValue(mockOrder);
      mockPrisma.productVariant.update.mockResolvedValue({});
      mockPrisma.productVariant.findUnique.mockResolvedValue({ ...mockVariant, stock: 8 });
      mockPrisma.cartItem.deleteMany.mockResolvedValue({ count: 1 });
    });

    it('crea la orden correctamente y vacía el carrito', async () => {
      const result = await service.createOrder('user-1', dto);

      expect(result.id).toBe('order-1');
      expect(mockPrisma.order.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { cartId: 'cart-1' },
      });
    });

    it('decrementa el stock de cada variante', async () => {
      await service.createOrder('user-1', dto);

      expect(mockPrisma.productVariant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'var-1' },
          data: { stock: { decrement: 2 } },
        }),
      );
    });

    it('envía email de confirmación al usuario', async () => {
      await service.createOrder('user-1', dto);

      expect(mockMailService.sendOrderCreatedEmail).toHaveBeenCalledWith(
        'test@delcarajo.com',
        'Test',
        'order-1',
        50,
      );
    });

    it('lanza BadRequestException si el carrito está vacío', async () => {
      mockPrisma.cart.findUnique.mockResolvedValueOnce({ id: 'cart-1', userId: 'user-1', items: [] });

      await expect(service.createOrder('user-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lanza BadRequestException si el carrito no existe', async () => {
      mockPrisma.cart.findUnique.mockResolvedValueOnce(null);

      await expect(service.createOrder('user-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lanza NotFoundException si la dirección no pertenece al usuario', async () => {
      mockPrisma.address.findFirst.mockResolvedValueOnce(null);

      await expect(service.createOrder('user-1', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lanza BadRequestException si un producto del carrito está inactivo', async () => {
      const inactiveProductCart = {
        ...mockCartWithItems,
        items: [
          {
            ...mockCartWithItems.items[0],
            variant: {
              ...mockVariant,
              product: { ...mockVariant.product, isActive: false },
            },
          },
        ],
      };
      mockPrisma.cart.findUnique.mockResolvedValueOnce(inactiveProductCart);

      await expect(service.createOrder('user-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lanza BadRequestException si el stock es insuficiente', async () => {
      const lowStockCart = {
        ...mockCartWithItems,
        items: [
          {
            ...mockCartWithItems.items[0],
            quantity: 20, // más que el stock disponible (10)
            variant: mockVariant,
          },
        ],
      };
      mockPrisma.cart.findUnique.mockResolvedValueOnce(lowStockCart);

      await expect(service.createOrder('user-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─────────────────────────────────────────────
  // getOrderById
  // ─────────────────────────────────────────────
  describe('getOrderById', () => {
    it('devuelve la orden si pertenece al usuario', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce(mockOrder);

      const result = await service.getOrderById('order-1', 'user-1', Role.USER);

      expect(result.id).toBe('order-1');
    });

    it('permite a un ADMIN ver órdenes de cualquier usuario', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce(mockOrder);

      const result = await service.getOrderById('order-1', 'otro-user', Role.ADMIN);

      expect(result.id).toBe('order-1');
    });

    it('lanza NotFoundException si la orden no existe', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.getOrderById('orden-inexistente', 'user-1', Role.USER),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza ForbiddenException si un USER intenta ver la orden de otro', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce(mockOrder); // pertenece a 'user-1'

      await expect(
        service.getOrderById('order-1', 'otro-user', Role.USER),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─────────────────────────────────────────────
  // updateOrderStatus
  // ─────────────────────────────────────────────
  describe('updateOrderStatus', () => {
    beforeEach(() => {
      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
      mockPrisma.order.update.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.PAGO_CONFIRMADO,
        user: mockOrder.user,
      });
    });

    it('lanza ForbiddenException si un USER intenta actualizar', async () => {
      await expect(
        service.updateOrderStatus(
          'order-1',
          { status: OrderStatus.PAGO_CONFIRMADO },
          Role.USER,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lanza NotFoundException si la orden no existe', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.updateOrderStatus(
          'orden-inexistente',
          { status: OrderStatus.PAGO_CONFIRMADO },
          Role.ADMIN,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('actualiza el estado y envía email para PAGO_CONFIRMADO', async () => {
      await service.updateOrderStatus(
        'order-1',
        { status: OrderStatus.PAGO_CONFIRMADO },
        Role.ADMIN,
      );

      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: OrderStatus.PAGO_CONFIRMADO,
            paidAt: expect.any(Date),
          }),
        }),
      );
      expect(mockMailService.sendOrderStatusEmail).toHaveBeenCalled();
    });

    it('actualiza shippedAt cuando el estado es EN_CAMINO', async () => {
      mockPrisma.order.update.mockResolvedValueOnce({
        ...mockOrder,
        status: OrderStatus.EN_CAMINO,
        user: mockOrder.user,
      });

      await service.updateOrderStatus(
        'order-1',
        { status: OrderStatus.EN_CAMINO },
        Role.ADMIN,
      );

      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ shippedAt: expect.any(Date) }),
        }),
      );
    });

    it('no envía email para estado CANCELADO', async () => {
      mockPrisma.order.update.mockResolvedValueOnce({
        ...mockOrder,
        status: OrderStatus.CANCELADO,
        user: mockOrder.user,
      });

      await service.updateOrderStatus(
        'order-1',
        { status: OrderStatus.CANCELADO },
        Role.ADMIN,
      );

      expect(mockMailService.sendOrderStatusEmail).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // updatePaymentProof
  // ─────────────────────────────────────────────
  describe('updatePaymentProof', () => {
    it('actualiza el comprobante si la orden está PENDING_PAYMENT', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce(mockOrder);
      mockPrisma.order.update.mockResolvedValueOnce({
        ...mockOrder,
        paymentProof: 'https://cloudinary.com/proof.jpg',
      });

      const result = await service.updatePaymentProof(
        'order-1',
        'user-1',
        'https://cloudinary.com/proof.jpg',
      );

      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { paymentProof: 'https://cloudinary.com/proof.jpg' },
        }),
      );
    });

    it('lanza NotFoundException si la orden no existe', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.updatePaymentProof('orden-inexistente', 'user-1', 'url'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza ForbiddenException si la orden no pertenece al usuario', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce(mockOrder); // pertenece a 'user-1'

      await expect(
        service.updatePaymentProof('order-1', 'otro-user', 'url'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lanza BadRequestException si la orden no está en PENDING_PAYMENT', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce({
        ...mockOrder,
        status: OrderStatus.PAGO_CONFIRMADO,
      });

      await expect(
        service.updatePaymentProof('order-1', 'user-1', 'url'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────
  // getAllOrders
  // ─────────────────────────────────────────────
  describe('getAllOrders', () => {
    it('lanza ForbiddenException si un USER intenta ver todas las órdenes', async () => {
      await expect(service.getAllOrders({}, Role.USER)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('devuelve todas las órdenes paginadas para un ADMIN', async () => {
      mockPrisma.order.findMany.mockResolvedValueOnce([mockOrder]);
      mockPrisma.order.count.mockResolvedValueOnce(1);

      const result = await service.getAllOrders({ page: 1, limit: 10 }, Role.ADMIN);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });
});
