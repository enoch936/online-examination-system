import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ExamEventType, ExamStatus, Prisma, SessionStatus, SubmissionStatus } from '@prisma/client';
import { MonitoringService } from '../monitoring/monitoring.service';
import { EventQueueService, GradingJob } from '../queue/event-queue.service';
import { PrismaService } from '../prisma/prisma.service';
import { clampScore, gradeQuestion } from './scoring.util';
import { SubmitExamDto } from './dto/submit-exam.dto';

const LIFECYCLE_INTERVAL_MS = 60_000;
const BATCH_SIZE = 200;

type SubmissionSession = Prisma.ExamSessionGetPayload<{ include: ReturnType<SubmissionsService['submissionInclude']> }>;

@Injectable()
export class SubmissionsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly monitoring: MonitoringService,
    private readonly eventQueue: EventQueueService,
  ) {}

  onModuleInit() {
    void this.runLifecycle();
    const timer = setInterval(() => void this.runLifecycle(), LIFECYCLE_INTERVAL_MS);
    timer.unref?.();
  }

  async runLifecycle() {
    const now = new Date();
    const [autoSubmitted, closed] = await Promise.all([
      this.autoSubmitExpired(now),
      this.prisma.exam.updateMany({
        where: { status: { in: [ExamStatus.LIVE, ExamStatus.PUBLISHED] }, endsAt: { lt: now } },
        data: { status: ExamStatus.CLOSED },
      }),
    ]);
    return { autoSubmitted, closed: closed.count };
  }

  async submit(dto: SubmitExamDto, studentId: string) {
    const session = await this.prisma.examSession.findFirst({
      where: { id: dto.sessionId, studentId },
      include: this.submissionInclude(),
    });
    if (!session) {
      throw new NotFoundException('Exam session not found');
    }
    if (session.submission) {
      return session.submission;
    }
    if (!([SessionStatus.IN_PROGRESS, SessionStatus.PAUSED] as SessionStatus[]).includes(session.status)) {
      throw new ForbiddenException('Session cannot be submitted');
    }
    // A manual submit after expiresAt is still legitimate (student finished
    // exactly on time), but must be recorded as an automatic submission so it
    // is never mistaken for an on-time manual attempt.
    const pastDue = session.expiresAt ? Date.now() > session.expiresAt.getTime() : true;
    return this.finalizeSubmission(session, dto.autoSubmitted ?? pastDue);
  }

  async autoSubmitExpired(now = new Date()) {
    const expiredSessionIds = await this.prisma.examSession.findMany({
      where: {
        status: { in: [SessionStatus.IN_PROGRESS, SessionStatus.PAUSED] },
        expiresAt: { lt: now },
      },
      select: { id: true },
    });

    let autoSubmitted = 0;
    for (let i = 0; i < expiredSessionIds.length; i += BATCH_SIZE) {
      const batch = expiredSessionIds.slice(i, i + BATCH_SIZE);
      const sessions = await this.prisma.examSession.findMany({
        where: { id: { in: batch.map((s) => s.id) } },
        include: this.submissionInclude(),
      });
      for (const session of sessions) {
        try {
          await this.finalizeSubmission(session, true);
          autoSubmitted++;
        } catch {
          /* a single session must not block the rest */
        }
      }
    }
    return { autoSubmitted };
  }

  async forceEndExam(examId: string, instructorId: string) {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) throw new NotFoundException('Exam not found');
    if (exam.status === ExamStatus.CLOSED) {
      throw new BadRequestException('Exam is already closed');
    }

    const sessions = await this.prisma.examSession.findMany({
      where: { examId, status: { in: [SessionStatus.IN_PROGRESS, SessionStatus.PAUSED] } },
      include: this.submissionInclude(),
    });

    let forceSubmitted = 0;
    for (const session of sessions) {
      try {
        if (!session.submission) {
          await this.finalizeSubmission(session, true);
        } else {
          await this.prisma.examSession.update({
            where: { id: session.id },
            data: { status: SessionStatus.SUBMITTED, submittedAt: new Date() },
          });
        }
        forceSubmitted++;
        await this.monitoring.emitSessionControl(session.id, { type: 'force-submit' });
      } catch {
        /* a single session must not block the rest */
      }
    }

    const updated = await this.prisma.exam.update({
      where: { id: examId },
      data: { status: ExamStatus.CLOSED, endsAt: new Date() },
    });

    await this.prisma.activityLog.create({
      data: {
        actorId: instructorId,
        action: 'exams.force_end',
        metadata: JSON.stringify({ examId, forceSubmitted, totalSessions: sessions.length }),
      },
    });

    return { exam: updated, forceSubmitted, totalSessions: sessions.length };
  }

  private submissionInclude() {
    return {
      exam: {
        include: {
          questions: {
            include: { question: { include: { options: true } } },
          },
        },
      },
      answers: true,
      submission: true,
    } as const;
  }

  private async finalizeSubmission(session: SubmissionSession, autoSubmitted: boolean) {
    const negativeMarkingRate = Number(session.exam.negativeMarkingRate) || 0;
    let totalScore = 0;
    let needsManualGrading = false;
    const answerByQuestion = new Map(session.answers.map((answer) => [answer.questionId, answer]));

    const updates: Array<{ id: string; score: number }> = [];

    for (const examQuestion of session.exam.questions) {
      const question = examQuestion.question;
      const answer = answerByQuestion.get(question.id);

      const graded = gradeQuestion({
        type: question.type,
        points: Number(examQuestion.points),
        options: question.options,
        answer: answer ?? null,
        negativeMarkingRate,
      });

      totalScore += graded.score;
      if (graded.needsManualGrading) needsManualGrading = true;

      if (answer) {
        updates.push({ id: answer.id, score: graded.score });
      }
    }

    if (updates.length > 0) {
      await this.prisma.$transaction(
        updates.map((u) => this.prisma.studentAnswer.update({ where: { id: u.id }, data: { score: u.score } })),
      );
    }

    const maxScore = Number(session.exam.totalMarks);
    const finalScore = clampScore(totalScore, maxScore);
    const percentage = maxScore > 0 ? Number(((finalScore / maxScore) * 100).toFixed(2)) : 0;
    const isPassed = finalScore >= Number(session.exam.passingMarks);
    const status = needsManualGrading ? SubmissionStatus.NEEDS_MANUAL_GRADING : SubmissionStatus.GRADED;

    const submission = await this.safeCreateSubmission(session, {
      status,
      autoSubmitted,
      totalScore: finalScore,
      maxScore,
      percentage,
      isPassed,
      gradingCompletedAt: needsManualGrading ? null : new Date(),
      showResultImmediately: session.exam.showResultImmediately && !needsManualGrading,
    });

    void this.prisma.auditLog
      .create({
        data: {
          actorId: session.studentId,
          action: 'EXAM_SUBMITTED',
          entity: 'SUBMISSION',
          entityId: submission.id,
          after: JSON.stringify({
            examId: session.examId,
            sessionId: session.id,
            autoSubmitted,
            score: finalScore,
            status,
          }),
        },
      })
      .catch(() => undefined);

    await this.prisma.examSession.update({
      where: { id: session.id },
      data: {
        status: autoSubmitted ? SessionStatus.AUTO_SUBMITTED : SessionStatus.SUBMITTED,
        submittedAt: new Date(),
        connectionState: 'CONNECTED',
        lastActivityAt: new Date(),
      },
    });

    try {
      await this.monitoring.recordEvent({
        examId: session.examId,
        sessionId: session.id,
        type: ExamEventType.EXAM_SUBMITTED,
        metadata: { autoSubmitted, submissionId: submission.id },
      });
    } catch {
      /* best effort */
    }

    return submission;
  }

  /**
   * Creates the submission whose `sessionId` is UNIQUE in the schema. Two
   * concurrent submit calls (or a manual submit racing the 60s auto-submit
   * lifecycle) can both pass the "no submission yet" check and then collide;
   * the loser gets a P2002 unique-constraint error and must return the winner's
   * already-stored submission instead of failing the request.
   */
  private async safeCreateSubmission(
    session: SubmissionSession,
    data: {
      status: SubmissionStatus;
      autoSubmitted: boolean;
      totalScore: number;
      maxScore: number;
      percentage: number;
      isPassed: boolean;
      gradingCompletedAt: Date | null;
      showResultImmediately: boolean;
    },
  ) {
    try {
      return await this.prisma.submission.create({
        data: {
          sessionId: session.id,
          status: data.status,
          autoSubmitted: data.autoSubmitted,
          totalScore: data.totalScore,
          maxScore: data.maxScore,
          percentage: data.percentage,
          isPassed: data.isPassed,
          gradingCompletedAt: data.gradingCompletedAt,
          result: {
            create: {
              examId: session.examId,
              studentId: session.studentId,
              score: data.totalScore,
              maxScore: data.maxScore,
              percentage: data.percentage,
              passed: data.isPassed,
              publishedAt: data.showResultImmediately ? new Date() : null,
            },
          },
        },
        include: { result: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.prisma.submission.findUnique({
          where: { sessionId: session.id },
          include: { result: true },
        });
        if (existing) return existing;
      }
      throw error;
    }
  }
}
