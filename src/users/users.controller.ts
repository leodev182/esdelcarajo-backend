import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ==================== PERFIL PROPIO ====================

  @Get('me')
  @ApiOperation({ summary: 'Obtener mi perfil' })
  async getMyProfile(@Request() req: { user: { id: string } }) {
    return this.usersService.getMyProfile(req.user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Actualizar mi perfil' })
  async updateMyProfile(
    @Request() req: { user: { id: string } },
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.usersService.updateMyProfile(req.user.id, updateProfileDto);
  }

  // ==================== GESTIÓN DE USUARIOS (ADMIN) ====================

  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Listar todos los usuarios' })
  async getAllUsers() {
    return this.usersService.getAllUsers();
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Obtener detalle de un usuario' })
  async getUserById(@Param('id') id: string) {
    return this.usersService.getUserById(id);
  }

  @Patch(':id/role')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Cambiar rol de un usuario' })
  async updateUserRole(
    @Param('id') id: string,
    @Body() updateUserRoleDto: UpdateUserRoleDto,
  ) {
    return this.usersService.updateUserRole(id, updateUserRoleDto);
  }

  @Patch(':id/ban')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Banear o desbanear usuario' })
  async toggleUserBan(@Param('id') id: string) {
    return this.usersService.toggleUserBan(id);
  }
}
