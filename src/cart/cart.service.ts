import {
  Injectable,
  NotFoundException,
  BadRequestException,
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
  constructor(private prisma: PrismaService) {}

  /**
   * Obtener o crear el carrito del usuario
   * Elimina automáticamente los items expirados
   */
  async getOrCreateCart(userId: string) {
    // Buscar carrito del usuario
    let cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            variant: {
              include: {
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
        },
      },
    });

    // Si existe, limpiar items expirados
    if (cart) {
      const now = new Date();

      // Eliminar items expirados (hard delete)
      await this.prisma.cartItem.deleteMany({
        where: {
          cartId: cart.id,
          expiresAt: {
            lt: now, // menor que ahora = expirado
          },
        },
      });

      // Recargar carrito con items vigentes
      cart = await this.prisma.cart.findUnique({
        where: { userId },
        include: {
          items: {
            include: {
              variant: {
                include: {
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
          },
        },
      });
    }

    // Si no existe, crear nuevo carrito
    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { userId },
        include: {
          items: {
            include: {
              variant: {
                include: {
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
          },
        },
      });
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
    // 1. Validar que la variante existe y está activa
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
      throw new NotFoundException(
        'La variante del producto no existe o no está disponible',
      );
    }

    // 2. Validar stock disponible
    if (variant.stock < dto.quantity) {
      throw new BadRequestException(
        `Stock insuficiente. Disponible: ${variant.stock} unidades`,
      );
    }

    // 3. Obtener o crear carrito (limpia items expirados automáticamente)
    const cart = await this.getOrCreateCart(userId);

    // 4. Calcular nueva fecha de expiración (+5 días desde ahora)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 5);

    // 5. Verificar si la variante ya está en el carrito
    const existingItem = await this.prisma.cartItem.findUnique({
      where: {
        cartId_variantId: {
          cartId: cart.id,
          variantId: dto.variantId,
        },
      },
    });

    if (existingItem) {
      // Ya existe → sumar cantidades y renovar expiración
      const newQuantity = existingItem.quantity + dto.quantity;

      // Validar que no exceda el stock
      if (newQuantity > variant.stock) {
        throw new BadRequestException(
          `Stock insuficiente. En carrito: ${existingItem.quantity}, disponible: ${variant.stock}`,
        );
      }

      // Actualizar cantidad y renovar expiración
      await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: newQuantity,
          expiresAt, // Renovar expiración
        },
      });
    } else {
      // No existe → crear nuevo item con su propia expiración
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          variantId: dto.variantId,
          quantity: dto.quantity,
          expiresAt,
        },
      });
    }

    // 6. Retornar carrito actualizado con totales
    return this.getCartWithTotals(userId);
  }

  /**
   * Obtener carrito del usuario con cálculo de totales
   * Limpia items expirados automáticamente
   */
  async getCartWithTotals(userId: string) {
    const cart = await this.getOrCreateCart(userId);

    // Calcular totales
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
    // 1. Verificar que el item existe y pertenece al usuario
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
      throw new NotFoundException('Item del carrito no encontrado');
    }

    // 2. Verificar si ya expiró
    const now = new Date();
    if (new Date(item.expiresAt) < now) {
      throw new BadRequestException('Este item ya expiró');
    }

    // 3. Validar stock disponible
    if (dto.quantity > item.variant.stock) {
      throw new BadRequestException(
        `Stock insuficiente. Disponible: ${item.variant.stock} unidades`,
      );
    }

    // 4. Actualizar cantidad y renovar expiración
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 5);

    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: {
        quantity: dto.quantity,
        expiresAt: newExpiresAt,
      },
    });

    // 5. Retornar carrito actualizado
    return this.getCartWithTotals(userId);
  }

  /**
   * Eliminar item del carrito (hard delete)
   */
  async removeCartItem(userId: string, itemId: string) {
    // Verificar que el item existe y pertenece al usuario
    const item = await this.prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cart: { userId },
      },
    });

    if (!item) {
      throw new NotFoundException('Item del carrito no encontrado');
    }

    // Hard delete
    await this.prisma.cartItem.delete({
      where: { id: itemId },
    });

    return this.getCartWithTotals(userId);
  }

  /**
   * Vaciar carrito completo (hard delete de todos los items)
   */
  async clearCart(userId: string) {
    const cart = await this.getOrCreateCart(userId);

    await this.prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    return this.getCartWithTotals(userId);
  }
}
