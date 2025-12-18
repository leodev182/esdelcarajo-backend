import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

/**
 * Servicio para gestionar el carrito de compras
 * - Cada item tiene expiración independiente (5 días)
 * - Hard delete de items expirados (no soft delete)
 * - Cálculo automático de subtotales
 */
@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(private prisma: PrismaService) {}

  private readonly cartInclude = {
    items: {
      include: {
        variant: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                images: {
                  where: { isActive: true },
                  orderBy: { order: 'asc' as const },
                  take: 1,
                },
              },
            },
          },
        },
      },
    },
  };

  /**
   * Obtener o crear el carrito del usuario
   * Elimina automáticamente los items expirados
   */
  async getOrCreateCart(userId: string) {
    let cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: this.cartInclude,
    });

    if (cart) {
      const now = new Date();

      const expired = await this.prisma.cartItem.deleteMany({
        where: {
          cartId: cart.id,
          expiresAt: {
            lt: now,
          },
        },
      });

      if (expired.count > 0) {
        this.logger.log(
          `${expired.count} items expirados eliminados del carrito ${cart.id}`,
        );
      }

      cart = await this.prisma.cart.findUnique({
        where: { userId },
        include: this.cartInclude,
      });
    }

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { userId },
        include: this.cartInclude,
      });
      this.logger.log(`Carrito creado para usuario ${userId}`);
    }

    return cart;
  }

  /**
   * Agregar producto al carrito
   * - Valida que la variante exista y tenga stock
   * - Si ya existe en el carrito, suma las cantidades y renueva expiración
   * - Cada item tiene su propio expiresAt (+5 días desde ahora)
   */
  async addToCart(userId: string, dto: AddToCartDto) {
    this.logger.log(
      `Usuario ${userId} agregando variante ${dto.variantId} al carrito (cantidad: ${dto.quantity})`,
    );

    try {
      const variant = await this.prisma.productVariant.findFirst({
        where: {
          id: dto.variantId,
          isActive: true,
          product: { isActive: true },
        },
        include: {
          product: true,
        },
      });

      if (!variant) {
        this.logger.warn(
          `Variante ${dto.variantId} no encontrada o inactiva para usuario ${userId}`,
        );
        throw new NotFoundException(
          'La variante del producto no existe o no está disponible',
        );
      }

      if (variant.stock < dto.quantity) {
        this.logger.warn(
          `Stock insuficiente para variante ${dto.variantId} - Solicitado: ${dto.quantity}, Disponible: ${variant.stock}`,
        );
        throw new BadRequestException(
          `Stock insuficiente. Disponible: ${variant.stock} unidades`,
        );
      }

      const cart = await this.getOrCreateCart(userId);

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 5);

      const existingItem = await this.prisma.cartItem.findUnique({
        where: {
          cartId_variantId: {
            cartId: cart.id,
            variantId: dto.variantId,
          },
        },
      });

      if (existingItem) {
        const newQuantity = existingItem.quantity + dto.quantity;

        if (newQuantity > variant.stock) {
          this.logger.warn(
            `Stock insuficiente al actualizar - Variante ${dto.variantId}: En carrito: ${existingItem.quantity}, Solicitado: ${dto.quantity}, Disponible: ${variant.stock}`,
          );
          throw new BadRequestException(
            `Stock insuficiente. En carrito: ${existingItem.quantity}, disponible: ${variant.stock}`,
          );
        }

        await this.prisma.cartItem.update({
          where: { id: existingItem.id },
          data: {
            quantity: newQuantity,
            expiresAt,
          },
        });

        this.logger.log(
          `Item actualizado en carrito ${cart.id} - Variante ${dto.variantId}: ${existingItem.quantity} → ${newQuantity}`,
        );
      } else {
        await this.prisma.cartItem.create({
          data: {
            cartId: cart.id,
            variantId: dto.variantId,
            quantity: dto.quantity,
            expiresAt,
          },
        });

        this.logger.log(
          `Item agregado al carrito ${cart.id} - Variante ${dto.variantId} (cantidad: ${dto.quantity})`,
        );
      }

      return this.getCartWithTotals(userId);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(
        `Error agregando al carrito para usuario ${userId}`,
        err.stack,
        { userId, variantId: dto.variantId, quantity: dto.quantity },
      );
      throw error;
    }
  }

  /**
   * Obtener carrito del usuario con cálculo de totales
   * Limpia items expirados automáticamente
   */
  async getCartWithTotals(userId: string) {
    const cart = await this.getOrCreateCart(userId);

    let subtotal = 0;
    let totalItems = 0;

    cart.items.forEach((item) => {
      const itemSubtotal = Number(item.variant.price) * item.quantity;
      subtotal += itemSubtotal;
      totalItems += item.quantity;
    });

    return {
      ...cart,
      subtotal,
      totalItems,
    };
  }

  /**
   * Actualizar cantidad de un item del carrito
   * Renueva la expiración del item (+5 días desde ahora)
   */
  async updateCartItem(userId: string, itemId: string, dto: UpdateCartItemDto) {
    this.logger.log(
      `Usuario ${userId} actualizando item ${itemId} a cantidad ${dto.quantity}`,
    );

    try {
      const item = await this.prisma.cartItem.findFirst({
        where: {
          id: itemId,
          cart: { userId },
        },
        include: {
          variant: true,
        },
      });

      if (!item) {
        this.logger.warn(`Item ${itemId} no encontrado para usuario ${userId}`);
        throw new NotFoundException('Item del carrito no encontrado');
      }

      const now = new Date();
      if (new Date(item.expiresAt) < now) {
        this.logger.warn(
          `Usuario ${userId} intentó actualizar item expirado ${itemId}`,
        );
        throw new BadRequestException('Este item ya expiró');
      }

      if (dto.quantity > item.variant.stock) {
        this.logger.warn(
          `Stock insuficiente al actualizar item ${itemId} - Solicitado: ${dto.quantity}, Disponible: ${item.variant.stock}`,
        );
        throw new BadRequestException(
          `Stock insuficiente. Disponible: ${item.variant.stock} unidades`,
        );
      }

      const newExpiresAt = new Date();
      newExpiresAt.setDate(newExpiresAt.getDate() + 5);

      await this.prisma.cartItem.update({
        where: { id: itemId },
        data: {
          quantity: dto.quantity,
          expiresAt: newExpiresAt,
        },
      });

      this.logger.log(
        `Item ${itemId} actualizado exitosamente - Nueva cantidad: ${dto.quantity}`,
      );

      return this.getCartWithTotals(userId);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(
        `Error actualizando item ${itemId} para usuario ${userId}`,
        err.stack,
        { userId, itemId, quantity: dto.quantity },
      );
      throw error;
    }
  }

  /**
   * Eliminar item del carrito (hard delete)
   */
  async removeCartItem(userId: string, itemId: string) {
    this.logger.log(`Usuario ${userId} eliminando item ${itemId} del carrito`);

    try {
      const item = await this.prisma.cartItem.findFirst({
        where: {
          id: itemId,
          cart: { userId },
        },
      });

      if (!item) {
        this.logger.warn(`Item ${itemId} no encontrado para usuario ${userId}`);
        throw new NotFoundException('Item del carrito no encontrado');
      }

      await this.prisma.cartItem.delete({
        where: { id: itemId },
      });

      this.logger.log(`Item ${itemId} eliminado exitosamente`);

      return this.getCartWithTotals(userId);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(
        `Error eliminando item ${itemId} para usuario ${userId}`,
        err.stack,
        { userId, itemId },
      );
      throw error;
    }
  }

  /**
   * Vaciar carrito completo (hard delete de todos los items)
   */
  async clearCart(userId: string) {
    this.logger.log(`Usuario ${userId} vaciando carrito completo`);

    try {
      const cart = await this.getOrCreateCart(userId);

      const result = await this.prisma.cartItem.deleteMany({
        where: { cartId: cart.id },
      });

      this.logger.log(
        `Carrito ${cart.id} vaciado - ${result.count} items eliminados`,
      );

      return this.getCartWithTotals(userId);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(
        `Error vaciando carrito para usuario ${userId}`,
        err.stack,
        { userId },
      );
      throw error;
    }
  }

  /**
   * Limpiar items expirados de TODOS los carritos (usado por CRON)
   */
  async cleanupExpiredItems() {
    this.logger.log('Ejecutando limpieza de items expirados (CRON)');

    try {
      const now = new Date();

      const result = await this.prisma.cartItem.deleteMany({
        where: {
          expiresAt: {
            lt: now,
          },
        },
      });

      this.logger.log(
        `Limpieza completada - ${result.count} items expirados eliminados`,
      );

      return {
        deletedCount: result.count,
        timestamp: now,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error('Error en limpieza de items expirados', err.stack);
      throw error;
    }
  }
}
