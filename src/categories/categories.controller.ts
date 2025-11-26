import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateSubcategoryDto } from './dto/create-subcategory.dto';
import { UpdateSubcategoryDto } from './dto/update-subcategory.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  // ==================== ENDPOINTS PÚBLICOS ====================

  /**
   * Obtener todas las categorías activas con sus subcategorías
   * @route GET /categories
   */
  @Get()
  findAll() {
    return this.categoriesService.findAll();
  }

  /**
   * Obtener una categoría por ID
   * @route GET /categories/:id
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(id);
  }

  /**   * Obtener una categoría por slug
   * @route GET /categories/slug/:slug
   */

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Obtener categoría por slug' })
  findBySlug(@Param('slug') slug: string) {
    return this.categoriesService.findBySlug(slug);
  }

  /**
   * Obtener todas las subcategorías de una categoría
   * @route GET /categories/:categoryId/subcategories
   */
  @Get(':categoryId/subcategories')
  findAllSubcategories(@Param('categoryId') categoryId: string) {
    return this.categoriesService.findAllSubcategories(categoryId);
  }

  /**
   * Obtener una subcategoría por ID
   * @route GET /categories/subcategories/:id
   */
  @Get('subcategories/:id')
  findOneSubcategory(@Param('id') id: string) {
    return this.categoriesService.findOneSubcategory(id);
  }

  // ==================== ENDPOINTS ADMIN ====================

  /**
   * Crear una nueva categoría
   * @route POST /categories
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoriesService.create(createCategoryDto);
  }

  /**
   * Actualizar una categoría existente
   * @route PATCH /categories/:id
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  /**
   * Eliminar una categoría (soft delete)
   * @route DELETE /categories/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }

  /**
   * Crear una nueva subcategoría
   * @route POST /categories/subcategories
   */
  @Post('subcategories')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  createSubcategory(@Body() createSubcategoryDto: CreateSubcategoryDto) {
    return this.categoriesService.createSubcategory(createSubcategoryDto);
  }

  /**
   * Actualizar una subcategoría existente
   * @route PATCH /categories/subcategories/:id
   */
  @Patch('subcategories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  updateSubcategory(
    @Param('id') id: string,
    @Body() updateSubcategoryDto: UpdateSubcategoryDto,
  ) {
    return this.categoriesService.updateSubcategory(id, updateSubcategoryDto);
  }

  /**
   * Eliminar una subcategoría (soft delete)
   * @route DELETE /categories/subcategories/:id
   */
  @Delete('subcategories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  removeSubcategory(@Param('id') id: string) {
    return this.categoriesService.removeSubcategory(id);
  }
}
