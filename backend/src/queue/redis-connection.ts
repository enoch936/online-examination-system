import type { ConfigService } from '@nestjs/config';
import type { ConnectionOptions } from 'bullmq';

/**
 * Resolves BullMQ connection options for the queue subsystem.
 *
 * The application historically read REDIS_HOST / REDIS_PORT / REDIS_PASSWORD,
 * while the cache and Socket.IO adapter use REDIS_URL. Cloud providers
 * (Render + Redis Cloud) provide only a connection URL, so without this
 * resolver the queue workers defaulted to `localhost:6379` and every job
 * failed. Passing the URL to BullMQ's connection object directly is not an
 * option either — BullMQ hands the object straight to `new IORedis(options)`,
 * and ioredis only parses URL strings when they are the first constructor
 * argument, not an `{ url }` option key.
 *
 * Supports both `redis://` and `rediss://` (TLS) schemes.
 *
 * NOTE: BullMQ worker connections must set `maxRetriesPerRequest: null` or
 * blocking commands eventually fail with "Connection is in a closed state".
 */
export function redisConnectionOptions(config: Pick<ConfigService, 'get'>): ConnectionOptions {
  const url = config.get<string>('REDIS_URL', '');

  if (url) {
    const parsed = new URL(url);
    const dbPath = parsed.pathname.replace(/^\//, '');
    return {
      host: parsed.hostname,
      port: Number(parsed.port || 6379),
      username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      db: dbPath ? Number(dbPath) : 0,
      tls: parsed.protocol === 'rediss:' ? {} : undefined,
      maxRetriesPerRequest: null,
    };
  }

  return {
    host: config.get<string>('REDIS_HOST', 'localhost'),
    port: config.get<number>('REDIS_PORT', 6379),
    password: config.get<string>('REDIS_PASSWORD', '') || undefined,
    maxRetriesPerRequest: null,
  };
}