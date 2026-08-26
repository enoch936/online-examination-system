import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventQueueService } from './event-queue.service';
import { QueueWorkers } from './workers';

const QUEUES = ['exam-events', 'grading', 'risk-scoring', 'notifications'] as const;

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD', ''),
          maxRetriesPerRequest: 3,
        },
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
})
export class QueueModule {}
