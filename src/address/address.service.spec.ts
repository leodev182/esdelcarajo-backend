import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AddressService } from './address.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  address: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
};

const mockUser = {
  id: 'user-1',
  email: 'test@delcarajo.com',
  name: 'Test User',
  phone: null,
  isActive: true,
};

const mockAddress = {
  id: 'addr-1',
  userId: 'user-1',
  fullName: 'Test User',
  phone: '+58 412 1234567',
  state: 'Miranda',
  city: 'Caracas',
  addressLine1: 'Av. Principal 123',
  addressLine2: null,
  isDefault: false,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const baseDto = {
  fullName: 'Test User',
  phone: '+58 412 1234567',
  state: 'Miranda',
  city: 'Caracas',
  addressLine1: 'Av. Principal 123',
  isDefault: false,
};

describe('AddressService', () => {
  let service: AddressService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AddressService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AddressService>(AddressService);
    jest.clearAllMocks();
  });

  it('debería estar definido', () => {
    expect(service).toBeDefined();
  });

  // ─────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────
  describe('create', () => {
    it('crea una dirección exitosamente', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser);
      mockPrisma.address.create.mockResolvedValueOnce(mockAddress);

      const result = await service.create('user-1', baseDto as any);

      expect(result.id).toBe('addr-1');
      expect(mockPrisma.address.create).toHaveBeenCalledTimes(1);
    });

    it('desmarca otras direcciones predeterminadas cuando isDefault es true', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser);
      mockPrisma.address.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.address.create.mockResolvedValueOnce({
        ...mockAddress,
        isDefault: true,
      });

      await service.create('user-1', { ...baseDto, isDefault: true } as any);

      expect(mockPrisma.address.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-1', isActive: true }),
          data: { isDefault: false },
        }),
      );
    });

    it('guarda el teléfono del usuario si no tenía uno registrado', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        ...mockUser,
        phone: null,
      });
      mockPrisma.user.update.mockResolvedValueOnce({});
      mockPrisma.address.create.mockResolvedValueOnce(mockAddress);

      await service.create('user-1', baseDto as any);

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { phone: baseDto.phone },
        }),
      );
    });

    it('no actualiza el teléfono si el usuario ya tiene uno', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        ...mockUser,
        phone: '+58 414 9999999',
      });
      mockPrisma.address.create.mockResolvedValueOnce(mockAddress);

      await service.create('user-1', baseDto as any);

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('lanza NotFoundException si el usuario no existe', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.create('id-inexistente', baseDto as any),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.address.create).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // findAllByUser
  // ─────────────────────────────────────────────
  describe('findAllByUser', () => {
    it('devuelve las direcciones activas del usuario ordenadas', async () => {
      mockPrisma.address.findMany.mockResolvedValueOnce([mockAddress]);

      const result = await service.findAllByUser('user-1');

      expect(result).toHaveLength(1);
      expect(mockPrisma.address.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', isActive: true },
        }),
      );
    });

    it('devuelve array vacío si el usuario no tiene direcciones activas', async () => {
      mockPrisma.address.findMany.mockResolvedValueOnce([]);

      const result = await service.findAllByUser('user-1');

      expect(result).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────
  // findOne
  // ─────────────────────────────────────────────
  describe('findOne', () => {
    it('devuelve la dirección cuando existe y pertenece al usuario', async () => {
      mockPrisma.address.findFirst.mockResolvedValueOnce(mockAddress);

      const result = await service.findOne('addr-1', 'user-1');

      expect(result.id).toBe('addr-1');
    });

    it('lanza NotFoundException si la dirección no existe o no pertenece al usuario', async () => {
      mockPrisma.address.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.findOne('addr-otro-user', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────
  describe('update', () => {
    it('actualiza la dirección exitosamente', async () => {
      const updateDto = { city: 'Maracaibo' };
      mockPrisma.address.findFirst.mockResolvedValueOnce(mockAddress);
      mockPrisma.address.update.mockResolvedValueOnce({
        ...mockAddress,
        ...updateDto,
      });

      const result = await service.update('addr-1', 'user-1', updateDto as any);

      expect(result.city).toBe('Maracaibo');
    });

    it('desmarca otras direcciones cuando isDefault es true', async () => {
      mockPrisma.address.findFirst.mockResolvedValueOnce(mockAddress);
      mockPrisma.address.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.address.update.mockResolvedValueOnce({
        ...mockAddress,
        isDefault: true,
      });

      await service.update('addr-1', 'user-1', { isDefault: true } as any);

      expect(mockPrisma.address.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            id: { not: 'addr-1' },
          }),
          data: { isDefault: false },
        }),
      );
    });

    it('lanza NotFoundException si la dirección no existe', async () => {
      mockPrisma.address.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.update('addr-inexistente', 'user-1', {
          city: 'X',
        } as any),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.address.update).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // setAsDefault
  // ─────────────────────────────────────────────
  describe('setAsDefault', () => {
    it('marca la dirección como predeterminada y desmarca las demás', async () => {
      mockPrisma.address.findFirst.mockResolvedValueOnce(mockAddress);
      mockPrisma.address.updateMany.mockResolvedValueOnce({ count: 2 });
      mockPrisma.address.update.mockResolvedValueOnce({
        ...mockAddress,
        isDefault: true,
      });

      await service.setAsDefault('addr-1', 'user-1');

      expect(mockPrisma.address.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            isActive: true,
          }),
          data: { isDefault: false },
        }),
      );
      expect(mockPrisma.address.update).toHaveBeenCalledWith({
        where: { id: 'addr-1' },
        data: { isDefault: true },
      });
    });

    it('lanza NotFoundException si la dirección no existe', async () => {
      mockPrisma.address.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.setAsDefault('addr-inexistente', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────
  // remove
  // ─────────────────────────────────────────────
  describe('remove', () => {
    it('desactiva la dirección (soft delete con isActive: false)', async () => {
      mockPrisma.address.findFirst.mockResolvedValueOnce(mockAddress);
      mockPrisma.address.update.mockResolvedValueOnce({
        ...mockAddress,
        isActive: false,
      });

      await service.remove('addr-1', 'user-1');

      expect(mockPrisma.address.update).toHaveBeenCalledWith({
        where: { id: 'addr-1' },
        data: { isActive: false },
      });
    });

    it('lanza NotFoundException si la dirección no existe', async () => {
      mockPrisma.address.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.remove('addr-inexistente', 'user-1'),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.address.update).not.toHaveBeenCalled();
    });
  });
});
