import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../mail/mail.service';
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
  private readonly logger = new Logger(GoogleStrategy.name);
  private readonly superAdminEmails: string[];

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private mailService: MailService,
  ) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      scope: ['email', 'profile'],
    });

    const emailsString =
      this.configService.get<string>('SUPER_ADMIN_EMAILS') || '';
    this.superAdminEmails = emailsString
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email.length > 0);

    this.logger.log(
      `Super admins configurados: ${this.superAdminEmails.length}`,
    );
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
    const { id, name, emails, photos } = profile;

    if (!emails || emails.length === 0) {
      this.logger.error('Usuario sin email en Google OAuth');
      return done(new Error('No se pudo obtener el email de Google'), null);
    }

    const email = emails[0].value;
    const avatar = photos && photos.length > 0 ? photos[0].value : null;

    const isSuperAdmin = this.superAdminEmails.includes(email.toLowerCase());
    const role: Role = isSuperAdmin ? Role.SUPER_ADMIN : Role.USER;

    try {
      let user = await this.prisma.user.findUnique({
        where: { googleId: id },
      });

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
            role,
          },
        });

        if (isSuperAdmin) {
          this.logger.log(`🔥 Nuevo SUPER_ADMIN creado: ${email}`);
        } else {
          this.logger.log(`Nuevo usuario creado: ${email}`);
        }

        await this.mailService.sendWelcomeEmail(
          user.email,
          user.name || 'Cliente',
        );
      } else {
        const updateData: {
          name?: string;
          avatar?: string;
          role?: Role;
        } = {
          name:
            name?.givenName && name?.familyName
              ? `${name.givenName} ${name.familyName}`
              : profile.displayName || user.name,
          avatar: avatar || user.avatar,
        };

        if (isSuperAdmin && user.role !== Role.SUPER_ADMIN) {
          updateData.role = Role.SUPER_ADMIN;
          this.logger.log(`🔥 Usuario promovido a SUPER_ADMIN: ${email}`);
        }

        user = await this.prisma.user.update({
          where: { id: user.id },
          data: updateData,
        });
      }

      done(null, user);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(`Error en Google OAuth para ${email}`, err.stack);
      done(error, null);
    }
  }
}
