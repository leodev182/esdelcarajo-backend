import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateVariantDto } from './dto/create-variant.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';
import { CreateProductImageDto } from './dto/create-product-image.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { Product, ProductVariant, ProductImage } from '@prisma/client';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

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
    const slug: string = this.generateSlug(createProductDto.name);

    const existingProduct: Product | null =
      await this.prisma.product.findUnique({
        where: { slug },
      });

    if (existingProduct) {
      throw new ConflictException(
        `Ya existe un producto con el slug "${slug}"`,
      );
    }

    const category = await this.prisma.category.findUnique({
      where: { id: createProductDto.categoryId },
    });

    if (!category) {
      throw new NotFoundException(
        `Categoría con ID "${createProductDto.categoryId}" no encontrada`,
      );
    }

    if (createProductDto.subcategoryId) {
      const subcategory = await this.prisma.subcategory.findUnique({
        where: { id: createProductDto.subcategoryId },
      });

      if (!subcategory) {
        throw new NotFoundException(
          `Subcategoría con ID "${createProductDto.subcategoryId}" no encontrada`,
        );
      }

      if (subcategory.categoryId !== createProductDto.categoryId) {
        throw new BadRequestException(
          'La subcategoría no pertenece a la categoría especificada',
        );
      }
    }

    return this.prisma.product.create({
      data: {
        ...createProductDto,
        slug,
      },
      include: {
        category: true,
        subcategory: true,
      },
    });
  }

  /**
   * Obtiene productos con filtros, búsqueda y paginación
   */
  async findAll(query: QueryProductsDto) {
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
          },
          images: {
            where: { isActive: true },
            orderBy: { order: 'asc' },
          },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
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
        },
        images: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
        },
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Producto con ID "${id}" no encontrado`);
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
        throw new NotFoundException(
          `Subcategoría con ID "${updateProductDto.subcategoryId}" no encontrada`,
        );
      }
    }

    return this.prisma.product.update({
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
  }

  /**
   * Elimina un producto (soft delete)
   */
  async remove(id: string): Promise<Product> {
    await this.findOne(id);

    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Crea una nueva variante de producto
   */
  async createVariant(
    createVariantDto: CreateVariantDto,
  ): Promise<ProductVariant> {
    const product = await this.prisma.product.findUnique({
      where: { id: createVariantDto.productId },
    });

    if (!product) {
      throw new NotFoundException(
        `Producto con ID "${createVariantDto.productId}" no encontrado`,
      );
    }

    const existingVariant: ProductVariant | null =
      await this.prisma.productVariant.findUnique({
        where: { sku: createVariantDto.sku },
      });

    if (existingVariant) {
      throw new ConflictException(
        `Ya existe una variante con el SKU "${createVariantDto.sku}"`,
      );
    }

    const isActive: boolean = createVariantDto.stock > 0;

    return this.prisma.productVariant.create({
      data: {
        ...createVariantDto,
        isActive,
      },
    });
  }

  /**
   * Obtiene todas las variantes de un producto
   */
  async findVariantsByProduct(productId: string): Promise<ProductVariant[]> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
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
    const variant = await this.prisma.productVariant.findUnique({
      where: { id },
    });

    if (!variant) {
      throw new NotFoundException(`Variante con ID "${id}" no encontrada`);
    }

    if (updateVariantDto.sku && updateVariantDto.sku !== variant.sku) {
      const existingVariant: ProductVariant | null =
        await this.prisma.productVariant.findUnique({
          where: { sku: updateVariantDto.sku },
        });

      if (existingVariant) {
        throw new ConflictException(
          `Ya existe una variante con el SKU "${updateVariantDto.sku}"`,
        );
      }
    }

    const isActive: boolean =
      updateVariantDto.stock !== undefined
        ? updateVariantDto.stock > 0
        : variant.stock > 0;

    return this.prisma.productVariant.update({
      where: { id },
      data: {
        ...updateVariantDto,
        isActive,
      },
    });
  }

  /**
   * Elimina una variante (soft delete)
   */
  async removeVariant(id: string): Promise<ProductVariant> {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id },
    });

    if (!variant) {
      throw new NotFoundException(`Variante con ID "${id}" no encontrada`);
    }

    return this.prisma.productVariant.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Agrega una imagen a un producto
   * Valida que no se excedan 5 imágenes por producto
   */
  async addImage(createImageDto: CreateProductImageDto): Promise<ProductImage> {
    const product = await this.prisma.product.findUnique({
      where: { id: createImageDto.productId },
      include: {
        images: {
          where: { isActive: true },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(
        `Producto con ID "${createImageDto.productId}" no encontrado`,
      );
    }

    if (product.images.length >= 5) {
      throw new BadRequestException(
        'No se pueden agregar más de 5 imágenes por producto',
      );
    }

    const existingImageWithOrder = product.images.find(
      (img) => img.order === createImageDto.order,
    );

    if (existingImageWithOrder) {
      throw new ConflictException(
        `Ya existe una imagen con orden ${createImageDto.order} para este producto`,
      );
    }

    return this.prisma.productImage.create({
      data: createImageDto,
    });
  }

  /**
   * Elimina una imagen de producto (soft delete)
   */
  async removeImage(id: string): Promise<ProductImage> {
    const image = await this.prisma.productImage.findUnique({
      where: { id },
    });

    if (!image) {
      throw new NotFoundException(`Imagen con ID "${id}" no encontrada`);
    }

    return this.prisma.productImage.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
