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
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateSubcategoryDto } from './dto/create-subcategory.dto';
import { UpdateSubcategoryDto } from './dto/update-subcategory.dto';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  /**
   * Crear una nueva categoría
   * @route POST /categories
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoriesService.create(createCategoryDto);
  }

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

  /**
   * Actualizar una categoría existente
   * @route PATCH /categories/:id
   */
  @Patch(':id')
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
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }

  /**
   * Crear una nueva subcategoría
   * @route POST /categories/subcategories
   */
  @Post('subcategories')
  @HttpCode(HttpStatus.CREATED)
  createSubcategory(@Body() createSubcategoryDto: CreateSubcategoryDto) {
    return this.categoriesService.createSubcategory(createSubcategoryDto);
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

  /**
   * Actualizar una subcategoría existente
   * @route PATCH /categories/subcategories/:id
   */
  @Patch('subcategories/:id')
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
  removeSubcategory(@Param('id') id: string) {
    return this.categoriesService.removeSubcategory(id);
  }
}
