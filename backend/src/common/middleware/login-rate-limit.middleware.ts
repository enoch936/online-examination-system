import { Injectable, NestMiddleware } from '@nestjs/common';
import { rateLimit } from 'express-rate-limit';
import type { NextFunction, Request, Response } from 'express';

/**
 * Express-rate-limit middleware applied to the login endpoint.
 *
 * - 5 attempts / 15 minutes / IP
 * - standardHeaders (RateLimit-*) + legacyHeaders (X-RateLimit-*) on every
 *   response including 429 (fixes the throttler gap where 429 responses had
 *   empty headers).
 * - keyGenerator uses req.ip (trust proxy=1 configured in main.ts).
 * - Response body matches GlobalExceptionFilter shape for consistency.
 */
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: true,
  keyGenerator: (req: Request): string => req.ip ?? req.socket?.remoteAddress ?? 'unknown',
  message: (_req: Request, _res: Response) => ({
    success: false,
    statusCode: 429,
    timestamp: new Date().toISOString(),
    error: { message: 'Too many requests. Please try again later.' },
  }),
  validate: {
    default: true,
    ip: true,
    trustProxy: true,
    xForwardedForHeader: true,
    keyGeneratorIpFallback: true,
  },
  passOnStoreError: true,
});

@Injectable()
export class LoginRateLimitMiddleware implements NestMiddleware {
  use = (req: Request, res: Response, next: NextFunction) =>
    loginRateLimiter(req, res, next);
}
