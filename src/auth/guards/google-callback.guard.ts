import {
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import * as Sentry from '@sentry/nestjs';

@Injectable()
export class GoogleCallbackGuard extends AuthGuard('google') {
  private readonly logger = new Logger(GoogleCallbackGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      return (await super.canActivate(context)) as boolean;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.warn(`Google OAuth callback falló: ${err.message}`);
      Sentry.captureException(err, { tags: { flow: 'google-oauth-callback' } });
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
      const oauthError =
        err instanceof Error
          ? err
          : info instanceof Error
            ? info
            : new Error(String(err ?? info ?? 'Google OAuth: no user returned'));
      this.logger.warn(`Google OAuth handleRequest falló: ${oauthError.message}`);
      Sentry.captureException(oauthError, { tags: { flow: 'google-oauth-handle-request' } });
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
