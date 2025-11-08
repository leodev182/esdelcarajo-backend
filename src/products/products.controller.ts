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
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateVariantDto } from './dto/create-variant.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';
import { CreateProductImageDto } from './dto/create-product-image.dto';
import { QueryProductsDto } from './dto/query-products.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  /**
   * Crear un nuevo producto
   * @route POST /products
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

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
   * Actualizar un producto existente
   * @route PATCH /products/:id
   */
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(id, updateProductDto);
  }

  /**
   * Eliminar un producto (soft delete)
   * @route DELETE /products/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  /**
   * Crear una nueva variante de producto
   * @route POST /products/variants
   */
  @Post('variants')
  @HttpCode(HttpStatus.CREATED)
  createVariant(@Body() createVariantDto: CreateVariantDto) {
    return this.productsService.createVariant(createVariantDto);
  }

  /**
   * Obtener todas las variantes de un producto
   * @route GET /products/:productId/variants
   */
  @Get(':productId/variants')
  findVariantsByProduct(@Param('productId') productId: string) {
    return this.productsService.findVariantsByProduct(productId);
  }

  /**
   * Actualizar una variante existente
   * @route PATCH /products/variants/:id
   */
  @Patch('variants/:id')
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
  removeVariant(@Param('id') id: string) {
    return this.productsService.removeVariant(id);
  }

  /**
   * Agregar una imagen a un producto
   * @route POST /products/images
   */
  @Post('images')
  @HttpCode(HttpStatus.CREATED)
  addImage(@Body() createImageDto: CreateProductImageDto) {
    return this.productsService.addImage(createImageDto);
  }

  /**
   * Eliminar una imagen de producto (soft delete)
   * @route DELETE /products/images/:id
   */
  @Delete('images/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeImage(@Param('id') id: string) {
    return this.productsService.removeImage(id);
  }
}
