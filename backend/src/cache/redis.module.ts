import { Module, Global, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { CacheService } from './cache.service';

const REDIS_TOKEN = 'IOREDIS_CLIENT';
const logger = new Logger('RedisConfigModule');

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_TOKEN,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis | null => {
        const url = config.get<string>('REDIS_URL', '');
        if (!url) {
          logger.warn('REDIS_URL not set — Redis disabled (no-op cache)');
          return null;
        }
        logger.log(`Connecting to Redis: ${url}`);
        const client = new Redis(url, {
          maxRetriesPerRequest: 3,
          retryStrategy(times: number) {
            if (times > 5) {
              logger.warn('Redis connection failed after retries — running without cache');
              return null;
            }
            return Math.min(times * 200, 3000);
          },
          enableOfflineQueue: false,
        });
        client.on('error', (err) => {
          // suppress — retryStrategy handles the logic
        });
        return client;
      },
    },
    CacheService,
  ],
  exports: [REDIS_TOKEN, CacheService],
})
export class RedisConfigModule {}
