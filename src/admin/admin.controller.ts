import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { OrderStatus } from '@prisma/client';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ==================== DASHBOARD ====================

  @Get('dashboard/stats')
  @ApiOperation({ summary: 'Obtener estadísticas generales del dashboard' })
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('dashboard/recent-orders')
  @ApiOperation({ summary: 'Obtener órdenes recientes' })
  async getRecentOrders(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    return this.adminService.getRecentOrders(parsedLimit);
  }

  // ==================== GESTIÓN DE ÓRDENES ====================

  @Get('orders')
  @ApiOperation({
    summary: 'Listar todas las órdenes con filtros y paginación',
  })
  async getAllOrders(@Query() queryOrdersDto: QueryOrdersDto) {
    return this.adminService.getAllOrders(queryOrdersDto);
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'Obtener detalle de una orden' })
  async getOrderById(@Param('id') id: string) {
    return this.adminService.getOrderById(id);
  }

  @Patch('orders/:id/approve-payment')
  @ApiOperation({ summary: 'Aprobar pago de una orden' })
  async approvePayment(@Param('id') id: string) {
    return this.adminService.approvePayment(id);
  }

  @Patch('orders/:id/status')
  @ApiOperation({ summary: 'Cambiar estado de una orden' })
  async updateOrderStatus(
    @Param('id') id: string,
    @Body('status') status: OrderStatus,
  ) {
    return this.adminService.updateOrderStatus(id, status);
  }
}
