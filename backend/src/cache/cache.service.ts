import { Injectable, OnModuleDestroy, Logger, Optional, Inject } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly defaultTTL = 60;
  private readonly redis: Redis | null;

  constructor(@Optional() @Inject('IOREDIS_CLIENT') redis: Redis | null) {
    this.redis = redis;
    if (!this.redis) {
      this.logger.warn('CacheService running in no-op mode (no Redis)');
    }
  }

  async onModuleDestroy() {
    await this.redis?.quit().catch(() => {});
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    if (!this.redis) return null;
    try {
      const raw = await this.redis.get(key);
      if (!raw) return null;
      try { return JSON.parse(raw) as T; } catch { return raw as T; }
    } catch { return null; }
  }

  async set(key: string, value: unknown, ttlSeconds = this.defaultTTL): Promise<void> {
    if (!this.redis) return;
    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      if (ttlSeconds > 0) {
        await this.redis.setex(key, ttlSeconds, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
    } catch {}
  }

  async del(key: string): Promise<void> {
    if (!this.redis) return;
    try { await this.redis.del(key); } catch {}
  }

  async delPattern(pattern: string): Promise<void> {
    if (!this.redis) return;
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch {}
  }

  async incr(key: string, ttlSeconds = 60): Promise<number> {
    if (!this.redis) return 0;
    try {
      const count = await this.redis.incr(key);
      if (count === 1 && ttlSeconds > 0) {
        await this.redis.expire(key, ttlSeconds);
      }
      return count;
    } catch { return 0; }
  }
}
