import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

/**
 * Servicio para gestionar direcciones de entrega
 * - Usuario puede tener múltiples direcciones
 * - Solo una dirección puede ser predeterminada (isDefault)
 * - Usuario solo puede ver/editar sus propias direcciones
 */
@Injectable()
export class AddressService {
  constructor(private prisma: PrismaService) {}

  /**
   * Crear una nueva dirección para el usuario
   * Si se marca como predeterminada, desmarca las demás
   */
  async create(userId: string, dto: CreateAddressDto) {
    // Si la nueva dirección es predeterminada, desmarcar todas las demás
    if (dto.isDefault) {
      await this.prisma.address.updateMany({
        where: {
          userId,
          isActive: true,
        },
        data: {
          isDefault: false,
        },
      });
    }

    // Crear la nueva dirección
    return this.prisma.address.create({
      data: {
        userId,
        ...dto,
      },
    });
  }

  /**
   * Obtener todas las direcciones activas del usuario
   * Ordenadas por: predeterminada primero, luego por fecha de creación
   */
  async findAllByUser(userId: string) {
    return this.prisma.address.findMany({
      where: {
        userId,
        isActive: true,
      },
      orderBy: [
        { isDefault: 'desc' }, // Predeterminada primero
        { createdAt: 'desc' }, // Más reciente primero
      ],
    });
  }

  /**
   * Obtener una dirección específica
   * Valida que pertenezca al usuario
   */
  async findOne(addressId: string, userId: string) {
    const address = await this.prisma.address.findFirst({
      where: {
        id: addressId,
        userId,
        isActive: true,
      },
    });

    if (!address) {
      throw new NotFoundException('Dirección no encontrada');
    }

    return address;
  }

  /**
   * Actualizar una dirección
   * Si se marca como predeterminada, desmarca las demás
   */
  async update(addressId: string, userId: string, dto: UpdateAddressDto) {
    // Verificar que la dirección existe y pertenece al usuario
    const address = await this.prisma.address.findFirst({
      where: {
        id: addressId,
        userId,
        isActive: true,
      },
    });

    if (!address) {
      throw new NotFoundException('Dirección no encontrada');
    }

    // Si se marca como predeterminada, desmarcar todas las demás
    if (dto.isDefault) {
      await this.prisma.address.updateMany({
        where: {
          userId,
          isActive: true,
          id: { not: addressId }, // Excluir la dirección actual
        },
        data: {
          isDefault: false,
        },
      });
    }

    // Actualizar la dirección
    return this.prisma.address.update({
      where: { id: addressId },
      data: dto,
    });
  }

  /**
   * Marcar una dirección como predeterminada
   * Desmarca automáticamente las demás
   */
  async setAsDefault(addressId: string, userId: string) {
    // Verificar que la dirección existe y pertenece al usuario
    const address = await this.prisma.address.findFirst({
      where: {
        id: addressId,
        userId,
        isActive: true,
      },
    });

    if (!address) {
      throw new NotFoundException('Dirección no encontrada');
    }

    // Desmarcar todas las direcciones del usuario
    await this.prisma.address.updateMany({
      where: {
        userId,
        isActive: true,
      },
      data: {
        isDefault: false,
      },
    });

    // Marcar esta dirección como predeterminada
    return this.prisma.address.update({
      where: { id: addressId },
      data: { isDefault: true },
    });
  }

  /**
   * Eliminar una dirección (soft delete)
   * No se puede eliminar si es la única dirección activa
   */
  async remove(addressId: string, userId: string) {
    // Verificar que la dirección existe y pertenece al usuario
    const address = await this.prisma.address.findFirst({
      where: {
        id: addressId,
        userId,
        isActive: true,
      },
    });

    if (!address) {
      throw new NotFoundException('Dirección no encontrada');
    }

    // Soft delete
    return this.prisma.address.update({
      where: { id: addressId },
      data: { isActive: false },
    });
  }
}
