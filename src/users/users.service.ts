import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Listar todos los usuarios
   */
  async getAllUsers() {
    this.logger.log('Consultando todos los usuarios');

    try {
      const users = await this.prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          nickname: true,
          role: true,
          isActive: true,
          createdAt: true,
          _count: {
            select: {
              orders: true,
              favorites: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      this.logger.log(`${users.length} usuarios encontrados`);

      return {
        total: users.length,
        users,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error('Error consultando usuarios', err.stack);
      throw error;
    }
  }

  /**
   * Obtener detalle de un usuario
   */
  async getUserById(userId: string) {
    this.logger.log(`Consultando usuario ${userId}`);

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          nickname: true,
          avatar: true,
          phone: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          addresses: true,
          orders: {
            select: {
              id: true,
              status: true,
              total: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
          favorites: {
            select: {
              id: true,
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      });

      if (!user) {
        this.logger.warn(`Usuario ${userId} no encontrado`);
        throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
      }

      this.logger.log(`Usuario ${userId} consultado exitosamente`);

      return user;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(`Error consultando usuario ${userId}`, err.stack, {
        userId,
      });
      throw error;
    }
  }

  /**
   * Cambiar rol de un usuario (SUPER_ADMIN)
   */
  async updateUserRole(userId: string, updateUserRoleDto: UpdateUserRoleDto) {
    this.logger.log(
      `Cambiando rol de usuario ${userId} a ${updateUserRoleDto.role}`,
    );

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        this.logger.warn(`Usuario ${userId} no encontrado para cambio de rol`);
        throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
      }

      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: { role: updateUserRoleDto.role },
        select: {
          id: true,
          email: true,
          name: true,
          nickname: true,
          role: true,
        },
      });

      this.logger.log(
        `Rol de usuario ${userId} actualizado a ${updateUserRoleDto.role}`,
      );

      return {
        message: 'Rol de usuario actualizado exitosamente',
        user: updatedUser,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(`Error cambiando rol de usuario ${userId}`, err.stack, {
        userId,
        newRole: updateUserRoleDto.role,
      });
      throw error;
    }
  }

  /**
   * Banear/desbanear usuario (SUPER_ADMIN)
   */
  async toggleUserBan(userId: string) {
    this.logger.log(`Toggle ban para usuario ${userId}`);

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        this.logger.warn(`Usuario ${userId} no encontrado para ban/unban`);
        throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
      }

      const newStatus = !user.isActive;

      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: { isActive: newStatus },
        select: {
          id: true,
          email: true,
          name: true,
          isActive: true,
        },
      });

      this.logger.log(
        `Usuario ${userId} ${newStatus ? 'desbaneado' : 'baneado'} exitosamente`,
      );

      return {
        message: updatedUser.isActive
          ? 'Usuario desbaneado exitosamente'
          : 'Usuario baneado exitosamente',
        user: updatedUser,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(
        `Error en toggle ban para usuario ${userId}`,
        err.stack,
        { userId },
      );
      throw error;
    }
  }

  /**
   * Obtener mi perfil
   */
  async getMyProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        nickname: true,
        avatar: true,
        phone: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      this.logger.warn(`Perfil de usuario ${userId} no encontrado`);
      throw new NotFoundException('Usuario no encontrado');
    }

    return user;
  }

  /**
   * Actualizar mi perfil
   */
  async updateMyProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    this.logger.log(`Usuario ${userId} actualizando su perfil`);

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        this.logger.warn(
          `Usuario ${userId} no encontrado para actualizar perfil`,
        );
        throw new NotFoundException('Usuario no encontrado');
      }

      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: updateProfileDto,
        select: {
          id: true,
          email: true,
          name: true,
          nickname: true,
          avatar: true,
          phone: true,
          role: true,
          updatedAt: true,
        },
      });

      this.logger.log(`Perfil de usuario ${userId} actualizado exitosamente`);

      return {
        message: 'Perfil actualizado exitosamente',
        user: updatedUser,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(
        `Error actualizando perfil de usuario ${userId}`,
        err.stack,
        { userId },
      );
      throw error;
    }
  }
}
