import { Module } from '@nestjs/common';
import { LogsService } from './logs.service';
import { LogsController } from './logs.controller';
import { LogsCleanupTask } from './tasks/logs-cleanup.task';
import { LogsListener } from './listeners/logs.listener';

@Module({
  controllers: [LogsController],
  providers: [LogsService, LogsCleanupTask, LogsListener],
  exports: [LogsService],
})
export class LogsModule {}
