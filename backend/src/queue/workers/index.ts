import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { ExamEventJob, GradingJob, RiskScoringJob } from '../event-queue.service';
import { ConfigService } from '@nestjs/config';
import { RiskLevel } from '@prisma/client';
import { redisConnectionOptions } from '../redis-connection';

@Injectable()
export class QueueWorkers implements OnModuleDestroy {
  private workers: Worker[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const connection = redisConnectionOptions(config);

    const eventWorker = new Worker<ExamEventJob>(
      'exam-events',
      async (job: Job<ExamEventJob>) => {
        const { examId, sessionId, studentId, type, metadata, riskScore } = job.data;
        await this.prisma.examEvent.create({
          data: {
            examId,
            sessionId,
            studentId: studentId ?? '',
            type: type as any,
            riskScore: riskScore ?? 0,
            severity: 'LOW',
            metadata: metadata ? JSON.stringify(metadata) : null,
          },
        });
      },
      { connection, concurrency: 20 },
    );

    const gradingWorker = new Worker<GradingJob>(
      'grading',
      async (job: Job<GradingJob>) => {
        // Grading is handled synchronously by SubmissionsService.finalizeSubmission
      },
      { connection, concurrency: 10 },
    );

    const riskWorker = new Worker<RiskScoringJob>(
      'risk-scoring',
      async (job: Job<RiskScoringJob>) => {
        const { sessionId } = job.data;
        const agg = await this.prisma.examEvent.aggregate({
          where: { sessionId },
          _sum: { riskScore: true },
        });
        const total = Math.min(100, Math.round(agg._sum.riskScore ?? 0));
        let level: RiskLevel = RiskLevel.LOW;
        if (total >= 75) level = RiskLevel.CRITICAL;
        else if (total >= 50) level = RiskLevel.HIGH;
        else if (total >= 25) level = RiskLevel.MEDIUM;

        await this.prisma.examSession.update({
          where: { id: sessionId },
          data: { riskScore: total, riskLevel: level },
        });
      },
      { connection, concurrency: 10 },
    );

    eventWorker.on('failed', (job, err) => {
      console.error(`Event job ${job?.id} failed:`, err.message);
    });
    gradingWorker.on('failed', (job, err) => {
      console.error(`Grading job ${job?.id} failed:`, err.message);
    });
    riskWorker.on('failed', (job, err) => {
      console.error(`Risk job ${job?.id} failed:`, err.message);
    });

    this.workers = [eventWorker, gradingWorker, riskWorker];
  }

  async onModuleDestroy() {
    await Promise.all(this.workers.map((w) => w.close()));
  }
}
