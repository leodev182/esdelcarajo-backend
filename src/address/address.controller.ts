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
import { AddressService } from './address.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthRequest } from '../common/interfaces/auth-request.interface';

/**
 * Controlador para gestionar direcciones de entrega
 * Todos los endpoints requieren autenticación
 */
@Controller('address')
@UseGuards(JwtAuthGuard)
export class AddressController {
  constructor(private readonly addressService: AddressService) {}

  /**
   * POST /address
   * Crear una nueva dirección de entrega
   * Si se marca como predeterminada, desmarca las demás automáticamente
   */
  @Post()
  async create(@Request() req: AuthRequest, @Body() dto: CreateAddressDto) {
    return this.addressService.create(req.user.id, dto);
  }

  /**
   * GET /address
   * Obtener todas las direcciones del usuario autenticado
   * Ordenadas por: predeterminada primero, luego más recientes
   */
  @Get()
  async findAll(@Request() req: AuthRequest) {
    return this.addressService.findAllByUser(req.user.id);
  }

  /**
   * GET /address/:id
   * Obtener una dirección específica
   * Solo si pertenece al usuario autenticado
   */
  @Get(':id')
  async findOne(@Request() req: AuthRequest, @Param('id') addressId: string) {
    return this.addressService.findOne(addressId, req.user.id);
  }

  /**
   * PATCH /address/:id
   * Actualizar una dirección existente
   * Si se marca como predeterminada, desmarca las demás automáticamente
   */
  @Patch(':id')
  async update(
    @Request() req: AuthRequest,
    @Param('id') addressId: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.addressService.update(addressId, req.user.id, dto);
  }

  /**
   * PATCH /address/:id/set-default
   * Marcar una dirección como predeterminada
   * Desmarca automáticamente las demás
   */
  @Patch(':id/set-default')
  async setAsDefault(
    @Request() req: AuthRequest,
    @Param('id') addressId: string,
  ) {
    return this.addressService.setAsDefault(addressId, req.user.id);
  }

  /**
   * DELETE /address/:id
   * Eliminar una dirección (soft delete)
   */
  @Delete(':id')
  async remove(@Request() req: AuthRequest, @Param('id') addressId: string) {
    return this.addressService.remove(addressId, req.user.id);
  }
}
