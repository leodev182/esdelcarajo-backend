import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateSubcategoryDto } from './dto/create-subcategory.dto';
import { UpdateSubcategoryDto } from './dto/update-subcategory.dto';
import { Category, Subcategory } from '@prisma/client';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate URL-friendly slug from name
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
   * Create a new category
   */
  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    const slug: string = this.generateSlug(createCategoryDto.name);

    const existingCategory: Category | null =
      await this.prisma.category.findUnique({
        where: { slug },
      });

    if (existingCategory) {
      throw new ConflictException(
        `Category with slug "${slug}" already exists`,
      );
    }

    return this.prisma.category.create({
      data: {
        ...createCategoryDto,
        slug,
      },
    });
  }

  /**
   * Get all active categories with their subcategories
   */
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

  /**
   * Get a single category by ID
   */
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
      throw new NotFoundException(`Category with ID "${id}" not found`);
    }

    return category;
  }

  /**
   * Update a category
   */
  async update(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<Category> {
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
        throw new ConflictException(
          `Category with slug "${slug}" already exists`,
        );
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        ...updateCategoryDto,
        ...(slug && { slug }),
      },
    });
  }

  /**
   * Soft delete a category
   */
  async remove(id: string): Promise<Category> {
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
      throw new BadRequestException(
        'Cannot delete category with active products',
      );
    }

    return this.prisma.category.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Create a new subcategory
   */
  async createSubcategory(
    createSubcategoryDto: CreateSubcategoryDto,
  ): Promise<Subcategory> {
    const category: Category | null = await this.prisma.category.findUnique({
      where: { id: createSubcategoryDto.categoryId },
    });

    if (!category) {
      throw new NotFoundException(
        `Category with ID "${createSubcategoryDto.categoryId}" not found`,
      );
    }

    const slug: string = this.generateSlug(createSubcategoryDto.name);

    const existingSubcategory: Subcategory | null =
      await this.prisma.subcategory.findFirst({
        where: {
          slug,
          categoryId: createSubcategoryDto.categoryId,
        },
      });

    if (existingSubcategory) {
      throw new ConflictException(
        `Subcategory with slug "${slug}" already exists in this category`,
      );
    }

    return this.prisma.subcategory.create({
      data: {
        ...createSubcategoryDto,
        slug,
      },
    });
  }

  /**
   * Get all subcategories for a category
   */
  async findAllSubcategories(categoryId: string): Promise<Subcategory[]> {
    const category: Category | null = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
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

  /**
   * Get a single subcategory by ID
   */
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
      throw new NotFoundException(`Subcategory with ID "${id}" not found`);
    }

    return subcategory;
  }

  /**
   * Update a subcategory
   */
  async updateSubcategory(
    id: string,
    updateSubcategoryDto: UpdateSubcategoryDto,
  ): Promise<Subcategory> {
    await this.findOneSubcategory(id);

    let slug: string | undefined;
    if (updateSubcategoryDto.name) {
      slug = this.generateSlug(updateSubcategoryDto.name);

      const existingSubcategory: Subcategory | null =
        await this.prisma.subcategory.findFirst({
          where: {
            slug,
            categoryId: updateSubcategoryDto.categoryId,
            NOT: { id },
          },
        });

      if (existingSubcategory) {
        throw new ConflictException(
          `Subcategory with slug "${slug}" already exists in this category`,
        );
      }
    }

    return this.prisma.subcategory.update({
      where: { id },
      data: {
        ...updateSubcategoryDto,
        ...(slug && { slug }),
      },
    });
  }

  /**
   * Soft delete a subcategory
   */
  async removeSubcategory(id: string): Promise<Subcategory> {
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
      throw new BadRequestException(
        'Cannot delete subcategory with active products',
      );
    }

    return this.prisma.subcategory.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
