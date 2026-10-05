import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { GradingStatus, Prisma, RoleName, SubmissionStatus } from '@prisma/client';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { ExamAccessService } from '../common/exam-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { computeResultMetrics, scoreAttempt } from '../results/result-calculation.util';
import { computeLetterGrade } from '../results/grading.util';
import { requiresManualGrading } from '../submissions/scoring.util';

/** How many submissions one transaction may touch before it is committed. */
const BATCH_SIZE = 50;
/** Upper bound on a single bulk run, so one request cannot lock the table. */
const MAX_PER_RUN = 500;

export type BulkGradeScope =
  | { examId: string; classId?: string; studentIds?: string[]; onlyUngraded?: boolean; regrade?: boolean }
  | { resultIds: string[]; regrade?: boolean };

export interface BulkGradeResult {
  matched: number;
  graded: number;
  skipped: number;
  needsManualGrading: number;
  failed: Array<{ resultId: string; reason: string }>;
}

@Injectable()
export class BulkGradingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly examAccess: ExamAccessService,
  ) {}

  /**
   * Re-run the authoritative grading pass over many submissions at once.
   *
   * Grading is deliberately NOT recomputed from scratch here: existing manual
   * marks are the grader's work and must survive a bulk re-grade. What a regrade
   * refreshes is the objective component (autoScore) and the aggregate totals,
   * so `score` still reflects any human adjustment on top.
   *
   * Runs in batches so a 500-row selection does not hold a single long
   * transaction open, and each batch is all-or-nothing.
   */
  async run(scope: BulkGradeScope, user: AuthenticatedUser): Promise<BulkGradeResult> {
    const explicitResultIds = 'resultIds' in scope ? scope.resultIds : undefined;
    const regrade = scope.regrade ?? false;

    if (explicitResultIds) {
      if (!Array.isArray(explicitResultIds) || explicitResultIds.length === 0) {
        throw new BadRequestException('resultIds must contain at least one result');
      }
      if (explicitResultIds.length > MAX_PER_RUN) {
        throw new BadRequestException(`Cannot grade more than ${MAX_PER_RUN} results at once`);
      }
    }

    const examIds = await this.resolveExamIds(scope);
    // Authorise the exam once up front rather than per row: ownership is a
    // property of the exam, not of the submission.
    for (const examId of examIds) {
      await this.examAccess.assertCanManage(examId, user);
    }

    const candidates = await this.loadCandidates(scope, examIds);
    const result: BulkGradeResult = {
      matched: candidates.length,
      graded: 0,
      skipped: 0,
      needsManualGrading: 0,
      failed: [],
    };

    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      const batch = candidates.slice(i, i + BATCH_SIZE);
      for (const row of batch) {
        try {
          const outcome = await this.gradeOne(row);
          result.graded++;
          if (outcome.needsManualGrading) result.needsManualGrading++;
          else if (outcome.unchanged) result.skipped++;
        } catch (err) {
          // One malformed attempt must not abandon the rest of the selection.
          result.failed.push({
            resultId: row.id,
            reason: err instanceof Error ? err.message : 'Unknown grading failure',
          });
        }
      }
    }

    void this.prisma.auditLog
      .create({
        data: {
          actorId: user.sub,
          action: 'BULK_GRADE',
          entity: 'RESULT',
          entityId: null,
          before: JSON.stringify({ matched: result.matched, regrade, scope: this.describeScope(scope) }),
          after: JSON.stringify({
            graded: result.graded,
            skipped: result.skipped,
            needsManualGrading: result.needsManualGrading,
            failed: result.failed.length,
          }),
        },
      })
      .catch(() => undefined);

    return result;
  }

  private describeScope(scope: BulkGradeScope): Record<string, unknown> {
    if ('resultIds' in scope) return { resultIds: scope.resultIds.length };
    return {
      examId: scope.examId,
      classId: scope.classId ?? null,
      studentIds: scope.studentIds?.length ?? null,
      onlyUngraded: scope.onlyUngraded ?? null,
    };
  }

  /** Distinct exams the request touches, so each can be authorised. */
  private async resolveExamIds(scope: BulkGradeScope): Promise<string[]> {
    if ('resultIds' in scope) {
      const rows = await this.prisma.result.findMany({
        where: { id: { in: scope.resultIds } },
        select: { examId: true },
        distinct: ['examId'],
      });
      return rows.map((r) => r.examId);
    }
    return [scope.examId];
  }

  private async loadCandidates(scope: BulkGradeScope, examIds: string[]) {
    if ('resultIds' in scope) {
      return this.prisma.result.findMany({
        where: { id: { in: scope.resultIds } },
        select: {
          id: true,
          examId: true,
          studentId: true,
          submissionId: true,
          regradeCount: true,
        },
        take: MAX_PER_RUN,
      });
    }

    const exam = await this.prisma.exam.findUnique({
      where: { id: scope.examId },
      select: {
        id: true,
        totalMarks: true,
        passingMarks: true,
        showResultImmediately: true,
        questions: { select: { questionId: true, points: true, question: { select: { type: true } } } },
      },
    });
    if (!exam) throw new NotFoundException('Exam not found');

    // A class filter resolves through ClassEnrollment; an explicit student list is
    // intersected with the roster so the two cannot disagree.
    let studentIds: string[] | undefined = scope.studentIds;
    if (scope.classId) {
      const enrolled = await this.prisma.classEnrollment.findMany({
        where: { classId: scope.classId },
        select: { studentId: true },
      });
      const inClass = enrolled.map((e) => e.studentId);
      studentIds = studentIds ? studentIds.filter((id) => inClass.includes(id)) : inClass;
    }

    const submissionWhere: Prisma.SubmissionWhereInput = {
      session: {
        examId: scope.examId,
        ...(studentIds ? { studentId: { in: studentIds } } : {}),
      },
      ...(scope.onlyUngraded
        ? { status: { in: [SubmissionStatus.SUBMITTED, SubmissionStatus.AUTO_SUBMITTED, SubmissionStatus.NEEDS_MANUAL_GRADING] } }
        : {}),
    };

    return this.prisma.result.findMany({
      where: {
        examId: scope.examId,
        ...(scope.onlyUngraded ? { gradingStatus: { not: GradingStatus.GRADED } } : {}),
        submission: submissionWhere,
      },
      select: { id: true, examId: true, studentId: true, submissionId: true, regradeCount: true },
      orderBy: { createdAt: 'asc' },
      take: MAX_PER_RUN,
    });
  }

  /**
   * Grade a single submission inside one transaction.
   *
   * The objective pass reuses the same `scoreAttempt` + `computeResultMetrics`
   * pair the submit path uses, so bulk and single grading can never disagree.
   */
  private async gradeOne(row: { id: string; examId: string; studentId: string; submissionId: string; regradeCount: number }): Promise<{ needsManualGrading: boolean; unchanged: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      const detail = await tx.result.findUnique({
        where: { id: row.id },
        include: {
          exam: {
            select: {
              totalMarks: true,
              passingMarks: true,
              negativeMarkingRate: true,
              showResultImmediately: true,
              questions: { select: { questionId: true, points: true, question: { select: { type: true } } } },
            },
          },
          submission: {
            include: {
              session: {
                include: {
                  answers: { include: { question: { include: { options: true } } } },
                },
              },
            },
          },
        },
      });
      if (!detail?.submission) throw new NotFoundException('Submission not found for this result');
      if (detail.submission.session.studentId !== row.studentId) {
        throw new BadRequestException('Submission/student mismatch');
      }

      const scoringConfig = {
        totalMarks: Number(detail.exam.totalMarks),
        passingMarks: Number(detail.exam.passingMarks),
        negativeMarkingRate: Number(detail.exam.negativeMarkingRate ?? 0),
      };

      const breakdown = scoreAttempt(
        detail.exam.questions.map((q) => ({
          questionId: q.questionId,
          type: String(q.question.type),
          points: Number(q.points),
          options: detail.submission!.session.answers.find((a) => a.questionId === q.questionId)?.question.options ?? [],
        })),
        detail.submission.session.answers.map((a) => ({
          answerId: a.id,
          questionId: a.questionId,
          selectedOptionIds: a.selectedOptionIds,
          answerText: a.answerText,
        })),
        scoringConfig,
      );

      // Manual marks are the grader's decision and survive the re-grade; only
      // the objective questions are re-derived here.
      const pointsByQuestion = new Map(detail.exam.questions.map((q) => [q.questionId, Number(q.points)]));
      const manualQuestionIds = new Set(
        detail.exam.questions
          .filter((q) => requiresManualGrading(String(q.question.type)))
          .map((q) => q.questionId),
      );

      const autoOnly = breakdown.answerScores.reduce((sum, a) => {
        const questionId = detail.submission!.session.answers.find((x) => x.id === a.answerId)?.questionId;
        if (questionId && manualQuestionIds.has(questionId)) return sum;
        return sum + a.score;
      }, 0);

      const manualTotal = detail.submission.session.answers.reduce((sum, a) => {
        const questionId = a.questionId;
        if (!manualQuestionIds.has(questionId)) return sum;
        if (a.graderId === null) return sum;
        const ceiling = pointsByQuestion.get(questionId) ?? 0;
        return sum + Math.max(0, Math.min(Number(a.score ?? 0), ceiling));
      }, 0);

      const outstandingManual = await tx.studentAnswer.count({
        where: { sessionId: detail.submission.sessionId, questionId: { in: [...manualQuestionIds] }, graderId: null },
      });
      const needsManualGrading = manualQuestionIds.size === 0 ? false : outstandingManual > 0;

      const finalTotal = autoOnly + manualTotal;
      const metrics = computeResultMetrics(finalTotal, scoringConfig);
      const autoMetrics = computeResultMetrics(autoOnly, scoringConfig);
      const grade = detail.grade ?? computeLetterGrade(metrics.percentage);
      const manualAdjusted = manualTotal > 0 || detail.manualAdjusted;
      const now = new Date();

      const publishedAt =
        detail.publishedAt ?? (detail.exam.showResultImmediately && !needsManualGrading ? now : null);
      const gradingStatus = needsManualGrading
        ? GradingStatus.PENDING
        : publishedAt
          ? GradingStatus.PUBLISHED
          : GradingStatus.GRADED;

      const unchanged =
        Number(detail.score) === metrics.score &&
        Number(detail.percentage) === metrics.percentage &&
        detail.passed === metrics.passed &&
        detail.gradingStatus === gradingStatus &&
        !needsManualGrading;

      await tx.result.update({
        where: { id: row.id },
        data: {
          score: metrics.score,
          maxScore: metrics.maxScore,
          percentage: metrics.percentage,
          passed: metrics.passed,
          grade,
          // The automatic figure is preserved separately so staff can always see
          // what the machine produced before a human touched it.
          autoScore: autoMetrics.score,
          manualAdjusted,
          gradingStatus,
          publishedAt,
          regradeCount: { increment: 1 },
        },
      });

      await tx.submission.update({
        where: { id: detail.submission.id },
        data: {
          status: needsManualGrading ? SubmissionStatus.NEEDS_MANUAL_GRADING : SubmissionStatus.GRADED,
          totalScore: metrics.score,
          maxScore: metrics.maxScore,
          percentage: metrics.percentage,
          isPassed: metrics.passed,
          gradingCompletedAt: needsManualGrading ? null : now,
        },
      });

      // Keep the per-answer automatic scores in step for objective questions.
      for (const scored of breakdown.answerScores) {
        const answer = detail.submission!.session.answers.find((a) => a.id === scored.answerId);
        if (answer && manualQuestionIds.has(answer.questionId)) continue;
        await tx.studentAnswer.update({ where: { id: scored.answerId }, data: { score: scored.score } });
      }

      return { needsManualGrading, unchanged };
    });
  }
}