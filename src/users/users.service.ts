import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // ==================== GESTIÓN DE USUARIOS (ADMIN) ====================

  /**
   * Listar todos los usuarios
   */
  async getAllUsers() {
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

    return {
      total: users.length,
      users,
    };
  }

  /**
   * Obtener detalle de un usuario
   */
  async getUserById(userId: string) {
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
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
    }

    return user;
  }

  /**
   * Cambiar rol de un usuario (SUPER_ADMIN)
   */
  async updateUserRole(userId: string, updateUserRoleDto: UpdateUserRoleDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
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

    return {
      message: 'Rol de usuario actualizado exitosamente',
      user: updatedUser,
    };
  }

  /**
   * Banear/desbanear usuario (SUPER_ADMIN)
   */
  async toggleUserBan(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: !user.isActive },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
      },
    });

    return {
      message: updatedUser.isActive
        ? 'Usuario desbaneado exitosamente'
        : 'Usuario baneado exitosamente',
      user: updatedUser,
    };
  }

  // ==================== PERFIL PROPIO (USER) ====================

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
      throw new NotFoundException('Usuario no encontrado');
    }

    return user;
  }

  /**
   * Actualizar mi perfil
   */
  async updateMyProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
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

    return {
      message: 'Perfil actualizado exitosamente',
      user: updatedUser,
    };
  }
}
