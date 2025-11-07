import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { LoginResponseDto } from './dto/login-response.dto';

/**
 * Servicio de autenticación
 *
 * Responsabilidades:
 * - Generar tokens JWT
 * - Crear respuestas de login con formato estandarizado
 * - Validar usuarios (lo hace GoogleStrategy, pero está centralizado aquí)
 */
@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  /**
   * Genera un token JWT para un usuario
   *
   * @param user - Usuario autenticado desde la base de datos
   * @returns LoginResponseDto con token y datos del usuario
   */
  login(user: User): LoginResponseDto {
    // Payload del JWT (lo que se codifica en el token)
    const payload = {
      sub: user.id, // "subject" - ID del usuario (estándar JWT)
      email: user.email, // Email para referencia
      role: user.role, // Rol para autorización
    };

    // Generar el JWT
    const accessToken = this.jwtService.sign(payload);

    // Calcular tiempo de expiración en segundos
    const expiresIn = this.getTokenExpirationInSeconds();

    // Retornar respuesta formateada
    return {
      access_token: accessToken,
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
   * Calcula el tiempo de expiración del token en segundos
   *
   * Lee JWT_EXPIRATION del .env (ej: "7d", "24h", "3600s")
   * y lo convierte a segundos
   *
   * @returns Tiempo de expiración en segundos
   */
  private getTokenExpirationInSeconds(): number {
    const expiration = process.env.JWT_EXPIRATION || '7d';

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
