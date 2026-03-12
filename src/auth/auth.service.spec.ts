import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

const mockPrisma = {
  refreshToken: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-access-token'),
};

const mockConfigService = {
  get: jest.fn().mockImplementation((key: string) => {
    const config: Record<string, string> = {
      JWT_EXPIRES_IN: '15m',
      REFRESH_TOKEN_EXPIRES_IN: '7d',
    };
    return config[key];
  }),
};

const mockUser = {
  id: 'user-1',
  email: 'test@delcarajo.com',
  name: 'Test User',
  nickname: null,
  avatar: null,
  phone: null,
  googleId: 'google-123',
  role: Role.USER,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
    mockJwtService.sign.mockReturnValue('mock-access-token');
  });

  it('debería estar definido', () => {
    expect(service).toBeDefined();
  });

  // ─────────────────────────────────────────────
  // login
  // ─────────────────────────────────────────────
  describe('login', () => {
    beforeEach(() => {
      mockPrisma.refreshToken.create.mockResolvedValue({
        token: 'mock-refresh-token',
        userId: 'user-1',
        expiresAt: new Date(),
      });
    });

    it('devuelve access_token, refresh_token y datos del usuario', async () => {
      const result = await service.login(mockUser);

      expect(result.access_token).toBe('mock-access-token');
      expect(result.token_type).toBe('Bearer');
      expect(result.user.email).toBe('test@delcarajo.com');
      expect(result.user.role).toBe(Role.USER);
    });

    it('genera el payload JWT con sub, email y role', async () => {
      await service.login(mockUser);

      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: 'user-1',
        email: 'test@delcarajo.com',
        role: Role.USER,
      });
    });

    it('guarda el refresh token en la DB', async () => {
      await service.login(mockUser);

      expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'user-1' }),
        }),
      );
    });

    it('calcula expires_in en segundos para "15m" → 900', async () => {
      const result = await service.login(mockUser);

      expect(result.expires_in).toBe(900);
    });
  });

  // ─────────────────────────────────────────────
  // refreshAccessToken
  // ─────────────────────────────────────────────
  describe('refreshAccessToken', () => {
    const validStoredToken = {
      id: 'rt-1',
      token: 'valid-refresh-token',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24), // expira mañana
      user: mockUser,
    };

    it('renueva el access token cuando el refresh token es válido', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValueOnce(validStoredToken);
      mockPrisma.refreshToken.delete.mockResolvedValueOnce({});
      mockPrisma.refreshToken.create.mockResolvedValueOnce({});

      const result = await service.refreshAccessToken('valid-refresh-token');

      expect(result.access_token).toBe('mock-access-token');
      expect(result.user.email).toBe('test@delcarajo.com');
    });

    it('elimina el refresh token usado antes de generar uno nuevo', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValueOnce(validStoredToken);
      mockPrisma.refreshToken.delete.mockResolvedValueOnce({});
      mockPrisma.refreshToken.create.mockResolvedValueOnce({});

      await service.refreshAccessToken('valid-refresh-token');

      expect(mockPrisma.refreshToken.delete).toHaveBeenCalledWith({
        where: { id: 'rt-1' },
      });
    });

    it('lanza UnauthorizedException si el token no existe', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.refreshAccessToken('token-inexistente'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('lanza UnauthorizedException y elimina el token si ya expiró', async () => {
      const expiredToken = {
        ...validStoredToken,
        expiresAt: new Date(Date.now() - 1000), // expiró hace 1 segundo
      };
      mockPrisma.refreshToken.findUnique.mockResolvedValueOnce(expiredToken);
      mockPrisma.refreshToken.delete.mockResolvedValueOnce({});

      await expect(
        service.refreshAccessToken('expired-token'),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.refreshToken.delete).toHaveBeenCalledWith({
        where: { id: 'rt-1' },
      });
    });

    it('lanza UnauthorizedException si el usuario está inactivo', async () => {
      const inactiveUserToken = {
        ...validStoredToken,
        user: { ...mockUser, isActive: false },
      };
      mockPrisma.refreshToken.findUnique.mockResolvedValueOnce(inactiveUserToken);

      await expect(
        service.refreshAccessToken('valid-refresh-token'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─────────────────────────────────────────────
  // revokeRefreshToken
  // ─────────────────────────────────────────────
  describe('revokeRefreshToken', () => {
    it('llama deleteMany con el token correcto', async () => {
      mockPrisma.refreshToken.deleteMany.mockResolvedValueOnce({ count: 1 });

      await service.revokeRefreshToken('some-token');

      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { token: 'some-token' },
      });
    });

    it('no lanza error si el token no existía', async () => {
      mockPrisma.refreshToken.deleteMany.mockResolvedValueOnce({ count: 0 });

      await expect(
        service.revokeRefreshToken('token-inexistente'),
      ).resolves.not.toThrow();
    });
  });

  // ─────────────────────────────────────────────
  // revokeAllUserTokens
  // ─────────────────────────────────────────────
  describe('revokeAllUserTokens', () => {
    it('elimina todos los tokens del usuario', async () => {
      mockPrisma.refreshToken.deleteMany.mockResolvedValueOnce({ count: 3 });

      await service.revokeAllUserTokens('user-1');

      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });
  });
});
