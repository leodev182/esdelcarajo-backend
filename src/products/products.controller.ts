import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateVariantDto } from './dto/create-variant.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';
import { CreateProductImageDto } from './dto/create-product-image.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // ==================== ENDPOINTS PÚBLICOS ====================

  /**
   * Obtener todos los productos con filtros, búsqueda y paginación
   * @route GET /products?search=franela&categoryId=xxx&page=1&limit=12
   */
  @Get()
  findAll(@Query() query: QueryProductsDto) {
    return this.productsService.findAll(query);
  }

  /**
   * Obtener un producto por ID con todas sus relaciones
   * @route GET /products/:id
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  /**
   * Obtener todas las variantes de un producto
   * @route GET /products/:productId/variants
   */
  @Get(':productId/variants')
  findVariantsByProduct(@Param('productId') productId: string) {
    return this.productsService.findVariantsByProduct(productId);
  }

  // ==================== ENDPOINTS ADMIN ====================

  /**
   * Crear un nuevo producto
   * @route POST /products
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  /**
   * Actualizar un producto existente
   * @route PATCH /products/:id
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(id, updateProductDto);
  }

  /**
   * Eliminar un producto (soft delete)
   * @route DELETE /products/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  /**
   * Crear una nueva variante de producto
   * @route POST /products/variants
   */
  @Post('variants')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  createVariant(@Body() createVariantDto: CreateVariantDto) {
    return this.productsService.createVariant(createVariantDto);
  }

  /**
   * Actualizar una variante existente
   * @route PATCH /products/variants/:id
   */
  @Patch('variants/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  updateVariant(
    @Param('id') id: string,
    @Body() updateVariantDto: UpdateVariantDto,
  ) {
    return this.productsService.updateVariant(id, updateVariantDto);
  }

  /**
   * Eliminar una variante (soft delete)
   * @route DELETE /products/variants/:id
   */
  @Delete('variants/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  removeVariant(@Param('id') id: string) {
    return this.productsService.removeVariant(id);
  }

  /**
   * Agregar una imagen a un producto
   * @route POST /products/images
   */
  @Post('images')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  addImage(@Body() createImageDto: CreateProductImageDto) {
    return this.productsService.addImage(createImageDto);
  }

  /**
   * Eliminar una imagen de producto (soft delete)
   * @route DELETE /products/images/:id
   */
  @Delete('images/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  removeImage(@Param('id') id: string) {
    return this.productsService.removeImage(id);
  }
}
