import { ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { ThrottlerLimitDetail, ThrottlerRequest } from '@nestjs/throttler';

/**
 * Global rate-limit guard with two improvements over the stock ThrottlerGuard:
 *
 * 1. Sets x-ratelimit-limit / x-ratelimit-remaining / x-ratelimit-reset on
 *    EVERY response, including 429s.  The stock guard sets them only on
 *    successful (non-blocked) responses, leaving them absent on 429.
 * 2. Returns a stable, user-friendly 429 message that matches the rest of the
 *    application error envelope.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    const { context, limit, ttl, throttler, blockDuration, getTracker, generateKey } = requestProps;
    const { req, res } = this.getRequestResponse(context);

    const ignoreUserAgents = throttler.ignoreUserAgents ?? this.commonOptions.ignoreUserAgents;
    if (Array.isArray(ignoreUserAgents)) {
      for (const pattern of ignoreUserAgents) {
        if (pattern.test(String(req.headers?.['user-agent']))) {
          return true;
        }
      }
    }

    const tracker = await getTracker(req, context);
    const throttlerName = throttler.name ?? 'default';
    const key = generateKey(context, tracker, throttlerName);
    const { totalHits, timeToExpire, isBlocked, timeToBlockExpire } =
      await this.storageService.increment(key, ttl, limit, blockDuration, throttlerName);

    const suffix = throttlerName === 'default' ? '' : `-${throttlerName}`;
    const setHeaders = throttler.setHeaders ?? this.commonOptions.setHeaders ?? true;

    // Always set the standard headers — including before a 429 throw — so
    // clients always see their quota status (the stock guard only sets them
    // when the request is *not* blocked).
    if (setHeaders) {
      res.header(`${this.headerPrefix}-Limit${suffix}`, limit);
      res.header(`${this.headerPrefix}-Remaining${suffix}`, Math.max(0, limit - totalHits));
      res.header(`${this.headerPrefix}-Reset${suffix}`, timeToExpire);
    }

    if (isBlocked) {
      if (setHeaders) {
        res.header(`Retry-After${suffix}`, timeToBlockExpire);
      }
      await this.throwThrottlingException(context, {
        limit,
        ttl,
        key,
        tracker,
        totalHits,
        timeToExpire,
        isBlocked,
        timeToBlockExpire,
      });
    }

    return true;
  }

  protected async throwThrottlingException(
    _context: ExecutionContext,
    _detail: ThrottlerLimitDetail,
  ): Promise<void> {
    throw new HttpException(
      'Too many requests. Please try again later.',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
