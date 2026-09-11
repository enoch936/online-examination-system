import { ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Global rate-limit guard with a stable, user-friendly 429 message.
 * Limits are still expressed per-route via @Throttle (ttl in milliseconds
 * for @nestjs/throttler v6).
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async throwThrottlingException(_context: ExecutionContext): Promise<void> {
    throw new HttpException('Too many requests. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
  }
}