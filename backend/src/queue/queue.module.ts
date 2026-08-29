import { DynamicModule, Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { EventQueueService } from './event-queue.service';
import { QueueWorkers } from './workers';
import { redisConnectionOptions } from './redis-connection';

const QUEUES = ['exam-events', 'grading', 'risk-scoring', 'notifications'] as const;
const logger = new Logger('QueueModule');

@Global()
@Module({})
export class QueueModule {
  static forRoot(): DynamicModule {
    const hasRedis = !!process.env.REDIS_URL;

    if (!hasRedis) {
      logger.warn('REDIS_URL not set — queue workers disabled');
      return {
        module: QueueModule,
        global: true,
        providers: [
          {
            provide: EventQueueService,
            useValue: {
              addEvent: async () => logger.warn('Queue disabled — event dropped'),
              addBatchEvents: async () => {},
              addGrading: async () => {},
              addBatchGrading: async () => {},
              addRiskScoring: async () => {},
              getEventQueueStats: async () => ({ waiting: 0, active: 0, completed: 0, failed: 0 }),
              onModuleDestroy: async () => {},
            },
          },
        ],
        exports: [EventQueueService],
      };
    }

    return {
      module: QueueModule,
      global: true,
      imports: [
        BullModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            connection: redisConnectionOptions(config),
            defaultJobOptions: {
              removeOnComplete: { age: 3600, count: 1000 },
              removeOnFail: { age: 86400, count: 500 },
              attempts: 3,
              backoff: { type: 'exponential', delay: 1000 },
            },
          }),
        }),
        ...QUEUES.map((name) => BullModule.registerQueue({ name })),
      ],
      providers: [EventQueueService, QueueWorkers],
      exports: [BullModule, EventQueueService],
    };
  }
}
