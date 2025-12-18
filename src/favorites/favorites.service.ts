import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddFavoriteDto } from './dto/add-favorite.dto';

@Injectable()
export class FavoritesService {
  private readonly logger = new Logger(FavoritesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Agregar un producto a favoritos
   */
  async addFavorite(userId: string, addFavoriteDto: AddFavoriteDto) {
    this.logger.log(
      `Usuario ${userId} agregando producto ${addFavoriteDto.productId} a favoritos`,
    );

    try {
      const { productId } = addFavoriteDto;

      const product = await this.prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        this.logger.warn(`Producto ${productId} no encontrado`);
        throw new NotFoundException(
          `Producto con ID ${productId} no encontrado`,
        );
      }

      if (!product.isActive) {
        this.logger.warn(
          `Usuario ${userId} intentó agregar producto inactivo ${productId} a favoritos`,
        );
        throw new ConflictException('No puedes agregar un producto inactivo');
      }

      const existingFavorite = await this.prisma.favorite.findFirst({
        where: {
          userId: userId,
          productId: productId,
        },
      });

      if (existingFavorite) {
        this.logger.warn(
          `Producto ${productId} ya está en favoritos del usuario ${userId}`,
        );
        throw new ConflictException('Este producto ya está en tus favoritos');
      }

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

      this.logger.log(
        `Producto ${productId} agregado a favoritos del usuario ${userId}`,
      );

      return {
        message: 'Producto agregado a favoritos',
        favorite,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(
        `Error agregando producto a favoritos para usuario ${userId}`,
        err.stack,
        { userId, productId: addFavoriteDto.productId },
      );
      throw error;
    }
  }

  /**
   * Obtener todos los favoritos del usuario
   */
  async getFavorites(userId: string) {
    this.logger.log(`Consultando favoritos del usuario ${userId}`);

    try {
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

      const activeFavorites = favorites.filter(
        (fav) => fav.product.isActive === true,
      );

      this.logger.log(
        `${activeFavorites.length} favoritos encontrados para usuario ${userId}`,
      );

      return {
        total: activeFavorites.length,
        favorites: activeFavorites,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(
        `Error consultando favoritos del usuario ${userId}`,
        err.stack,
        { userId },
      );
      throw error;
    }
  }

  /**
   * Eliminar un producto de favoritos
   */
  async removeFavorite(userId: string, favoriteId: string) {
    this.logger.log(`Usuario ${userId} eliminando favorito ${favoriteId}`);

    try {
      const favorite = await this.prisma.favorite.findFirst({
        where: {
          id: favoriteId,
          userId: userId,
        },
      });

      if (!favorite) {
        this.logger.warn(
          `Favorito ${favoriteId} no encontrado para usuario ${userId}`,
        );
        throw new NotFoundException('Favorito no encontrado');
      }

      await this.prisma.favorite.delete({
        where: { id: favoriteId },
      });

      this.logger.log(`Favorito ${favoriteId} eliminado exitosamente`);

      return {
        message: 'Producto eliminado de favoritos',
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(
        `Error eliminando favorito ${favoriteId} para usuario ${userId}`,
        err.stack,
        { userId, favoriteId },
      );
      throw error;
    }
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
    this.logger.log(`Usuario ${userId} limpiando todos los favoritos`);

    try {
      const result = await this.prisma.favorite.deleteMany({
        where: { userId: userId },
      });

      this.logger.log(
        `${result.count} favoritos eliminados para usuario ${userId}`,
      );

      return {
        message: 'Todos los favoritos han sido eliminados',
        deleted: result.count,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(
        `Error limpiando favoritos del usuario ${userId}`,
        err.stack,
        { userId },
      );
      throw error;
    }
  }
}
