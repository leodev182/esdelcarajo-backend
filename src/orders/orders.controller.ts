import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthRequest } from '../common/interfaces/auth-request.interface';

/**
 * Controlador para gestionar órdenes de compra
 * - Usuarios pueden crear y ver sus órdenes
 * - Admins pueden ver todas y actualizar estados
 */
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * POST /orders
   * Crear una nueva orden desde el carrito
   * - Valida stock disponible
   * - Crea snapshots de productos
   * - Reduce stock de variantes
   * - Vacía el carrito
   */
  @Post()
  async createOrder(@Request() req: AuthRequest, @Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(req.user.id, dto);
  }

  /**
   * GET /orders
   * Obtener órdenes del usuario autenticado
   * Con filtros opcionales por estado y paginación
   */
  @Get()
  async getUserOrders(
    @Request() req: AuthRequest,
    @Query() query: QueryOrdersDto,
  ) {
    return this.ordersService.getUserOrders(req.user.id, query);
  }

  /**
   * GET /orders/all
   * Obtener TODAS las órdenes (solo ADMIN/SUPER_ADMIN)
   * Con filtros y paginación
   */
  @Get('all')
  async getAllOrders(
    @Request() req: AuthRequest,
    @Query() query: QueryOrdersDto,
  ) {
    return this.ordersService.getAllOrders(query, req.user.role);
  }

  /**
   * GET /orders/:id
   * Obtener una orden específica
   * - Usuario solo puede ver sus propias órdenes
   * - Admin puede ver cualquier orden
   */
  @Get(':id')
  async getOrderById(
    @Request() req: AuthRequest,
    @Param('id') orderId: string,
  ) {
    return this.ordersService.getOrderById(orderId, req.user.id, req.user.role);
  }

  /**
   * PATCH /orders/:id/status
   * Actualizar estado de una orden (solo ADMIN/SUPER_ADMIN)
   * - Actualiza timestamps según el nuevo estado
   * - Puede agregar notas de administrador
   */
  @Patch(':id/status')
  async updateOrderStatus(
    @Request() req: AuthRequest,
    @Param('id') orderId: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateOrderStatus(orderId, dto, req.user.role);
  }
}
