import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LogsService } from '../logs.service';

@Injectable()
export class LogsCleanupTask {
  private readonly logger = new Logger(LogsCleanupTask.name);

  constructor(private readonly logsService: LogsService) {}

  /**
   * Limpieza cada hora en batches de 1000.
   * Más estable que un batch enorme a las 2am.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredLogs() {
    this.logger.log('Iniciando limpieza de logs expirados...');

    try {
      const result = await this.logsService.deleteExpiredLogs();

      if (result.count > 0) {
        this.logger.log(`Limpieza completada: ${result.count} logs eliminados`);
      }
    } catch (error) {
      this.logger.error('Error en limpieza de logs:', error);
    }
  }
}
