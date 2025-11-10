import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '@prisma/client';

/**
 * Interface para los datos del perfil de Google
 */
interface GoogleProfile extends Profile {
  id: string;
  displayName: string;
  name: {
    familyName: string;
    givenName: string;
  };
  emails: Array<{
    value: string;
    verified: boolean;
  }>;
  photos: Array<{
    value: string;
  }>;
}

/**
 * Estrategia de Google OAuth 2.0
 *
 * Flujo:
 * 1. Usuario clickea "Login con Google"
 * 2. Se redirige a Google para autorizar
 * 3. Google redirige a /auth/google/callback con un code
 * 4. Esta estrategia intercambia el code por datos del usuario
 * 5. Método validate() busca/crea el usuario en DB
 * 6. Retorna el usuario para generar JWT
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private prisma: PrismaService) {
    super({
      // Client ID de Google Cloud Console
      clientID: process.env.GOOGLE_CLIENT_ID,

      // Client Secret de Google Cloud Console
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,

      // URL a donde Google redirige después de autorizar
      callbackURL: process.env.GOOGLE_CALLBACK_URL,

      // Scopes: qué permisos pedimos a Google
      scope: ['email', 'profile'],
    });
  }

  /**
   * Este método se ejecuta cuando Google devuelve los datos del usuario
   *
   * @param accessToken - Token de acceso de Google (no lo usamos)
   * @param refreshToken - Token de refresh de Google (no lo usamos)
   * @param profile - Perfil del usuario de Google
   * @param done - Callback de Passport para indicar éxito/error
   */
  async validate(
    accessToken: string,
    refreshToken: string,
    profile: GoogleProfile,
    done: VerifyCallback,
  ): Promise<any> {
    // Extraer datos del perfil de Google
    const { id, name, emails, photos } = profile;

    // Verificar que tenga email
    if (!emails || emails.length === 0) {
      return done(new Error('No se pudo obtener el email de Google'), null);
    }

    const email = emails[0].value;
    const avatar = photos && photos.length > 0 ? photos[0].value : null;

    // Buscar si el usuario ya existe en nuestra DB
    let user = await this.prisma.user.findUnique({
      where: { googleId: id },
    });

    // Si no existe, crearlo
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          googleId: id,
          name:
            name?.givenName && name?.familyName
              ? `${name.givenName} ${name.familyName}`
              : profile.displayName || null,
          avatar,
          role: Role.USER, // Rol por defecto usando el enum
        },
      });
    } else {
      // Si existe, actualizar su info (por si cambió nombre o foto en Google)
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          name:
            name?.givenName && name?.familyName
              ? `${name.givenName} ${name.familyName}`
              : profile.displayName || user.name,
          avatar: avatar || user.avatar,
        },
      });
    }

    // Retornar el usuario (Passport lo adjunta a req.user)
    done(null, user);
  }
}
