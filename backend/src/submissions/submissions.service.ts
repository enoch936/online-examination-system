import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ExamEventType, ExamStatus, GradingStatus, Prisma, SessionStatus, Submission, SubmissionReason, SubmissionStatus } from '@prisma/client';
import { MonitoringService } from '../monitoring/monitoring.service';
import { EventQueueService, GradingJob } from '../queue/event-queue.service';
import { PrismaService } from '../prisma/prisma.service';
import { computeResultMetrics, scoreAttempt, AttemptScoringConfig } from '../results/result-calculation.util';
import { classifySubmission, isUniqueConstraintCollision } from './finalize-policy.util';
import { SubmitExamDto } from './dto/submit-exam.dto';

const LIFECYCLE_INTERVAL_MS = 60_000;
const BATCH_SIZE = 200;

type SubmissionSession = Prisma.ExamSessionGetPayload<{ include: ReturnType<SubmissionsService['submissionInclude']> }>;
type FinalizedSubmission = Submission & { result: { id: string } | null };

@Injectable()
export class SubmissionsService implements OnModuleInit {
  private lifecycleRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly monitoring: MonitoringService,
    private readonly eventQueue: EventQueueService,
  ) {}

  onModuleInit() {
    this.scheduleLifecycle();
    const timer = setInterval(() => this.scheduleLifecycle(), LIFECYCLE_INTERVAL_MS);
    timer.unref?.();
  }

  /**
   * The sweep must never be able to take the process down, and two sweeps must
   * never run at once: an unhandled rejection from the `void`-ed promise would
   * otherwise crash the worker on the first database hiccup, and overlapping
   * runs would fight over the same expired sessions.
   */
  private scheduleLifecycle() {
    if (this.lifecycleRunning) return;
    this.lifecycleRunning = true;
    void this.runLifecycle()
      .catch(() => undefined)
      .finally(() => {
        this.lifecycleRunning = false;
      });
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

  /**
   * Staff-driven submission (force-submit, end session, end exam).
   *
   * Exposed so that every other module that needs to close a session goes
   * through the exact same atomic freeze as a student submit. Callers used to
   * just flip `status = SUBMITTED`, which produced no Submission and no Result
   * and therefore destroyed the attempt.
   */
  async forceSubmitSession(
    sessionId: string,
    reason: SubmissionReason = SubmissionReason.AUTO_FORCE_SUBMIT,
  ): Promise<FinalizedSubmission> {
    const session = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      include: this.submissionInclude(),
    });
    if (!session) {
      throw new NotFoundException('Exam session not found');
    }
    return this.finalizeSubmission(session, { reason, force: true });
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
    //
    // `dto.autoSubmitted` is deliberately ignored: expiry is a server-side
    // fact derived from `expiresAt`, so a client can neither fabricate an
    // on-time submission nor hide an auto-submitted one.
    return this.finalizeSubmission(session);
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
          await this.finalizeSubmission(session, { reason: SubmissionReason.AUTO_TIME_EXPIRY });
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
        // Always route through finalizeSubmission, even when a submission row
        // already exists: the earlier `else` branch flipped the session to
        // SUBMITTED without ever producing a Result, which silently lost the
        // attempt entirely.
        await this.finalizeSubmission(session, { reason: SubmissionReason.AUTO_EXAM_ENDED, force: true });
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

  /**
   * Freezes a session into exactly one Submission + Result + closed session.
   *
   * Everything that must be atomic lives in one interactive transaction:
   *   1. insert the Submission (its `sessionId` is UNIQUE, so this is the race)
   *   2. persist the per-answer scores
   *   3. close the session
   *
   * The previous implementation wrote answer scores in a *separate* transaction
   * that ran *before* the submission insert, so two concurrent submits both
   * graded and both wrote scores while the loser then hit P2002 — leaving the
   * loser's scores on the winner's submission. Inserting the unique row first
   * means only the winner ever writes.
   */
  private async finalizeSubmission(
    session: SubmissionSession,
    options: { reason?: SubmissionReason; force?: boolean } = {},
  ): Promise<FinalizedSubmission> {
    const scoringConfig: AttemptScoringConfig = {
      totalMarks: Number(session.exam.totalMarks),
      passingMarks: Number(session.exam.passingMarks),
      negativeMarkingRate: Number(session.exam.negativeMarkingRate) || 0,
    };

    // Server-authoritative classification. A student-initiated submit that lands
    // after `expiresAt` is still a legitimate attempt, but it must never be
    // recorded as on-time, so it is filed as an automatic submission.
    // `dto.autoSubmitted` is deliberately not consulted: expiry is a server-side
    // fact, so a client can neither fabricate an on-time submission nor hide an
    // automatic one.
    const { reason, autoSubmitted, sessionStatus } = classifySubmission({
      expiresAt: session.expiresAt,
      now: new Date(),
      requestedReason: options.reason,
    });

    const breakdown = scoreAttempt(
      session.exam.questions.map((examQuestion) => ({
        questionId: examQuestion.questionId,
        type: examQuestion.question.type,
        points: Number(examQuestion.points),
        options: examQuestion.question.options,
      })),
      session.answers.map((answer) => ({
        answerId: answer.id,
        questionId: answer.questionId,
        selectedOptionIds: answer.selectedOptionIds,
        answerText: answer.answerText,
      })),
      scoringConfig,
    );

    const metrics = computeResultMetrics(breakdown.rawTotal, scoringConfig);
    const status = breakdown.needsManualGrading ? SubmissionStatus.NEEDS_MANUAL_GRADING : SubmissionStatus.GRADED;
    const showResultImmediately = Boolean(session.exam.showResultImmediately) && !breakdown.needsManualGrading;
    const now = new Date();

    const outcome = await this.prisma
      .$transaction(async (tx) => {
        // The unique `sessionId` makes this the concurrency arbiter: exactly one
        // caller inserts, every other caller rolls back and re-reads below.
        const submission = await tx.submission.create({
          data: {
            sessionId: session.id,
            status,
            autoSubmitted,
            reason,
            totalScore: metrics.score,
            maxScore: metrics.maxScore,
            percentage: metrics.percentage,
            isPassed: metrics.passed,
            gradingCompletedAt: breakdown.needsManualGrading ? null : now,
            result: {
              create: {
                examId: session.examId,
                studentId: session.studentId,
                score: metrics.score,
                maxScore: metrics.maxScore,
                percentage: metrics.percentage,
                passed: metrics.passed,
                publishedAt: showResultImmediately ? now : null,
                // Everything written here came from the automatic pass, so the
                // machine score is also the baseline a later manual edit departs
                // from. Freezing it now means an override can never erase what
                // the automatic grading actually produced.
                autoScore: metrics.score,
                manualAdjusted: false,
                gradingStatus: breakdown.needsManualGrading
                  ? GradingStatus.PENDING
                  : showResultImmediately
                    ? GradingStatus.PUBLISHED
                    : GradingStatus.GRADED,
              },
            },
          },
          include: { result: { select: { id: true } } },
        });

        for (const scored of breakdown.answerScores) {
          await tx.studentAnswer.update({ where: { id: scored.answerId }, data: { score: scored.score } });
        }

        await tx.examSession.update({
          where: { id: session.id },
          data: {
            status: sessionStatus,
            submittedAt: now,
            connectionState: 'CONNECTED',
            lastActivityAt: now,
          },
        });

        return submission;
      })
      .then((submission) => ({ submission, created: true as const }))
      .catch(async (error: unknown) => {
        // A concurrent submit (or the 60s sweep) already finalised this session.
        // Return that authoritative row untouched rather than re-grading.
        if (!isUniqueConstraintCollision(error)) {
          throw error;
        }
        const existing = await this.prisma.submission.findUnique({
          where: { sessionId: session.id },
          include: { result: { select: { id: true } } },
        });
        if (!existing) throw error;
        return { submission: existing, created: false as const };
      });

    const { submission, created } = outcome;

    // The session must be closed even when we lost the race, otherwise a losing
    // request could leave the session IN_PROGRESS and keep accepting answers.
    if (!created) {
      await this.prisma.examSession
        .update({
          where: { id: session.id },
          data: {
            status: sessionStatus,
            submittedAt: session.submittedAt ?? now,
            connectionState: 'CONNECTED',
            lastActivityAt: now,
          },
        })
        .catch(() => undefined);
      return submission;
    }

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
            attemptNumber: session.attemptNumber,
            autoSubmitted,
            reason,
            score: metrics.score,
            status,
          }),
        },
      })
      .catch(() => undefined);

    try {
      await this.monitoring.recordEvent({
        examId: session.examId,
        sessionId: session.id,
        type: ExamEventType.EXAM_SUBMITTED,
        metadata: { autoSubmitted, reason, submissionId: submission.id },
      });
    } catch {
      /* best effort */
    }

    return submission;
  }
}
