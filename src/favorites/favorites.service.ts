import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddFavoriteDto } from './dto/add-favorite.dto';

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Agregar un producto a favoritos
   */
  async addFavorite(userId: string, addFavoriteDto: AddFavoriteDto) {
    const { productId } = addFavoriteDto;

    // Verificar que el producto existe
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException(`Producto con ID ${productId} no encontrado`);
    }

    // Verificar que el producto esté activo
    if (!product.isActive) {
      throw new ConflictException('No puedes agregar un producto inactivo');
    }

    // Verificar si ya existe en favoritos
    const existingFavorite = await this.prisma.favorite.findFirst({
      where: {
        userId: userId,
        productId: productId,
      },
    });

    if (existingFavorite) {
      throw new ConflictException('Este producto ya está en tus favoritos');
    }

    // Crear el favorito
    const favorite = await this.prisma.favorite.create({
      data: {
        userId: userId,
        productId: productId,
      },
      include: {
        product: {
          include: {
            images: {
              where: { isActive: true },
              orderBy: { order: 'asc' },
            },
            category: true,
            subcategory: true,
          },
        },
      },
    });

    return {
      message: 'Producto agregado a favoritos',
      favorite,
    };
  }

  /**
   * Obtener todos los favoritos del usuario
   */
  async getFavorites(userId: string) {
    const favorites = await this.prisma.favorite.findMany({
      where: { userId: userId },
      include: {
        product: {
          include: {
            images: {
              where: { isActive: true },
              orderBy: { order: 'asc' },
            },
            category: true,
            subcategory: true,
            variants: {
              where: { isActive: true },
              select: {
                id: true,
                size: true,
                color: true,
                gender: true,
                price: true,
                stock: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Filtrar productos inactivos
    const activeFavorites = favorites.filter(
      (fav) => fav.product.isActive === true,
    );

    return {
      total: activeFavorites.length,
      favorites: activeFavorites,
    };
  }

  /**
   * Eliminar un producto de favoritos
   */
  async removeFavorite(userId: string, favoriteId: string) {
    // Verificar que el favorito existe y pertenece al usuario
    const favorite = await this.prisma.favorite.findFirst({
      where: {
        id: favoriteId,
        userId: userId,
      },
    });

    if (!favorite) {
      throw new NotFoundException('Favorito no encontrado');
    }

    // Eliminar el favorito (hard delete)
    await this.prisma.favorite.delete({
      where: { id: favoriteId },
    });

    return {
      message: 'Producto eliminado de favoritos',
    };
  }

  /**
   * Verificar si un producto está en favoritos del usuario
   */
  async isFavorite(userId: string, productId: string): Promise<boolean> {
    const favorite = await this.prisma.favorite.findFirst({
      where: {
        userId: userId,
        productId: productId,
      },
    });

    return !!favorite;
  }

  /**
   * Eliminar todos los favoritos del usuario
   */
  async clearFavorites(userId: string) {
    const result = await this.prisma.favorite.deleteMany({
      where: { userId: userId },
    });

    return {
      message: 'Todos los favoritos han sido eliminados',
      deleted: result.count,
    };
  }
}
