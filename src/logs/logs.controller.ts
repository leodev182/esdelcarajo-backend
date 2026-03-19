import {
  Controller,
  Get,
  Delete,
  Patch,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { LogsService } from './logs.service';
import { QueryLogsDto } from './dto/query-logs.dto';
import { BulkIdsDto } from './dto/bulk-ids.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Logs')
@ApiBearerAuth()
@Controller('logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  /**
   * Vista detallada con filtros y paginación
   * GET /api/logs?level=ERROR&page=1&limit=50
   */
  @Get()
  @ApiOperation({ summary: 'Listar logs con filtros y paginación' })
  getLogs(@Query() query: QueryLogsDto) {
    return this.logsService.getLogs(query);
  }

  /**
   * Vista agrupada: agrupa por event + level + url con conteo
   * GET /api/logs/grouped
   */
  @Get('grouped')
  @ApiOperation({ summary: 'Logs agrupados por event/level/url con conteo' })
  getGroupedLogs() {
    return this.logsService.getGroupedLogs();
  }

  /**
   * Detalle de un log
   * GET /api/logs/:id
   */
  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de un log' })
  getLogById(@Param('id') id: string) {
    return this.logsService.getLogById(id);
  }

  /**
   * Eliminar un log
   * DELETE /api/logs/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un log' })
  deleteLog(@Param('id') id: string) {
    return this.logsService.deleteLog(id);
  }

  /**
   * Eliminar logs en bulk
   * DELETE /api/logs  body: { ids: string[] }
   */
  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar logs en bulk' })
  deleteLogs(@Body() dto: BulkIdsDto) {
    return this.logsService.deleteLogs(dto);
  }

  /**
   * Marcar un log como permanente (nunca expira)
   * PATCH /api/logs/:id/permanent
   */
  @Patch(':id/permanent')
  @ApiOperation({ summary: 'Marcar log como permanente' })
  markAsPermanent(@Param('id') id: string) {
    return this.logsService.markAsPermanent(id);
  }

  /**
   * Marcar logs en bulk como permanentes
   * PATCH /api/logs/permanent  body: { ids: string[] }
   */
  @Patch('permanent')
  @ApiOperation({ summary: 'Marcar logs en bulk como permanentes' })
  markLogsAsPermanent(@Body() dto: BulkIdsDto) {
    return this.logsService.markLogsAsPermanent(dto);
  }
}
