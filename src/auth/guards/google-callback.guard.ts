import {
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';

@Injectable()
export class GoogleCallbackGuard extends AuthGuard('google') {
  private readonly logger = new Logger(GoogleCallbackGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      return (await super.canActivate(context)) as boolean;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.warn(`Google OAuth callback falló: ${err.message}`);
      this.redirectToError(context);
      // Lanzar HttpException en vez de retornar false:
      // retornar false hace que NestJS lance ForbiddenException e intente enviar 403
      // sobre headers ya enviados (redirect), causando 500.
      // Con HttpException, BaseExceptionFilter detecta headersSent=true y no envía nada.
      throw new HttpException('OAuth redirect', HttpStatus.FOUND);
    }
  }

  handleRequest<TUser = any>(
    err: any,
    user: TUser,
    info: any,
    context: ExecutionContext,
  ): TUser {
    if (err || !user) {
      const msg = err?.message ?? (info instanceof Error ? info.message : String(info ?? 'unknown'));
      this.logger.warn(`Google OAuth handleRequest falló: ${msg}`);
      this.redirectToError(context);
      throw new HttpException('OAuth redirect', HttpStatus.FOUND);
    }
    return user;
  }

  private redirectToError(context: ExecutionContext): void {
    const response = context.switchToHttp().getResponse<Response>();
    if (!response.headersSent) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      response.redirect(`${frontendUrl}/login?error=auth_failed`);
    }
  }
}
