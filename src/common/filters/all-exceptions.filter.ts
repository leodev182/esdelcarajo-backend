import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  Optional,
  ConflictException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { LogLevel, LogEvent } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { LogsService } from '../../logs/logs.service';

/**
 * Filtro global que captura todas las excepciones no manejadas.
 * - Loguea errores 5xx (ERROR) y 4xx (WARN, excepto 401)
 * - Registrado como APP_FILTER en AppModule para tener acceso a DI
 * - LogsService es @Optional para no crashear en bootstrap si el módulo no está listo
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(
    @Optional() private readonly logsService?: LogsService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request & { _startTime?: number; user?: { id: string; email: string; role: string } }>();
    const response = ctx.getResponse<Response>();

    // Convertir errores Prisma conocidos a HttpException apropiadas
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        const fields = (exception.meta?.target as string[])?.join(', ') ?? 'campo';
        const conflict = new ConflictException(
          `Ya existe un registro con el mismo valor en: ${fields}`,
        );
        return this.catch(conflict, host);
      }
    }

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const errorMessage =
      exception instanceof HttpException
        ? this.extractHttpMessage(exception)
        : exception instanceof Prisma.PrismaClientKnownRequestError
          ? `Prisma ${exception.code}: ${exception.message}`
          : exception instanceof Error
            ? exception.message
            : 'Internal server error';

    // 401 es flujo normal de auth — no loguear
    // 5xx → ERROR, 4xx (sin 401) → WARN
    const shouldLog = status >= 500 || (status >= 400 && status !== 401);

    if (shouldLog && this.logsService) {
      const level = status >= 500 ? LogLevel.ERROR : LogLevel.WARN;
      const duration = request._startTime
        ? Date.now() - request._startTime
        : undefined;

      const ip =
        (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        request.ip;

      this.logsService.createLog({
        level,
        event: LogEvent.UNHANDLED_EXCEPTION,
        message: `${request.method} ${request.url} → ${status}`,
        method: request.method,
        url: request.url,
        statusCode: status,
        userId: request.user?.id,
        userEmail: request.user?.email,
        errorMessage,
        context: `${request.method} ${request.url} | duration:${duration ?? '?'}ms | ip:${ip}`,
      });
    }

    if (response.headersSent) return;

    const responseBody =
      exception instanceof HttpException
        ? exception.getResponse()
        : { statusCode: status, message: 'Internal server error' };

    response.status(status).json(responseBody);
  }

  private extractHttpMessage(exception: HttpException): string {
    const response = exception.getResponse();
    if (typeof response === 'string') return response;
    if (typeof response === 'object' && response !== null) {
      const r = response as Record<string, unknown>;
      const msg = r['message'];
      if (Array.isArray(msg)) return msg.join(', ');
      if (typeof msg === 'string') return msg;
    }
    return exception.message;
  }
}
