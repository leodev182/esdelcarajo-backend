import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
};

const mockUser = {
  id: 'user-1',
  email: 'test@delcarajo.com',
  name: 'Test User',
  nickname: null,
  avatar: null,
  phone: null,
  role: Role.USER,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  it('debería estar definido', () => {
    expect(service).toBeDefined();
  });

  // ─────────────────────────────────────────────
  // getAllUsers
  // ─────────────────────────────────────────────
  describe('getAllUsers', () => {
    it('devuelve todos los usuarios con total correcto', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([
        mockUser,
        { ...mockUser, id: 'user-2' },
      ]);

      const result = await service.getAllUsers();

      expect(result.total).toBe(2);
      expect(result.users).toHaveLength(2);
    });

    it('devuelve total 0 cuando no hay usuarios', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([]);

      const result = await service.getAllUsers();

      expect(result.total).toBe(0);
    });
  });

  // ─────────────────────────────────────────────
  // getUserById
  // ─────────────────────────────────────────────
  describe('getUserById', () => {
    it('devuelve el usuario cuando existe', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser);

      const result = await service.getUserById('user-1');

      expect(result.id).toBe('user-1');
      expect(result.email).toBe('test@delcarajo.com');
    });

    it('lanza NotFoundException si el usuario no existe', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(service.getUserById('id-inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─────────────────────────────────────────────
  // updateUserRole
  // ─────────────────────────────────────────────
  describe('updateUserRole', () => {
    it('actualiza el rol del usuario exitosamente', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser);
      mockPrisma.user.update.mockResolvedValueOnce({
        ...mockUser,
        role: Role.ADMIN,
      });

      const result = await service.updateUserRole('user-1', { role: Role.ADMIN });

      expect(result.message).toBe('Rol de usuario actualizado exitosamente');
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { role: Role.ADMIN } }),
      );
    });

    it('lanza NotFoundException si el usuario no existe', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.updateUserRole('id-inexistente', { role: Role.ADMIN }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // toggleUserBan
  // ─────────────────────────────────────────────
  describe('toggleUserBan', () => {
    it('banea a un usuario activo (isActive: true → false)', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        ...mockUser,
        isActive: true,
      });
      mockPrisma.user.update.mockResolvedValueOnce({
        ...mockUser,
        isActive: false,
      });

      const result = await service.toggleUserBan('user-1');

      expect(result.message).toBe('Usuario baneado exitosamente');
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: false } }),
      );
    });

    it('desbanea a un usuario inactivo (isActive: false → true)', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        ...mockUser,
        isActive: false,
      });
      mockPrisma.user.update.mockResolvedValueOnce({
        ...mockUser,
        isActive: true,
      });

      const result = await service.toggleUserBan('user-1');

      expect(result.message).toBe('Usuario desbaneado exitosamente');
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: true } }),
      );
    });

    it('lanza NotFoundException si el usuario no existe', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(service.toggleUserBan('id-inexistente')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // getMyProfile
  // ─────────────────────────────────────────────
  describe('getMyProfile', () => {
    it('devuelve el perfil del usuario autenticado', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser);

      const result = await service.getMyProfile('user-1');

      expect(result.id).toBe('user-1');
      expect(result.email).toBe('test@delcarajo.com');
    });

    it('lanza NotFoundException si el usuario no existe', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(service.getMyProfile('id-inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─────────────────────────────────────────────
  // updateMyProfile
  // ─────────────────────────────────────────────
  describe('updateMyProfile', () => {
    it('actualiza el perfil correctamente', async () => {
      const updateDto = { name: 'Nuevo Nombre', nickname: 'newnick' };
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser);
      mockPrisma.user.update.mockResolvedValueOnce({
        ...mockUser,
        ...updateDto,
      });

      const result = await service.updateMyProfile('user-1', updateDto);

      expect(result.message).toBe('Perfil actualizado exitosamente');
      expect(result.user.name).toBe('Nuevo Nombre');
    });

    it('lanza NotFoundException si el usuario no existe', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.updateMyProfile('id-inexistente', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });
});
