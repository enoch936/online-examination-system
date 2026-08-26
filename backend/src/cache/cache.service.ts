import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly defaultTTL = 60;

  constructor(@InjectRedis() private readonly redis: Redis) {}

  async onModuleDestroy() {
    await this.redis.quit().catch(() => {});
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key);
    if (!raw) return null;
    try { return JSON.parse(raw) as T; } catch { return raw as T; }
  }

  async set(key: string, value: unknown, ttlSeconds = this.defaultTTL): Promise<void> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlSeconds > 0) {
      await this.redis.setex(key, ttlSeconds, serialized);
    } else {
      await this.redis.set(key, serialized);
    }
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async delPattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  async incr(key: string, ttlSeconds = 60): Promise<number> {
    const count = await this.redis.incr(key);
    if (count === 1 && ttlSeconds > 0) {
      await this.redis.expire(key, ttlSeconds);
    }
    return count;
  }
}
