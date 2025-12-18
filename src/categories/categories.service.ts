import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateSubcategoryDto } from './dto/create-subcategory.dto';
import { UpdateSubcategoryDto } from './dto/update-subcategory.dto';
import { Category, Subcategory } from '@prisma/client';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(private readonly prisma: PrismaService) {}

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  private generateSubcategorySlug(categorySlug: string, name: string): string {
    const baseSlug = this.generateSlug(name);
    return `${categorySlug}-${baseSlug}`;
  }

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    this.logger.log(`Creando categoría: ${createCategoryDto.name}`);

    try {
      const slug: string = this.generateSlug(createCategoryDto.name);

      const existingCategory: Category | null =
        await this.prisma.category.findUnique({
          where: { slug },
        });

      if (existingCategory) {
        this.logger.warn(`Categoría con slug "${slug}" ya existe`);
        throw new ConflictException(
          `Category with slug "${slug}" already exists`,
        );
      }

      const category = await this.prisma.category.create({
        data: {
          ...createCategoryDto,
          slug,
        },
      });

      this.logger.log(
        `Categoría creada exitosamente - ID: ${category.id}, Slug: ${slug}`,
      );

      return category;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(
        `Error creando categoría: ${createCategoryDto.name}`,
        err.stack,
        { categoryName: createCategoryDto.name },
      );
      throw error;
    }
  }

  async findAll() {
    return this.prisma.category.findMany({
      where: { isActive: true },
      include: {
        subcategories: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { order: 'asc' },
    });
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        subcategories: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
        },
        products: {
          where: { isActive: true },
          take: 10,
        },
      },
    });

    if (!category) {
      this.logger.warn(`Categoría ${id} no encontrada`);
      throw new NotFoundException(`Category with ID "${id}" not found`);
    }

    return category;
  }

  async findBySlug(slug: string) {
    const category = await this.prisma.category.findFirst({
      where: {
        slug,
        isActive: true,
      },
      include: {
        subcategories: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
        },
        products: {
          where: { isActive: true },
          take: 10,
        },
      },
    });

    if (!category) {
      this.logger.warn(`Categoría con slug "${slug}" no encontrada`);
      throw new NotFoundException(`Category with slug "${slug}" not found`);
    }

    return category;
  }

  async update(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<Category> {
    this.logger.log(`Actualizando categoría ${id}`);

    try {
      await this.findOne(id);

      let slug: string | undefined;
      if (updateCategoryDto.name) {
        slug = this.generateSlug(updateCategoryDto.name);

        const existingCategory: Category | null =
          await this.prisma.category.findFirst({
            where: {
              slug,
              NOT: { id },
            },
          });

        if (existingCategory) {
          this.logger.warn(`Slug "${slug}" ya existe en otra categoría`);
          throw new ConflictException(
            `Category with slug "${slug}" already exists`,
          );
        }
      }

      const category = await this.prisma.category.update({
        where: { id },
        data: {
          ...updateCategoryDto,
          ...(slug && { slug }),
        },
      });

      this.logger.log(`Categoría ${id} actualizada exitosamente`);

      return category;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(`Error actualizando categoría ${id}`, err.stack, {
        id,
      });
      throw error;
    }
  }

  async remove(id: string): Promise<Category> {
    this.logger.log(`Desactivando categoría ${id}`);

    try {
      await this.findOne(id);

      const categoryWithProducts = await this.prisma.category.findUnique({
        where: { id },
        include: {
          products: {
            where: { isActive: true },
          },
        },
      });

      if (categoryWithProducts && categoryWithProducts.products.length > 0) {
        this.logger.warn(
          `Intento de eliminar categoría ${id} con ${categoryWithProducts.products.length} productos activos`,
        );
        throw new BadRequestException(
          'Cannot delete category with active products',
        );
      }

      const category = await this.prisma.category.update({
        where: { id },
        data: { isActive: false },
      });

      this.logger.log(`Categoría ${id} desactivada exitosamente`);

      return category;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(`Error desactivando categoría ${id}`, err.stack, {
        id,
      });
      throw error;
    }
  }

  async createSubcategory(
    createSubcategoryDto: CreateSubcategoryDto,
  ): Promise<Subcategory> {
    this.logger.log(
      `Creando subcategoría "${createSubcategoryDto.name}" en categoría ${createSubcategoryDto.categoryId}`,
    );

    try {
      const category: Category | null = await this.prisma.category.findUnique({
        where: { id: createSubcategoryDto.categoryId },
      });

      if (!category) {
        this.logger.warn(
          `Categoría ${createSubcategoryDto.categoryId} no encontrada`,
        );
        throw new NotFoundException(
          `Category with ID "${createSubcategoryDto.categoryId}" not found`,
        );
      }

      const slug: string = this.generateSubcategorySlug(
        category.slug,
        createSubcategoryDto.name,
      );

      const existingSubcategory: Subcategory | null =
        await this.prisma.subcategory.findFirst({
          where: {
            name: createSubcategoryDto.name,
            categoryId: createSubcategoryDto.categoryId,
          },
        });

      if (existingSubcategory) {
        this.logger.warn(
          `Subcategoría "${createSubcategoryDto.name}" ya existe en categoría ${createSubcategoryDto.categoryId}`,
        );
        throw new ConflictException(
          `Subcategory "${createSubcategoryDto.name}" already exists in this category`,
        );
      }

      const subcategory = await this.prisma.subcategory.create({
        data: {
          ...createSubcategoryDto,
          slug,
        },
      });

      this.logger.log(
        `Subcategoría creada exitosamente - ID: ${subcategory.id}, Slug: ${slug}`,
      );

      return subcategory;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(
        `Error creando subcategoría: ${createSubcategoryDto.name}`,
        err.stack,
        { subcategoryName: createSubcategoryDto.name },
      );
      throw error;
    }
  }

  async findAllSubcategories(categoryId: string): Promise<Subcategory[]> {
    const category: Category | null = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      this.logger.warn(`Categoría ${categoryId} no encontrada`);
      throw new NotFoundException(`Category with ID "${categoryId}" not found`);
    }

    return this.prisma.subcategory.findMany({
      where: {
        categoryId,
        isActive: true,
      },
      orderBy: { order: 'asc' },
    });
  }

  async findOneSubcategory(id: string) {
    const subcategory = await this.prisma.subcategory.findUnique({
      where: { id },
      include: {
        category: true,
        products: {
          where: { isActive: true },
          take: 10,
        },
      },
    });

    if (!subcategory) {
      this.logger.warn(`Subcategoría ${id} no encontrada`);
      throw new NotFoundException(`Subcategory with ID "${id}" not found`);
    }

    return subcategory;
  }

  async updateSubcategory(
    id: string,
    updateSubcategoryDto: UpdateSubcategoryDto,
  ): Promise<Subcategory> {
    this.logger.log(`Actualizando subcategoría ${id}`);

    try {
      const subcategory = await this.findOneSubcategory(id);

      let slug: string | undefined;
      if (updateSubcategoryDto.name) {
        const category = await this.prisma.category.findUnique({
          where: { id: subcategory.categoryId },
        });

        if (!category) {
          throw new NotFoundException('Category not found');
        }

        slug = this.generateSubcategorySlug(
          category.slug,
          updateSubcategoryDto.name,
        );

        const existingSubcategory: Subcategory | null =
          await this.prisma.subcategory.findFirst({
            where: {
              name: updateSubcategoryDto.name,
              categoryId: subcategory.categoryId,
              NOT: { id },
            },
          });

        if (existingSubcategory) {
          this.logger.warn(
            `Subcategoría "${updateSubcategoryDto.name}" ya existe en esta categoría`,
          );
          throw new ConflictException(
            `Subcategory "${updateSubcategoryDto.name}" already exists in this category`,
          );
        }
      }

      const updated = await this.prisma.subcategory.update({
        where: { id },
        data: {
          ...updateSubcategoryDto,
          ...(slug && { slug }),
        },
      });

      this.logger.log(`Subcategoría ${id} actualizada exitosamente`);

      return updated;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(`Error actualizando subcategoría ${id}`, err.stack, {
        id,
      });
      throw error;
    }
  }

  async removeSubcategory(id: string): Promise<Subcategory> {
    this.logger.log(`Desactivando subcategoría ${id}`);

    try {
      await this.findOneSubcategory(id);

      const subcategoryWithProducts = await this.prisma.subcategory.findUnique({
        where: { id },
        include: {
          products: {
            where: { isActive: true },
          },
        },
      });

      if (
        subcategoryWithProducts &&
        subcategoryWithProducts.products.length > 0
      ) {
        this.logger.warn(
          `Intento de eliminar subcategoría ${id} con ${subcategoryWithProducts.products.length} productos activos`,
        );
        throw new BadRequestException(
          'Cannot delete subcategory with active products',
        );
      }

      const subcategory = await this.prisma.subcategory.update({
        where: { id },
        data: { isActive: false },
      });

      this.logger.log(`Subcategoría ${id} desactivada exitosamente`);

      return subcategory;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(`Error desactivando subcategoría ${id}`, err.stack, {
        id,
      });
      throw error;
    }
  }
}
