import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FavoritesService } from './favorites.service';
import { AddFavoriteDto } from './dto/add-favorite.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthRequest } from '../common/interfaces/auth-request.interface';

@ApiTags('Favoritos')
@ApiBearerAuth()
@Controller('favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Post()
  @ApiOperation({ summary: 'Agregar producto a favoritos' })
  async addFavorite(
    @Request() req: AuthRequest,
    @Body() addFavoriteDto: AddFavoriteDto,
  ) {
    const userId: string = req.user.id;
    return this.favoritesService.addFavorite(userId, addFavoriteDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los favoritos del usuario' })
  async getFavorites(@Request() req: AuthRequest) {
    const userId: string = req.user.id;
    return this.favoritesService.getFavorites(userId);
  }

  @Get('check/:productId')
  @ApiOperation({ summary: 'Verificar si un producto está en favoritos' })
  async isFavorite(
    @Request() req: AuthRequest,
    @Param('productId') productId: string,
  ) {
    const userId: string = req.user.id;
    const isFavorite = await this.favoritesService.isFavorite(
      userId,
      productId,
    );
    return {
      productId,
      isFavorite,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un producto de favoritos' })
  async removeFavorite(@Request() req: AuthRequest, @Param('id') id: string) {
    const userId: string = req.user.id;
    return this.favoritesService.removeFavorite(userId, id);
  }

  @Delete()
  @ApiOperation({ summary: 'Eliminar todos los favoritos' })
  async clearFavorites(@Request() req: AuthRequest) {
    const userId: string = req.user.id;
    return this.favoritesService.clearFavorites(userId);
  }
}
