import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthRequest } from '../common/interfaces/auth-request.interface';

/**
 * Controlador para gestionar el carrito de compras
 * Todos los endpoints requieren autenticación
 */
@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  /**
   * GET /cart
   * Obtener el carrito del usuario autenticado con totales calculados
   */
  @Get()
  async getCart(@Request() req: AuthRequest) {
    return this.cartService.getCartWithTotals(req.user.id);
  }

  /**
   * POST /cart
   * Agregar un producto al carrito
   * - Si ya existe, suma las cantidades
   * - Valida stock disponible
   * - Renueva expiración (+5 días)
   */
  @Post()
  async addToCart(@Request() req: AuthRequest, @Body() dto: AddToCartDto) {
    return this.cartService.addToCart(req.user.id, dto);
  }

  /**
   * PATCH /cart/items/:itemId
   * Actualizar cantidad de un item del carrito
   * Valida stock disponible y renueva expiración
   */
  @Patch('items/:itemId')
  async updateCartItem(
    @Request() req: AuthRequest,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateCartItem(req.user.id, itemId, dto);
  }

  /**
   * DELETE /cart/items/:itemId
   * Eliminar un item específico del carrito (hard delete)
   */
  @Delete('items/:itemId')
  async removeCartItem(
    @Request() req: AuthRequest,
    @Param('itemId') itemId: string,
  ) {
    return this.cartService.removeCartItem(req.user.id, itemId);
  }

  /**
   * DELETE /cart
   * Vaciar el carrito completo (hard delete de todos los items)
   */
  @Delete()
  async clearCart(@Request() req: AuthRequest) {
    return this.cartService.clearCart(req.user.id);
  }
}
