import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { User } from '@prisma/client';
import { AuthService } from './auth.service';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

/**
 * Interface para extender Request con usuario autenticado
 */
interface RequestWithUser extends Request {
  user: User;
}

/**
 * Controller de autenticación
 *
 * Rutas:
 * - GET /auth/google → Iniciar login con Google
 * - GET /auth/google/callback → Callback de Google OAuth
 * - GET /auth/profile → Obtener perfil del usuario autenticado
 */
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * Ruta 1: Iniciar login con Google
   *
   * Cuando el usuario accede a esta ruta, GoogleAuthGuard
   * automáticamente redirige a Google para autorizar.
   *
   * GET /auth/google
   */
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleAuth() {
    // Este método nunca se ejecuta
    // El guard intercepta y redirige a Google
  }

  /**
   * Ruta 2: Callback de Google OAuth
   *
   * Google redirige aquí después de que el usuario autoriza.
   * GoogleStrategy valida el code y crea/actualiza el usuario.
   * AuthService genera el JWT.
   * Finalmente redirige al frontend con el token.
   *
   * GET /auth/google/callback?code=xxx
   */
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  googleAuthCallback(@Req() req: RequestWithUser, @Res() res: Response) {
    // req.user contiene el usuario de GoogleStrategy
    const user = req.user;

    // Generar JWT para el usuario
    const loginResponse = this.authService.login(user);

    // Redirigir al frontend con el token en la URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const redirectUrl = `${frontendUrl}/auth/callback?token=${loginResponse.access_token}`;

    return res.redirect(redirectUrl);
  }

  /**
   * Ruta 3: Obtener perfil del usuario autenticado
   *
   * Esta ruta está protegida con JwtAuthGuard.
   * Solo usuarios con JWT válido pueden acceder.
   *
   * GET /auth/profile
   * Headers: { Authorization: "Bearer <token>" }
   */
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  getProfile(@Req() req: RequestWithUser) {
    // req.user contiene el usuario de JwtStrategy
    return req.user;
  }
}
