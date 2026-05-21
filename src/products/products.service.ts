import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import {
  ProductCreatedEvent,
  ProductUpdatedEvent,
  ProductDeletedEvent,
} from '../events/product.events';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateVariantDto } from './dto/create-variant.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';
import { CreateProductImageDto } from './dto/create-product-image.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { Product, ProductVariant, ProductImage } from '@prisma/client';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Genera un slug amigable para URLs a partir de un nombre
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  /**
   * Crea un nuevo producto
   */
  async create(createProductDto: CreateProductDto): Promise<Product> {
    this.logger.log(`Creando producto: ${createProductDto.name}`);

    try {
      const slug: string = this.generateSlug(createProductDto.name);

      const existingProduct: Product | null =
        await this.prisma.product.findUnique({
          where: { slug },
        });

      if (existingProduct) {
        this.logger.warn(`Producto con slug "${slug}" ya existe`);
        throw new ConflictException(
          `Ya existe un producto con el slug "${slug}"`,
        );
      }

      const category = await this.prisma.category.findUnique({
        where: { id: createProductDto.categoryId },
      });

      if (!category) {
        this.logger.warn(
          `Categoría ${createProductDto.categoryId} no encontrada`,
        );
        throw new NotFoundException(
          `Categoría con ID "${createProductDto.categoryId}" no encontrada`,
        );
      }

      if (createProductDto.subcategoryId) {
        const subcategory = await this.prisma.subcategory.findUnique({
          where: { id: createProductDto.subcategoryId },
        });

        if (!subcategory) {
          this.logger.warn(
            `Subcategoría ${createProductDto.subcategoryId} no encontrada`,
          );
          throw new NotFoundException(
            `Subcategoría con ID "${createProductDto.subcategoryId}" no encontrada`,
          );
        }

        if (subcategory.categoryId !== createProductDto.categoryId) {
          this.logger.warn(
            `Subcategoría ${createProductDto.subcategoryId} no pertenece a categoría ${createProductDto.categoryId}`,
          );
          throw new BadRequestException(
            'La subcategoría no pertenece a la categoría especificada',
          );
        }
      }

      const product = await this.prisma.product.create({
        data: {
          ...createProductDto,
          slug,
        },
        include: {
          category: true,
          subcategory: true,
        },
      });

      this.logger.log(
        `Producto creado exitosamente - ID: ${product.id}, Slug: ${slug}`,
      );

      this.eventEmitter.emit(
        ProductCreatedEvent.EVENT,
        new ProductCreatedEvent(product.id, product.name),
      );

      return product;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(
        `Error creando producto: ${createProductDto.name}`,
        err.stack,
        { productName: createProductDto.name },
      );
      throw error;
    }
  }

  /**
   * Obtiene productos con filtros, búsqueda y paginación
   */
  async findAll(query: QueryProductsDto) {
    this.logger.log(`Consultando productos - Página: ${query.page || 1}`);

    try {
      const {
        search,
        categoryId,
        subcategoryId,
        gender,
        size,
        isFeatured,
        inStock,
        page = 1,
        limit = 12,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = query;

      const skip: number = (page - 1) * limit;

      type WhereClause = {
        isActive: boolean;
        OR?: Array<{
          name?: { contains: string; mode: 'insensitive' };
          description?: { contains: string; mode: 'insensitive' };
        }>;
        categoryId?: string;
        subcategoryId?: string;
        isFeatured?: boolean;
        variants?: {
          some: {
            isActive: boolean;
            gender?: typeof gender;
            size?: typeof size;
            stock?: { gt: number };
          };
        };
      };

      const where: WhereClause = {
        isActive: true,
      };

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (categoryId) {
        where.categoryId = categoryId;
      }

      if (subcategoryId) {
        where.subcategoryId = subcategoryId;
      }

      if (isFeatured !== undefined) {
        where.isFeatured = isFeatured;
      }

      if (gender || size || inStock) {
        where.variants = {
          some: {
            isActive: true,
            ...(gender && { gender }),
            ...(size && { size }),
            ...(inStock && { stock: { gt: 0 } }),
          },
        };
      }

      const [products, total] = await Promise.all([
        this.prisma.product.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          include: {
            category: true,
            subcategory: true,
            variants: {
              where: { isActive: true },
              orderBy: { createdAt: 'asc' },
              include: {
                images: {
                  include: {
                    image: true,
                  },
                },
              },
            },
            images: {
              where: { isActive: true },
              orderBy: { order: 'asc' },
              include: {
                variants: {
                  include: {
                    variant: true,
                  },
                },
              },
            },
          },
        }),
        this.prisma.product.count({ where }),
      ]);

      this.logger.log(
        `${total} productos encontrados - Página ${page}/${Math.ceil(total / limit)}`,
      );

      return {
        data: products,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error('Error consultando productos', err.stack);
      throw error;
    }
  }

  /**
   * Obtiene un producto por ID con todas sus relaciones
   */
  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        subcategory: true,
        variants: {
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
          include: {
            images: {
              include: {
                image: true,
              },
            },
          },
        },
        images: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
          include: {
            variants: {
              include: {
                variant: true,
              },
            },
          },
        },
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    if (!product) {
      this.logger.warn(`Producto con ID "${id}" no encontrado`);
      throw new NotFoundException(`Producto con ID "${id}" no encontrado`);
    }

    return product;
  }

  /**
   * Obtener un producto por slug
   */
  async findBySlug(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        slug: slug,
        isActive: true,
      },
      include: {
        category: true,
        subcategory: true,
        variants: {
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
          include: {
            images: {
              include: {
                image: true,
              },
            },
          },
        },
        images: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
          include: {
            variants: {
              include: {
                variant: true,
              },
            },
          },
        },
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    if (!product) {
      this.logger.warn(`Producto con slug "${slug}" no encontrado`);
      throw new NotFoundException(`Producto con slug "${slug}" no encontrado`);
    }

    return product;
  }

  /**
   * Actualiza un producto existente
   */
  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    this.logger.log(`Actualizando producto ${id}`);

    try {
      await this.findOne(id);

      let slug: string | undefined;
      if (updateProductDto.name) {
        slug = this.generateSlug(updateProductDto.name);

        const existingProduct: Product | null =
          await this.prisma.product.findFirst({
            where: {
              slug,
              NOT: { id },
            },
          });

        if (existingProduct) {
          this.logger.warn(`Slug "${slug}" ya existe en otro producto`);
          throw new ConflictException(
            `Ya existe un producto con el slug "${slug}"`,
          );
        }
      }

      if (updateProductDto.categoryId) {
        const category = await this.prisma.category.findUnique({
          where: { id: updateProductDto.categoryId },
        });

        if (!category) {
          this.logger.warn(
            `Categoría ${updateProductDto.categoryId} no encontrada`,
          );
          throw new NotFoundException(
            `Categoría con ID "${updateProductDto.categoryId}" no encontrada`,
          );
        }
      }

      if (updateProductDto.subcategoryId) {
        const subcategory = await this.prisma.subcategory.findUnique({
          where: { id: updateProductDto.subcategoryId },
        });

        if (!subcategory) {
          this.logger.warn(
            `Subcategoría ${updateProductDto.subcategoryId} no encontrada`,
          );
          throw new NotFoundException(
            `Subcategoría con ID "${updateProductDto.subcategoryId}" no encontrada`,
          );
        }
      }

      const product = await this.prisma.product.update({
        where: { id },
        data: {
          ...updateProductDto,
          ...(slug && { slug }),
        },
        include: {
          category: true,
          subcategory: true,
        },
      });

      this.logger.log(`Producto ${id} actualizado exitosamente`);

      this.eventEmitter.emit(
        ProductUpdatedEvent.EVENT,
        new ProductUpdatedEvent(product.id, product.name),
      );

      return product;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(`Error actualizando producto ${id}`, err.stack, { id });
      throw error;
    }
  }

  /**
   * Elimina un producto (soft delete)
   */
  async remove(id: string): Promise<Product> {
    this.logger.log(`Desactivando producto ${id}`);

    try {
      await this.findOne(id);

      const product = await this.prisma.product.update({
        where: { id },
        data: { isActive: false },
      });

      this.logger.log(`Producto ${id} desactivado exitosamente`);

      this.eventEmitter.emit(
        ProductDeletedEvent.EVENT,
        new ProductDeletedEvent(product.id, product.name),
      );

      return product;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(`Error desactivando producto ${id}`, err.stack, { id });
      throw error;
    }
  }

  /**
   * Crea una nueva variante de producto
   */
  async createVariant(
    createVariantDto: CreateVariantDto,
  ): Promise<ProductVariant> {
    this.logger.log(
      `Creando variante para producto ${createVariantDto.productId} - SKU: ${createVariantDto.sku}`,
    );

    try {
      const product = await this.prisma.product.findUnique({
        where: { id: createVariantDto.productId },
      });

      if (!product) {
        this.logger.warn(
          `Producto ${createVariantDto.productId} no encontrado`,
        );
        throw new NotFoundException(
          `Producto con ID "${createVariantDto.productId}" no encontrado`,
        );
      }

      const existingVariant: ProductVariant | null =
        await this.prisma.productVariant.findUnique({
          where: { sku: createVariantDto.sku },
        });

      if (existingVariant) {
        this.logger.warn(`SKU "${createVariantDto.sku}" ya existe`);
        throw new ConflictException(
          `Ya existe una variante con el SKU "${createVariantDto.sku}"`,
        );
      }

      const variant = await this.prisma.productVariant.create({
        data: {
          ...createVariantDto,
          isActive: true,
        },
      });

      this.logger.log(
        `Variante creada exitosamente - ID: ${variant.id}, SKU: ${variant.sku}, Stock: ${variant.stock}`,
      );

      return variant;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(
        `Error creando variante - SKU: ${createVariantDto.sku}`,
        err.stack,
        { sku: createVariantDto.sku, productId: createVariantDto.productId },
      );
      throw error;
    }
  }

  /**
   * Obtiene todas las variantes de un producto
   */
  async findVariantsByProduct(productId: string): Promise<ProductVariant[]> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      this.logger.warn(`Producto ${productId} no encontrado`);
      throw new NotFoundException(
        `Producto con ID "${productId}" no encontrado`,
      );
    }

    return this.prisma.productVariant.findMany({
      where: {
        productId,
        isActive: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Actualiza una variante existente
   * Desactiva automáticamente si stock = 0
   */
  async updateVariant(
    id: string,
    updateVariantDto: UpdateVariantDto,
  ): Promise<ProductVariant> {
    this.logger.log(`Actualizando variante ${id}`);

    try {
      const variant = await this.prisma.productVariant.findUnique({
        where: { id },
      });

      if (!variant) {
        this.logger.warn(`Variante ${id} no encontrada`);
        throw new NotFoundException(`Variante con ID "${id}" no encontrada`);
      }

      if (updateVariantDto.sku && updateVariantDto.sku !== variant.sku) {
        const existingVariant: ProductVariant | null =
          await this.prisma.productVariant.findUnique({
            where: { sku: updateVariantDto.sku },
          });

        if (existingVariant) {
          this.logger.warn(`SKU "${updateVariantDto.sku}" ya existe`);
          throw new ConflictException(
            `Ya existe una variante con el SKU "${updateVariantDto.sku}"`,
          );
        }
      }

      const updatedVariant = await this.prisma.productVariant.update({
        where: { id },
        data: updateVariantDto,
      });

      this.logger.log(`Variante ${id} actualizada exitosamente`);

      return updatedVariant;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(`Error actualizando variante ${id}`, err.stack, { id });
      throw error;
    }
  }

  /**
   * Elimina una variante (soft delete)
   */
  async removeVariant(id: string): Promise<ProductVariant> {
    this.logger.log(`Eliminando variante ${id}`);

    try {
      const variant = await this.prisma.productVariant.findUnique({
        where: { id },
        include: { _count: { select: { orderItems: true } } },
      });

      if (!variant) {
        this.logger.warn(`Variante ${id} no encontrada`);
        throw new NotFoundException(`Variante con ID "${id}" no encontrada`);
      }

      // Si tiene órdenes asociadas, soft delete para preservar historial
      if (variant._count.orderItems > 0) {
        const softDeleted = await this.prisma.productVariant.update({
          where: { id },
          data: { isActive: false },
        });
        this.logger.log(`Variante ${id} desactivada (tiene ${variant._count.orderItems} órdenes)`);
        return softDeleted;
      }

      // Sin órdenes: hard delete para liberar el SKU
      const deleted = await this.prisma.productVariant.delete({ where: { id } });
      this.logger.log(`Variante ${id} eliminada definitivamente`);
      return deleted;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(`Error eliminando variante ${id}`, err.stack, { id });
      throw error;
    }
  }

  /**
   * Agrega una imagen a un producto y la asocia con múltiples variantes
   * Valida que no se excedan 5 imágenes por producto
   */
  async addImage(createImageDto: CreateProductImageDto): Promise<ProductImage> {
    this.logger.log(`Agregando imagen a producto ${createImageDto.productId}`);

    try {
      const product = await this.prisma.product.findUnique({
        where: { id: createImageDto.productId },
        include: {
          images: {
            where: { isActive: true },
          },
        },
      });

      if (!product) {
        this.logger.warn(`Producto ${createImageDto.productId} no encontrado`);
        throw new NotFoundException(
          `Producto con ID "${createImageDto.productId}" no encontrado`,
        );
      }

      if (createImageDto.variantIds && createImageDto.variantIds.length > 0) {
        for (const variantId of createImageDto.variantIds) {
          const variant = await this.prisma.productVariant.findUnique({
            where: { id: variantId },
          });

          if (!variant) {
            this.logger.warn(`Variante ${variantId} no encontrada`);
            throw new NotFoundException(
              `Variante con ID "${variantId}" no encontrada`,
            );
          }

          if (variant.productId !== createImageDto.productId) {
            this.logger.warn(
              `Variante ${variantId} no pertenece a producto ${createImageDto.productId}`,
            );
            throw new BadRequestException(
              `La variante ${variantId} no pertenece al producto especificado`,
            );
          }
        }
      }

      if (product.images.length >= 5) {
        this.logger.warn(
          `Producto ${createImageDto.productId} ya tiene 5 imágenes`,
        );
        throw new BadRequestException(
          'No se pueden agregar más de 5 imágenes por producto',
        );
      }

      const existingImageWithOrder = product.images.find(
        (img) => img.order === createImageDto.order,
      );

      if (existingImageWithOrder) {
        this.logger.warn(
          `Orden ${createImageDto.order} ya existe para producto ${createImageDto.productId}`,
        );
        throw new ConflictException(
          `Ya existe una imagen con orden ${createImageDto.order} para este producto`,
        );
      }

      const { variantIds, ...imageData } = createImageDto;

      const image = await this.prisma.productImage.create({
        data: {
          ...imageData,
          ...(variantIds &&
            variantIds.length > 0 && {
              variants: {
                create: variantIds.map((variantId) => ({
                  variant: {
                    connect: { id: variantId },
                  },
                })),
              },
            }),
        },
        include: {
          variants: {
            include: {
              variant: true,
            },
          },
        },
      });

      this.logger.log(
        `Imagen agregada exitosamente - ID: ${image.id}, Producto: ${createImageDto.productId}, Variantes: ${variantIds?.length || 0}`,
      );

      return image;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(
        `Error agregando imagen a producto ${createImageDto.productId}`,
        err.stack,
        { productId: createImageDto.productId },
      );
      throw error;
    }
  }

  /**
   * Elimina una imagen de producto (soft delete)
   */
  async updateImageVariants(
    imageId: string,
    variantIds: string[],
  ): Promise<ProductImage> {
    this.logger.log(`Actualizando variantes de imagen ${imageId}`);

    try {
      const image = await this.prisma.productImage.findUnique({
        where: { id: imageId },
        include: { variants: true },
      });

      if (!image) {
        throw new NotFoundException(`Imagen con ID "${imageId}" no encontrada`);
      }

      await this.prisma.productImageVariant.deleteMany({
        where: { imageId },
      });

      const updated = await this.prisma.productImage.update({
        where: { id: imageId },
        data: {
          variants: {
            create: variantIds.map((variantId) => ({
              variant: { connect: { id: variantId } },
            })),
          },
        },
        include: {
          variants: { include: { variant: true } },
        },
      });

      this.logger.log(
        `Imagen ${imageId} ahora asociada a ${variantIds.length} variante(s)`,
      );

      return updated;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(
        `Error actualizando variantes de imagen ${imageId}`,
        err.stack,
      );
      throw error;
    }
  }

  async removeImage(id: string): Promise<ProductImage> {
    this.logger.log(`Desactivando imagen ${id}`);

    try {
      const image = await this.prisma.productImage.findUnique({
        where: { id },
      });

      if (!image) {
        this.logger.warn(`Imagen ${id} no encontrada`);
        throw new NotFoundException(`Imagen con ID "${id}" no encontrada`);
      }

      const deletedImage = await this.prisma.productImage.update({
        where: { id },
        data: { isActive: false },
      });

      this.logger.log(`Imagen ${id} desactivada exitosamente`);

      return deletedImage;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(`Error desactivando imagen ${id}`, err.stack, { id });
      throw error;
    }
  }
}
