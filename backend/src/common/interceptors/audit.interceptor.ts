import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditLogs: AuditLogsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Each WebSocket message also passes through this globally-registered
    // interceptor, but there is no HTTP request to audit there and
    // switchToHttp().getRequest() is undefined — reading .method crashed
    // every realtime handler. Socket messages are audited by the gateway's
    // own monitoring/audit logic instead.
    if (context.getType<string>() !== 'http') {
      return next.handle();
    }
    const request = context.switchToHttp().getRequest<{
      method: string;
      originalUrl: string;
      user?: { sub: string };
      ip?: string;
      headers: Record<string, string>;
    }>();

    const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (!mutatingMethods.includes(request.method)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        const entity = request.originalUrl.split('/').pop() ?? request.originalUrl;
        void this.auditLogs.create({
          action: `${request.method} ${request.originalUrl}`,
          entity,
          entityId: undefined,
          actor: request.user?.sub ? { connect: { id: request.user.sub } } : undefined,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        });
      }),
    );
  }
}
