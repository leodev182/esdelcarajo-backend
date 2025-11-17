import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Guard para validar que el usuario tenga el rol requerido
 *
 * Uso en controllers:
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles('ADMIN', 'SUPER_ADMIN')
 * @Get('admin/users')
 * getAllUsers() { }
 *
 * IMPORTANTE: RolesGuard debe usarse DESPUÉS de JwtAuthGuard
 * para que req.user esté disponible
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Obtener los roles requeridos desde el decorador @Roles()
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si no hay roles definidos, permitir acceso
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Obtener el usuario del request (viene de JwtAuthGuard)
    const request = context
      .switchToHttp()
      .getRequest<{ user?: { id: string; email: string; role: Role } }>();
    const user = request.user;

    // Si no hay usuario, denegar (no debería pasar si JwtAuthGuard está antes)
    if (!user) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    // Validar si el usuario tiene alguno de los roles requeridos
    const hasRole = requiredRoles.some((role: Role) => user.role === role);

    if (!hasRole) {
      throw new ForbiddenException(
        `Acceso denegado. Se requiere uno de estos roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
