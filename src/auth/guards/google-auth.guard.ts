import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard para iniciar el flujo de autenticación con Google OAuth
 *
 * Uso en controllers:
 * @UseGuards(GoogleAuthGuard)
 * @Get('google')
 * googleAuth() {
 *   // Este método nunca se ejecuta, el guard redirige a Google
 * }
 *
 * Este guard usa la estrategia 'google' definida en google.strategy.ts
 */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {}
