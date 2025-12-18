import { Injectable, NotFoundException, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(AddressService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Crear una nueva dirección para el usuario
   * Si se marca como predeterminada, desmarca las demás
   */
  async create(userId: string, dto: CreateAddressDto) {
    this.logger.log(`Usuario ${userId} creando nueva dirección`);

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        this.logger.warn(`Usuario ${userId} no encontrado`);
        throw new NotFoundException('Usuario no encontrado');
      }

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
        this.logger.log(
          `Direcciones existentes del usuario ${userId} desmarcadas como predeterminadas`,
        );
      }

      if (!user.phone) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { phone: dto.phone },
        });
        this.logger.log(`Teléfono actualizado para usuario ${userId}`);
      }

      const address = await this.prisma.address.create({
        data: {
          userId,
          ...dto,
        },
      });

      this.logger.log(
        `Dirección creada exitosamente - ID: ${address.id}, Usuario: ${userId}`,
      );

      return address;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(
        `Error creando dirección para usuario ${userId}`,
        err.stack,
        { userId },
      );
      throw error;
    }
  }

  /**
   * Obtener todas las direcciones activas del usuario
   * Ordenadas por: predeterminada primero, luego por fecha de creación
   */
  async findAllByUser(userId: string) {
    this.logger.log(`Consultando direcciones del usuario ${userId}`);

    try {
      const addresses = await this.prisma.address.findMany({
        where: {
          userId,
          isActive: true,
        },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      });

      this.logger.log(
        `${addresses.length} direcciones encontradas para usuario ${userId}`,
      );

      return addresses;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(
        `Error consultando direcciones del usuario ${userId}`,
        err.stack,
        { userId },
      );
      throw error;
    }
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
      this.logger.warn(
        `Dirección ${addressId} no encontrada para usuario ${userId}`,
      );
      throw new NotFoundException('Dirección no encontrada');
    }

    return address;
  }

  /**
   * Actualizar una dirección
   * Si se marca como predeterminada, desmarca las demás
   */
  async update(addressId: string, userId: string, dto: UpdateAddressDto) {
    this.logger.log(`Usuario ${userId} actualizando dirección ${addressId}`);

    try {
      const address = await this.prisma.address.findFirst({
        where: {
          id: addressId,
          userId,
          isActive: true,
        },
      });

      if (!address) {
        this.logger.warn(
          `Dirección ${addressId} no encontrada para usuario ${userId}`,
        );
        throw new NotFoundException('Dirección no encontrada');
      }

      if (dto.isDefault) {
        await this.prisma.address.updateMany({
          where: {
            userId,
            isActive: true,
            id: { not: addressId },
          },
          data: {
            isDefault: false,
          },
        });
        this.logger.log(
          `Otras direcciones desmarcadas como predeterminadas para usuario ${userId}`,
        );
      }

      const updated = await this.prisma.address.update({
        where: { id: addressId },
        data: dto,
      });

      this.logger.log(`Dirección ${addressId} actualizada exitosamente`);

      return updated;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(
        `Error actualizando dirección ${addressId} para usuario ${userId}`,
        err.stack,
        { userId, addressId },
      );
      throw error;
    }
  }

  /**
   * Marcar una dirección como predeterminada
   * Desmarca automáticamente las demás
   */
  async setAsDefault(addressId: string, userId: string) {
    this.logger.log(
      `Marcando dirección ${addressId} como predeterminada para usuario ${userId}`,
    );

    try {
      const address = await this.prisma.address.findFirst({
        where: {
          id: addressId,
          userId,
          isActive: true,
        },
      });

      if (!address) {
        this.logger.warn(
          `Dirección ${addressId} no encontrada para usuario ${userId}`,
        );
        throw new NotFoundException('Dirección no encontrada');
      }

      await this.prisma.address.updateMany({
        where: {
          userId,
          isActive: true,
        },
        data: {
          isDefault: false,
        },
      });

      const updated = await this.prisma.address.update({
        where: { id: addressId },
        data: { isDefault: true },
      });

      this.logger.log(
        `Dirección ${addressId} marcada como predeterminada exitosamente`,
      );

      return updated;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(
        `Error marcando dirección ${addressId} como predeterminada`,
        err.stack,
        { userId, addressId },
      );
      throw error;
    }
  }

  /**
   * Eliminar una dirección (soft delete)
   * No se puede eliminar si es la única dirección activa
   */
  async remove(addressId: string, userId: string) {
    this.logger.log(`Usuario ${userId} eliminando dirección ${addressId}`);

    try {
      const address = await this.prisma.address.findFirst({
        where: {
          id: addressId,
          userId,
          isActive: true,
        },
      });

      if (!address) {
        this.logger.warn(
          `Dirección ${addressId} no encontrada para usuario ${userId}`,
        );
        throw new NotFoundException('Dirección no encontrada');
      }

      const deleted = await this.prisma.address.update({
        where: { id: addressId },
        data: { isActive: false },
      });

      this.logger.log(`Dirección ${addressId} eliminada exitosamente`);

      return deleted;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(
        `Error eliminando dirección ${addressId} para usuario ${userId}`,
        err.stack,
        { userId, addressId },
      );
      throw error;
    }
  }
}
