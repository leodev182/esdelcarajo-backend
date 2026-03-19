import {
  IsOptional,
  IsEnum,
  IsString,
  IsBoolean,
  IsInt,
  IsUUID,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { LogLevel, LogEvent } from '@prisma/client';

export class QueryLogsDto {
  @IsOptional()
  @IsEnum(LogLevel, { message: 'level debe ser INFO, WARN o ERROR' })
  level?: LogLevel;

  @IsOptional()
  @IsEnum(LogEvent, { message: 'event inválido' })
  event?: LogEvent;

  @IsOptional()
  @IsUUID('4', { message: 'userId debe ser un UUID válido' })
  userId?: string;

  @IsOptional()
  @IsString()
  search?: string; // busca en message y errorMessage

  @IsOptional()
  @IsBoolean({ message: 'isPermanent debe ser verdadero o falso' })
  @Transform(({ value }) => value === 'true' || value === true)
  isPermanent?: boolean;

  @IsOptional()
  @IsDateString({}, { message: 'from debe ser una fecha ISO válida' })
  from?: string;

  @IsOptional()
  @IsDateString({}, { message: 'to debe ser una fecha ISO válida' })
  to?: string;

  @IsOptional()
  @IsInt({ message: 'page debe ser un número entero' })
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt({ message: 'limit debe ser un número entero' })
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 50;
}
