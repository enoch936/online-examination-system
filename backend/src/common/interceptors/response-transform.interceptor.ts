import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { normalizeNumbers } from '../utils/normalize-numbers.util';

@Injectable()
export class ResponseTransformInterceptor<T> implements NestInterceptor<T, { success: boolean; data: T }> {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<{ success: boolean; data: T }> {
    // Numbers are normalized on the way out, not by each service: Prisma
    // Decimal serializes to a string, so a field that reaches the client
    // unconverted breaks every caller that does arithmetic on it.
    return next.handle().pipe(map((data) => ({ success: true, data: normalizeNumbers(data) })));
  }
}
