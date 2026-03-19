import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { LogLevel, LogEvent, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryLogsDto } from './dto/query-logs.dto';
import { BulkIdsDto } from './dto/bulk-ids.dto';

export interface CreateLogData {
  level: LogLevel;
  event: LogEvent;
  message: string;
  method?: string;
  url?: string;
  statusCode?: number;
  userId?: string;
  userEmail?: string;
  errorMessage?: string;
  context?: string;
}

@Injectable()
export class LogsService {
  private readonly logger = new Logger(LogsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────
  // Escritura
  // ─────────────────────────────────────────────

  /**
   * Crea un log persistido en DB.
   * Fire-and-forget: no bloquea la request ni el evento de negocio.
   * Si falla la escritura en DB, hace fallback a Pino (stdout → Render lo captura).
   */
  createLog(data: CreateLogData): void {
    const logData = {
      ...data,
      expiresAt: this.computeExpiresAt(data.level),
    };

    void this.prisma.log
      .create({ data: logData })
      .catch((err: Error) => {
        this.logger.error('Log DB write failed — fallback a consola', {
          event: data.event,
          message: data.message,
          error: err.message,
        });
      });
  }

  /**
   * Conveniencia para eventos de negocio (level INFO por defecto).
   * Llamar con optional chaining: this.logsService?.logEvent(...)
   */
  logEvent(
    event: LogEvent,
    message: string,
    options?: Partial<Omit<CreateLogData, 'level' | 'event' | 'message'>>,
  ): void {
    this.createLog({
      level: LogLevel.INFO,
      event,
      message,
      ...options,
    });
  }

  // ─────────────────────────────────────────────
  // Lectura
  // ─────────────────────────────────────────────

  async getLogs(query: QueryLogsDto) {
    const {
      level,
      event,
      userId,
      search,
      isPermanent,
      from,
      to,
      page = 1,
      limit = 50,
    } = query;

    const where: Prisma.LogWhereInput = {};

    if (level) where.level = level;
    if (event) where.event = event;
    if (userId) where.userId = userId;
    if (typeof isPermanent === 'boolean') where.isPermanent = isPermanent;

    if (from || to) {
      where.createdAt = {
        ...(from && { gte: new Date(from) }),
        ...(to && { lte: new Date(to) }),
      };
    }

    if (search) {
      where.OR = [
        { message: { contains: search, mode: 'insensitive' } },
        { errorMessage: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.log.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.log.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getLogById(id: string) {
    const log = await this.prisma.log.findUnique({ where: { id } });

    if (!log) {
      throw new NotFoundException(`Log con ID "${id}" no encontrado`);
    }

    return log;
  }

  /**
   * Vista agrupada: agrupa por event + level + url para evitar
   * mostrar 120 filas del mismo error.
   */
  async getGroupedLogs() {
    const groups = await this.prisma.log.groupBy({
      by: ['level', 'event', 'url'],
      _count: { id: true },
      _max: { createdAt: true },
      _min: { createdAt: true },
      orderBy: { _count: { id: 'desc' } },
      where: { isPermanent: false },
    });

    return groups.map((g) => ({
      level: g.level,
      event: g.event,
      url: g.url,
      count: g._count.id,
      lastOccurrence: g._max.createdAt,
      firstOccurrence: g._min.createdAt,
    }));
  }

  // ─────────────────────────────────────────────
  // Eliminación
  // ─────────────────────────────────────────────

  async deleteLog(id: string): Promise<void> {
    await this.getLogById(id); // lanza NotFoundException si no existe
    await this.prisma.log.delete({ where: { id } });
  }

  async deleteLogs(dto: BulkIdsDto): Promise<{ count: number }> {
    const result = await this.prisma.log.deleteMany({
      where: { id: { in: dto.ids } },
    });
    return { count: result.count };
  }

  // ─────────────────────────────────────────────
  // Permanentes
  // ─────────────────────────────────────────────

  async markAsPermanent(id: string) {
    await this.getLogById(id);
    return this.prisma.log.update({
      where: { id },
      data: { isPermanent: true, expiresAt: null },
    });
  }

  async markLogsAsPermanent(dto: BulkIdsDto): Promise<{ count: number }> {
    const result = await this.prisma.log.updateMany({
      where: { id: { in: dto.ids } },
      data: { isPermanent: true, expiresAt: null },
    });
    return { count: result.count };
  }

  // ─────────────────────────────────────────────
  // Limpieza (llamado por el CRON)
  // ─────────────────────────────────────────────

  /**
   * Elimina logs expirados en batches de 1000.
   * Dos pasos para respetar la limitación de Prisma (deleteMany no tiene "take").
   */
  async deleteExpiredLogs(): Promise<{ count: number }> {
    const toDelete = await this.prisma.log.findMany({
      where: {
        isPermanent: false,
        expiresAt: { lt: new Date() },
      },
      select: { id: true },
      take: 1000,
    });

    if (toDelete.length === 0) return { count: 0 };

    const result = await this.prisma.log.deleteMany({
      where: { id: { in: toDelete.map((l) => l.id) } },
    });

    return { count: result.count };
  }

  // ─────────────────────────────────────────────
  // Helpers privados
  // ─────────────────────────────────────────────

  private computeExpiresAt(level: LogLevel): Date {
    const now = Date.now();
    // INFO → 24 horas, WARN/ERROR → 7 días
    const ms =
      level === LogLevel.INFO
        ? 24 * 60 * 60 * 1000
        : 7 * 24 * 60 * 60 * 1000;
    return new Date(now + ms);
  }
}
