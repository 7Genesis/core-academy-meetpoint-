import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { catchError, tap, throwError } from 'rxjs';
import { DataMaskingService } from './data-masking.service';

@Injectable()
export class SecurityAuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('SecurityAudit');

  constructor(private readonly dataMasking: DataMaskingService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startedAt = Date.now();
    const routePath =
      request.route?.path && typeof request.route.path === 'string'
        ? request.route.path
        : 'unmatched';
    const method = request.method;
    const requestId = request.header('X-Request-ID') ?? response.getHeader('X-Request-ID');

    return next.handle().pipe(
      tap(() => {
        this.logger.log(
          JSON.stringify({
            requestId,
            method,
            route: routePath,
            statusCode: response.statusCode,
            durationMs: Date.now() - startedAt,
          }),
        );
      }),
      catchError((error: unknown) => {
        const message =
          error instanceof Error
            ? this.dataMasking.redactText(error.message)
            : 'unknown-error';

        this.logger.warn(
          JSON.stringify({
            requestId,
            method,
            route: routePath,
            statusCode: response.statusCode >= 400 ? response.statusCode : 500,
            durationMs: Date.now() - startedAt,
            error: message,
          }),
        );

        return throwError(() => error);
      }),
    );
  }
}
