import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LoginResponseDto } from './dto/login-response.dto';
import { randomBytes } from 'crypto';

/**
 * Servicio de autenticación
 *
 * Responsabilidades:
 * - Generar tokens JWT (access + refresh)
 * - Validar y renovar tokens
 * - Revocar tokens (logout)
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  /**
   * Genera access token y refresh token para un usuario
   *
   * @param user - Usuario autenticado desde la base de datos
   * @returns LoginResponseDto con tokens y datos del usuario
   */
  async login(user: User): Promise<LoginResponseDto> {
    this.logger.log(`Generando tokens para usuario ${user.email} (${user.id})`);

    try {
      const payload = {
        sub: user.id,
        email: user.email,
        role: user.role,
      };

      const accessToken = this.jwtService.sign(payload);
      const refreshToken = await this.generateRefreshToken(user.id);

      const expiresIn = this.getTokenExpirationInSeconds(
        this.configService.get('JWT_EXPIRES_IN') || '15m',
      );

      this.logger.log(
        `Tokens generados exitosamente para ${user.email} - Rol: ${user.role}`,
      );

      return {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: expiresIn,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          role: user.role,
        },
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(
        `Error generando tokens para ${user.email}`,
        err.stack,
        { userId: user.id, email: user.email },
      );
      throw error;
    }
  }

  /**
   * Valida refresh token y genera nuevo access token
   *
   * @param refreshToken - Token de refresco a validar
   * @returns LoginResponseDto con nuevos tokens
   * @throws UnauthorizedException si el token es inválido o expiró
   */
  async refreshAccessToken(refreshToken: string): Promise<LoginResponseDto> {
    this.logger.log('Validando refresh token');

    try {
      const storedToken = await this.prisma.refreshToken.findUnique({
        where: { token: refreshToken },
        include: { user: true },
      });

      if (!storedToken) {
        this.logger.warn('Intento de refresh con token inválido');
        throw new UnauthorizedException('Refresh token inválido');
      }

      if (new Date() > storedToken.expiresAt) {
        this.logger.warn(
          `Refresh token expirado para usuario ${storedToken.userId}`,
        );
        await this.prisma.refreshToken.delete({
          where: { id: storedToken.id },
        });
        throw new UnauthorizedException('Refresh token expirado');
      }

      if (!storedToken.user.isActive) {
        this.logger.warn(
          `Usuario inactivo intentó renovar token: ${storedToken.user.email}`,
        );
        throw new UnauthorizedException('Usuario inactivo');
      }

      await this.prisma.refreshToken.delete({
        where: { id: storedToken.id },
      });

      this.logger.log(
        `Token renovado exitosamente para ${storedToken.user.email}`,
      );

      return this.login(storedToken.user);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error('Error renovando access token', err.stack);
      throw error;
    }
  }

  /**
   * Revoca un refresh token específico (logout de una sesión)
   *
   * @param token - Refresh token a revocar
   */
  async revokeRefreshToken(token: string): Promise<void> {
    this.logger.log('Revocando refresh token');

    try {
      const result = await this.prisma.refreshToken.deleteMany({
        where: { token },
      });

      if (result.count > 0) {
        this.logger.log(`Refresh token revocado exitosamente`);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error('Error revocando refresh token', err.stack);
      throw error;
    }
  }

  /**
   * Revoca todos los refresh tokens de un usuario (logout de todas las sesiones)
   *
   * @param userId - ID del usuario
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    this.logger.log(`Revocando todos los tokens del usuario ${userId}`);

    try {
      const result = await this.prisma.refreshToken.deleteMany({
        where: { userId },
      });

      this.logger.log(
        `${result.count} tokens revocados para usuario ${userId}`,
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(
        `Error revocando tokens del usuario ${userId}`,
        err.stack,
        { userId },
      );
      throw error;
    }
  }

  /**
   * Genera un refresh token aleatorio y lo guarda en DB
   *
   * @param userId - ID del usuario para asociar el token
   * @returns Token generado (string hexadecimal)
   */
  private async generateRefreshToken(userId: string): Promise<string> {
    const token = randomBytes(64).toString('hex');

    const expiresIn =
      this.configService.get<string>('REFRESH_TOKEN_EXPIRES_IN') || '7d';
    const expirationSeconds = this.getTokenExpirationInSeconds(expiresIn);
    const expiresAt = new Date(Date.now() + expirationSeconds * 1000);

    await this.prisma.refreshToken.create({
      data: {
        token,
        userId,
        expiresAt,
      },
    });

    this.logger.log(`Refresh token generado para usuario ${userId}`);

    return token;
  }

  /**
   * Calcula el tiempo de expiración del token en segundos
   *
   * Lee el formato del .env (ej: "7d", "24h", "15m", "3600s")
   * y lo convierte a segundos
   *
   * @param expiration - String de expiración (ej: "7d", "24h")
   * @returns Tiempo de expiración en segundos
   */
  private getTokenExpirationInSeconds(expiration: string): number {
    const timeValue = parseInt(expiration.slice(0, -1), 10);
    const timeUnit = expiration.slice(-1);

    switch (timeUnit) {
      case 'd':
        return timeValue * 24 * 60 * 60;
      case 'h':
        return timeValue * 60 * 60;
      case 'm':
        return timeValue * 60;
      case 's':
        return timeValue;
      default:
        return 7 * 24 * 60 * 60;
    }
  }

  /**
   * Valida las credenciales de un usuario (placeholder)
   *
   * En nuestro caso, GoogleStrategy hace esta validación
   * Este método podría usarse para login tradicional (email/password)
   * que agregaríamos en el futuro
   *
   * @param email - Email del usuario
   * @param password - Contraseña del usuario
   * @returns Usuario si las credenciales son válidas, null si no
   */
  validateUser(email: string, password: string): Promise<User | null> {
    return null;
  }
}
