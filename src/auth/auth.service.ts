import { Injectable, UnauthorizedException } from '@nestjs/common';
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
    // Payload del JWT (lo que se codifica en el token)
    const payload = {
      sub: user.id, // "subject" - ID del usuario (estándar JWT)
      email: user.email, // Email para referencia
      role: user.role, // Rol para autorización
    };

    // Generar el JWT (access token)
    const accessToken = this.jwtService.sign(payload);

    // Generar el refresh token y guardarlo en DB
    const refreshToken = await this.generateRefreshToken(user.id);

    // Calcular tiempo de expiración en segundos
    const expiresIn = this.getTokenExpirationInSeconds(
      this.configService.get('JWT_EXPIRES_IN') || '15m',
    );

    // Retornar respuesta formateada
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
  }

  /**
   * Valida refresh token y genera nuevo access token
   *
   * @param refreshToken - Token de refresco a validar
   * @returns LoginResponseDto con nuevos tokens
   * @throws UnauthorizedException si el token es inválido o expiró
   */
  async refreshAccessToken(refreshToken: string): Promise<LoginResponseDto> {
    // Buscar el token en la base de datos
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    // Validar que el token existe
    if (!storedToken) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    // Validar que no haya expirado
    if (new Date() > storedToken.expiresAt) {
      // Eliminar token expirado de la DB
      await this.prisma.refreshToken.delete({
        where: { id: storedToken.id },
      });
      throw new UnauthorizedException('Refresh token expirado');
    }

    // Validar que el usuario esté activo
    if (!storedToken.user.isActive) {
      throw new UnauthorizedException('Usuario inactivo');
    }

    // Eliminar el refresh token viejo (rotación de tokens)
    await this.prisma.refreshToken.delete({
      where: { id: storedToken.id },
    });

    // Generar nuevos tokens
    return this.login(storedToken.user);
  }

  /**
   * Revoca un refresh token específico (logout de una sesión)
   *
   * @param token - Refresh token a revocar
   */
  async revokeRefreshToken(token: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { token },
    });
  }

  /**
   * Revoca todos los refresh tokens de un usuario (logout de todas las sesiones)
   *
   * @param userId - ID del usuario
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }

  /**
   * Genera un refresh token aleatorio y lo guarda en DB
   *
   * @param userId - ID del usuario para asociar el token
   * @returns Token generado (string hexadecimal)
   */
  private async generateRefreshToken(userId: string): Promise<string> {
    // Generar token aleatorio de 128 caracteres
    const token = randomBytes(64).toString('hex');

    // Obtener tiempo de expiración del refresh token desde .env
    const expiresIn =
      this.configService.get<string>('REFRESH_TOKEN_EXPIRES_IN') || '7d';
    const expirationSeconds = this.getTokenExpirationInSeconds(expiresIn);
    const expiresAt = new Date(Date.now() + expirationSeconds * 1000);

    // Guardar en la base de datos
    await this.prisma.refreshToken.create({
      data: {
        token,
        userId,
        expiresAt,
      },
    });

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
    // Parsear el string de expiración
    const timeValue = parseInt(expiration.slice(0, -1), 10);
    const timeUnit = expiration.slice(-1);

    // Convertir a segundos según la unidad
    switch (timeUnit) {
      case 'd': // días
        return timeValue * 24 * 60 * 60;
      case 'h': // horas
        return timeValue * 60 * 60;
      case 'm': // minutos
        return timeValue * 60;
      case 's': // segundos
        return timeValue;
      default:
        return 7 * 24 * 60 * 60; // Default: 7 días
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
    // TODO: Implementar si agregas login con email/password
    // Por ahora solo usamos Google OAuth
    return null;
  }
}
