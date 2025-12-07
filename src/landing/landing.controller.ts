import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LandingService } from './landing.service';
import { CreateLandingSectionDto } from './dto/create-landing-section.dto';
import { UpdateLandingSectionDto } from './dto/update-landing-section.dto';
import { AddSectionImageDto } from './dto/add-section-image.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Landing')
@Controller('landing')
export class LandingController {
  constructor(private readonly landingService: LandingService) {}

  @Get('sections')
  @ApiOperation({ summary: 'Obtener todas las secciones activas (público)' })
  findAll() {
    return this.landingService.findAll();
  }

  @Get('sections/:id')
  @ApiOperation({ summary: 'Obtener una sección por ID (público)' })
  findOne(@Param('id') id: string) {
    return this.landingService.findOne(id);
  }

  @Post('sections')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear nueva sección (SUPER_ADMIN)' })
  create(@Body() createDto: CreateLandingSectionDto) {
    return this.landingService.create(createDto);
  }

  @Patch('sections/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar sección (SUPER_ADMIN)' })
  update(@Param('id') id: string, @Body() updateDto: UpdateLandingSectionDto) {
    return this.landingService.update(id, updateDto);
  }

  @Delete('sections/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Desactivar sección (SUPER_ADMIN)' })
  remove(@Param('id') id: string) {
    return this.landingService.remove(id);
  }

  @Post('sections/images')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Agregar imagen a sección (SUPER_ADMIN)' })
  addImage(@Body() addImageDto: AddSectionImageDto) {
    return this.landingService.addImage(addImageDto);
  }

  @Delete('sections/images/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Eliminar imagen de sección (SUPER_ADMIN)' })
  removeImage(@Param('id') id: string) {
    return this.landingService.removeImage(id);
  }
}
