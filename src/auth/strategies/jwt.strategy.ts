import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '@prisma/client';

/**
 * Interface que define la estructura del payload del JWT
 */
interface JwtPayload {
  sub: string; // User ID
  email: string; // Email del usuario
  role: Role; // Rol del usuario (enum de Prisma)
  iat?: number; // Issued at (timestamp)
  exp?: number; // Expiration (timestamp)
}

/**
 * Estrategia JWT para validar tokens en requests protegidos
 *
 * Flujo:
 * 1. Extrae el token del header Authorization
 * 2. Valida la firma con JWT_SECRET
 * 3. Decodifica el payload
 * 4. Busca el usuario en DB
 * 5. Adjunta el usuario a req.user
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private prisma: PrismaService) {
    super({
      // Extraer token del header: "Authorization: Bearer <token>"
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      // Si el token expiró, lanzar error automáticamente
      ignoreExpiration: false,

      // Secret para verificar la firma del token
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  /**
   * Este método se ejecuta DESPUÉS de validar el token
   *
   * @param payload - Datos decodificados del JWT
   * @returns Usuario completo desde la DB (se adjunta a req.user)
   */
  async validate(payload: JwtPayload) {
    // Buscar usuario en DB por el ID que viene en el token
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        nickname: true,
        avatar: true,
        role: true,
        isActive: true,
      },
    });

    // Si no existe o está inactivo, rechazar
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuario no válido o inactivo');
    }

    // Este objeto se adjunta a req.user
    return user;
  }
}
