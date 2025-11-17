import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

/**
 * Key para almacenar los roles en metadata
 */
export const ROLES_KEY = 'roles';

/**
 * Decorador para especificar qué roles pueden acceder a un endpoint
 *
 * @example
 * // Solo SUPER_ADMIN
 * @Roles('SUPER_ADMIN')
 * @Get('users')
 * getAllUsers() { }
 *
 * @example
 * // ADMIN o SUPER_ADMIN
 * @Roles('ADMIN', 'SUPER_ADMIN')
 * @Patch('orders/:id/status')
 * updateOrderStatus() { }
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
