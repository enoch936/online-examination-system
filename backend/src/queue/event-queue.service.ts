import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';

export interface ExamEventJob {
  examId: string;
  sessionId: string;
  studentId?: string;
  type: string;
  metadata?: Record<string, unknown>;
  riskScore?: number;
  asStudent?: boolean;
  timestamp?: string;
}

export interface GradingJob {
  sessionId: string;
  examId: string;
}

export interface RiskScoringJob {
  sessionId: string;
  eventId?: string;
  incremental?: boolean;
}

@Injectable()
export class EventQueueService implements OnModuleDestroy {
  constructor(
    @InjectQueue('exam-events') private eventQueue: Queue<ExamEventJob>,
    @InjectQueue('grading') private gradingQueue: Queue<GradingJob>,
    @InjectQueue('risk-scoring') private riskQueue: Queue<RiskScoringJob>,
    @InjectQueue('notifications') private notificationQueue: Queue<unknown>,
  ) {}

  async onModuleDestroy() {
    await Promise.all([
      this.eventQueue.close().catch(() => {}),
      this.gradingQueue.close().catch(() => {}),
      this.riskQueue.close().catch(() => {}),
      this.notificationQueue.close().catch(() => {}),
    ]);
  }

  async addEvent(job: ExamEventJob) {
    return this.eventQueue.add('record', job, {
      priority: job.asStudent ? 5 : 1,
      delay: 0,
    });
  }

  async addBatchEvents(jobs: ExamEventJob[]) {
    if (jobs.length === 0) return;
    const chunks: ExamEventJob[][] = [];
    for (let i = 0; i < jobs.length; i += 50) {
      chunks.push(jobs.slice(i, i + 50));
    }
    for (const chunk of chunks) {
      await this.eventQueue.addBulk(
        chunk.map((job) => ({
          name: 'record',
          data: job,
          opts: { priority: job.asStudent ? 5 : 1 },
        })),
      );
    }
  }

  async addGrading(job: GradingJob) {
    return this.gradingQueue.add('finalize', job);
  }

  async addBatchGrading(jobs: GradingJob[]) {
    if (jobs.length === 0) return;
    await this.gradingQueue.addBulk(
      jobs.map((job) => ({ name: 'finalize', data: job })),
    );
  }

  async addRiskScoring(job: RiskScoringJob) {
    return this.riskQueue.add('compute', job, {
      priority: job.incremental ? 3 : 1,
    });
  }

  async getEventQueueStats() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.eventQueue.getWaitingCount(),
      this.eventQueue.getActiveCount(),
      this.eventQueue.getCompletedCount(),
      this.eventQueue.getFailedCount(),
    ]);
    return { waiting, active, completed, failed };
  }
}
