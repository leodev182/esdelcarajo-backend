import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

/**
 * Guard para proteger rutas que requieren autenticación JWT
 *
 * Uso en controllers:
 * @UseGuards(JwtAuthGuard)
 * @Get('profile')
 * getProfile(@Req() req) {
 *   return req.user; // Usuario autenticado disponible
 * }
 *
 * Este guard usa la estrategia 'jwt' definida en jwt.strategy.ts
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  /**
   * Método que se ejecuta antes de procesar el request
   *
   * @param context - Contexto de ejecución de NestJS
   * @returns true si puede activar la ruta, false o error si no
   */
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    // Llamar al método canActivate del AuthGuard base
    // Esto ejecuta la JwtStrategy automáticamente
    return super.canActivate(context);
  }
}
