import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { GradingStatus, Prisma, RoleName, SubmissionStatus } from '@prisma/client';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { ExamAccessService } from '../common/exam-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { CertificatesService } from '../certificates/certificates.service';
import { clampScore, requiresManualGrading } from '../submissions/scoring.util';
import { GradeAnswerItemDto } from './dto/grade-answers.dto';
import { OverrideResultDto } from './dto/override-result.dto';
import { computeLetterGrade } from './grading.util';
import { computeResultMetrics } from './result-calculation.util';

type FindManyOptions = {
  examId?: string;
  page?: number;
  limit?: number;
  passed?: boolean;
  certificateStatus?: 'issued' | 'none';
  /** Free-text over student name/email and exam title. */
  q?: string;
  /** Narrow to one class, resolved through Class -> ExamAssignment + Enrollment. */
  classId?: string;
  /** Narrow to specific students. */
  studentId?: string;
  /** Grading lifecycle filter. */
  gradingStatus?: GradingStatus;
  /** Submission lifecycle filter. */
  submissionStatus?: SubmissionStatus;
  /** Percentage bounds, inclusive, for "below a particular score" views. */
  minPercentage?: number;
  maxPercentage?: number;
  /** Submission window. */
  submittedFrom?: Date;
  submittedTo?: Date;
  sortBy?: 'submittedAt' | 'percentage' | 'student';
  sortDir?: 'asc' | 'desc';
};

/** Search terms are matched against columns, never interpolated into SQL. */
const SEARCH_TERM_LIMIT = 100;
const MAX_GRADE_ITEMS = 1000;

/**
 * Lifecycle state of a result, derived rather than duplicated.
 *
 * PENDING while manual marks are still outstanding, PUBLISHED once released to
 * the student, GRADED otherwise.
 */
export function gradingStatusFor(publishedAt: Date | null, fullyGraded: boolean): GradingStatus {
  if (!fullyGraded) return GradingStatus.PENDING;
  return publishedAt ? GradingStatus.PUBLISHED : GradingStatus.GRADED;
}

@Injectable()
export class ResultsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly examAccess: ExamAccessService,
    private readonly certificates: CertificatesService,
  ) {}

  private resultScope(user: AuthenticatedUser): { OR?: Array<Record<string, unknown>> } {
    const isAdmin = user.roles.includes(RoleName.SUPER_ADMIN) || user.roles.includes(RoleName.ADMIN);
    const isInstructor = user.roles.includes(RoleName.INSTRUCTOR);
    const isStudent = user.roles.includes(RoleName.STUDENT);

    const orClauses: Array<Record<string, unknown>> = [];
    if (isInstructor && !isAdmin) {
      orClauses.push({
        exam: {
          OR: [{ createdById: user.sub }, { shares: { some: { instructorId: user.sub } } }],
        },
      });
    }
    if (isStudent) {
      orClauses.push({ studentId: user.sub });
    }
    return orClauses.length ? { OR: orClauses } : {};
  }

  /**
   * Translate the query options into a Prisma `where`.
   *
   * Every filter is evaluated by Postgres against the real tables. Nothing is
   * filtered in the browser: the frontend only supplies criteria.
   */
  private async buildWhere(user: AuthenticatedUser, options: FindManyOptions): Promise<Prisma.ResultWhereInput> {
    const scope = this.resultScope(user);

    // Result links to the student only by id, so name/email search has to walk
    // submission -> session -> student.
    const q = options.q?.trim().slice(0, SEARCH_TERM_LIMIT);
    const studentNameFilter = (term: string): Prisma.ResultWhereInput[] => [
      { submission: { session: { student: { firstName: { contains: term, mode: 'insensitive' } } } } },
      { submission: { session: { student: { lastName: { contains: term, mode: 'insensitive' } } } } },
      { submission: { session: { student: { email: { contains: term, mode: 'insensitive' } } } } },
    ];

    const and: Prisma.ResultWhereInput[] = [];
    if (scope.OR) and.push({ OR: scope.OR });
    if (q) {
      and.push({
        OR: [...studentNameFilter(q), { exam: { title: { contains: q, mode: 'insensitive' } } }],
      });
    }

    // A class filter resolves through ClassEnrollment so the student set is the
    // real roster, not whatever the client claimed.
    const classStudentIds = options.classId
      ? (
          await this.prisma.classEnrollment.findMany({
            where: { classId: options.classId },
            select: { studentId: true },
          })
        ).map((e) => e.studentId)
      : undefined;

    const submissionFilter: Prisma.SubmissionWhereInput = {
      ...(options.submissionStatus ? { status: options.submissionStatus } : {}),
      ...(options.submittedFrom || options.submittedTo
        ? {
            submittedAt: {
              ...(options.submittedFrom ? { gte: options.submittedFrom } : {}),
              ...(options.submittedTo ? { lte: options.submittedTo } : {}),
            },
          }
        : {}),
    };

    const where: Prisma.ResultWhereInput = {
      ...(options.examId ? { examId: options.examId } : {}),
      ...(options.passed !== undefined ? { passed: options.passed } : {}),
      ...(options.gradingStatus ? { gradingStatus: options.gradingStatus } : {}),
      ...(options.certificateStatus === 'issued' ? { certificate: { isNot: null } } : {}),
      ...(options.certificateStatus === 'none' ? { certificate: { is: null } } : {}),
      ...(options.studentId ? { studentId: options.studentId } : {}),
      ...(classStudentIds ? { studentId: { in: classStudentIds } } : {}),
      ...(Object.keys(submissionFilter).length ? { submission: submissionFilter } : {}),
      // Both bounds live in one clause: two separate `percentage` spreads would
      // have the second silently discard the first.
      ...(options.minPercentage !== undefined || options.maxPercentage !== undefined
        ? {
            percentage: {
              ...(options.minPercentage !== undefined ? { gte: new Prisma.Decimal(options.minPercentage) } : {}),
              ...(options.maxPercentage !== undefined ? { lte: new Prisma.Decimal(options.maxPercentage) } : {}),
            },
          }
        : {}),
    };

    if (and.length) {
      where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), ...and];
    }
    return where;
  }

  async findMany(user: AuthenticatedUser, options: FindManyOptions = {}) {
    const page = options.page ?? 1;
    const limit = Math.min(options.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where = await this.buildWhere(user, options);

    const dir = options.sortDir === 'asc' ? 'asc' : 'desc';
    const orderBy: Prisma.ResultOrderByWithRelationInput =
      options.sortBy === 'percentage'
        ? { percentage: dir }
        : options.sortBy === 'student'
          ? { submission: { session: { student: { lastName: dir } } } }
          : { submission: { submittedAt: dir } };

    const [data, total] = await Promise.all([
      this.prisma.result.findMany({
        where,
        include: {
          exam: { include: { course: { include: { subject: true } } } },
          certificate: true,
          submission: {
            include: {
              session: {
                include: {
                  student: { select: { id: true, firstName: true, lastName: true, email: true } },
                  answers: {
                    include: {
                      question: { include: { options: { orderBy: { sortOrder: 'asc' } } } },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.result.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async publish(id: string, user: AuthenticatedUser) {
    const result = await this.prisma.result.findUnique({ where: { id }, select: { id: true, examId: true, publishedAt: true } });
    if (!result) throw new NotFoundException('Result not found');
    await this.examAccess.assertCanManage(result.examId, user);
    if (result.publishedAt) return this.prisma.result.findUnique({ where: { id } });

    const published = await this.prisma.result.update({
      where: { id },
      data: { publishedAt: new Date() },
    });

    // Auto-issue is best-effort by design: `issueOnPublish` never throws, so an
    // unreachable certificate insert can never undo a successful publication.
    await this.certificates.issueOnPublish(id, user.sub);

    return published;
  }

  async gradeManually(id: string, user: AuthenticatedUser, answers: GradeAnswerItemDto[]) {
    const result = await this.prisma.result.findUnique({
      where: { id },
      include: {
        exam: { include: { questions: { select: { questionId: true, points: true, question: { select: { type: true } } } } } },
        submission: {
          include: {
            session: { include: { answers: true } },
          },
        },
      },
    });
    if (!result) throw new NotFoundException('Result not found');
    await this.examAccess.assertCanManage(result.examId, user);

    // An empty payload used to be accepted, which zeroed every answer and
    // published a GRADED result — a real way to destroy a student's marks.
    if (!Array.isArray(answers) || answers.length === 0) {
      throw new BadRequestException('Invalid grade payload');
    }
    if (answers.length > MAX_GRADE_ITEMS) {
      throw new BadRequestException('Invalid grade payload');
    }

    const existingAnswers = result.submission?.session.answers ?? [];
    const answerById = new Map(existingAnswers.map((a) => [a.id, a]));

    const unknownIds = answers.filter((g) => !answerById.has(g.answerId)).map((g) => g.answerId);
    if (unknownIds.length > 0) {
      throw new BadRequestException('Grade payload references answers outside this submission');
    }

    const seen = new Set<string>();
    for (const item of answers) {
      if (seen.has(item.answerId)) {
        throw new BadRequestException('Grade payload contains duplicate answer entries');
      }
      seen.add(item.answerId);
    }

    // The per-question ceiling must come from the exam's own mark allocation.
    // The old code read `Question.points` (the question bank default) and fell
    // back to the whole `exam.totalMarks`, so a single manual grade could be
    // clamped to the entire exam's worth of marks.
    const examPoints = new Map(result.exam.questions.map((q) => [q.questionId, Number(q.points)]));
    const graderId = user.sub;
    const pendingUpdates = answers.map((g) => {
      const answer = answerById.get(g.answerId) as (typeof existingAnswers)[number];
      const configured = examPoints.get(answer.questionId);
      const maxPoints = Number.isFinite(configured) && (configured as number) >= 0 ? (configured as number) : 0;
      return {
        answerId: g.answerId,
        data: {
          score: clampScore(g.score, maxPoints),
          feedback: g.feedback === undefined ? undefined : g.feedback.trim() || null,
          graderId,
        },
      };
    });

    // Only questions that actually need a human count as outstanding. Counting
    // every `graderId: null` answer also counted the auto-graded ones — and since
    // auto-grading never sets a grader, a 10-question exam with one essay could
    // never leave NEEDS_MANUAL_GRADING no matter how much work the grader did.
    const manualQuestionIds = result.exam.questions
      .filter((q) => requiresManualGrading(String(q.question.type)))
      .map((q) => q.questionId);

    // Manual grading finishing the last outstanding answer transitions the
    // submission out of NEEDS_MANUAL_GRADING. Previously it stayed stuck, so
    // `pendingGradings` never cleared even after a grader had finished.
    //
    // Everything below runs in ONE transaction. It used to be split: the
    // per-answer scores committed first, then the aggregates were re-read and
    // written separately. A failure in between left the answer rows carrying
    // new marks while the Result still showed the old totals and the Submission
    // was still flagged NEEDS_MANUAL_GRADING, and two graders saving at once
    // could interleave between the write and the re-read.
    const outcome = await this.prisma.$transaction(async (tx) => {
      for (const update of pendingUpdates) {
        await tx.studentAnswer.update({ where: { id: update.answerId }, data: update.data });
      }

      // Re-read inside the transaction so the totals are derived from the rows
      // this call actually wrote.
      const freshAnswers = existingAnswers.length
        ? await tx.studentAnswer.findMany({
            where: { id: { in: existingAnswers.map((a) => a.id) } },
            select: { id: true, questionId: true, score: true },
          })
        : [];

      // Re-aggregate the persisted per-answer scores through the same central
      // calculation used for auto-grading, so percentage/pass can never diverge.
      const totalMarks = Number(result.exam.totalMarks);
      const passingMarks = Number(result.exam.passingMarks);
      const pointsByQuestion = new Map(result.exam.questions.map((q) => [q.questionId, Number(q.points)]));
      const rawTotal = freshAnswers.reduce((sum, a) => {
        const ceiling = pointsByQuestion.get(a.questionId);
        if (!Number.isFinite(ceiling) || (ceiling as number) <= 0) return sum;
        return sum + clampScore(Number(a.score ?? 0), ceiling as number);
      }, 0);

      const metrics = computeResultMetrics(rawTotal, { totalMarks, passingMarks });
      const grade = result.grade ?? computeLetterGrade(metrics.percentage);
      // Anything written by a human means the result no longer equals what the
      // automatic pass produced, which is what `manualAdjusted` records.
      const manualAdjusted =
        result.manualAdjusted || pendingUpdates.some((u) => u.data.graderId !== null);

      const stillPending =
        manualQuestionIds.length === 0
          ? 0
          : await tx.studentAnswer.count({
              where: {
                sessionId: result.submission!.sessionId,
                questionId: { in: manualQuestionIds },
                graderId: null,
              },
            });
      const fullyGraded = stillPending === 0;
      const publishedAt = result.publishedAt ?? (result.exam.showResultImmediately && fullyGraded ? new Date() : null);

      await tx.submission.update({
        where: { id: result.submissionId },
        data: {
          status: fullyGraded ? SubmissionStatus.GRADED : SubmissionStatus.NEEDS_MANUAL_GRADING,
          gradingCompletedAt: fullyGraded ? new Date() : null,
        },
      });
      const updatedResult = await tx.result.update({
        where: { id },
        data: {
          score: metrics.score,
          percentage: metrics.percentage,
          passed: metrics.passed,
          grade,
          publishedAt,
          // The automatic baseline is frozen the first time a human edits marks,
          // so the original machine figure survives every later override.
          ...(result.autoScore === null ? { autoScore: result.score } : {}),
          manualAdjusted,
          gradingStatus: gradingStatusFor(publishedAt, fullyGraded),
          gradedById: manualAdjusted ? graderId : result.gradedById,
        },
      });
      return { updatedResult, totalScore: metrics.score, percentage: metrics.percentage, passed: metrics.passed, grade };
    });

    const { updatedResult: updated, totalScore, percentage, passed, grade } = outcome;

    void this.prisma.auditLog
      .create({
        data: {
          actorId: graderId,
          action: 'GRADE_MODIFIED',
          entity: 'RESULT',
          entityId: id,
          before: JSON.stringify({
            score: Number(result.score),
            percentage: Number(result.percentage),
            passed: result.passed,
            grade: result.grade,
          }),
          after: JSON.stringify({
            score: totalScore,
            percentage,
            passed,
            grade,
            updatedAnswers: pendingUpdates.length,
            publishedAt: updated.publishedAt?.toISOString(),
          }),
        },
      })
      .catch(() => undefined);

    // Manual grading can be what finally publishes the result, so it needs the
    // same auto-issue trigger as an explicit publish.
    if (updated.publishedAt) {
      await this.certificates.issueOnPublish(id, graderId);
    }

    return updated;
  }

  /**
   * Staff-driven edits that are deliberately kept out of the per-answer grading
   * path: the letter grade (auto-filled from the percentage on first grading,
   * then owned by staff until reset) and the overall result feedback.
   */
  async overrideResult(id: string, user: AuthenticatedUser, dto: OverrideResultDto) {
    const result = await this.prisma.result.findUnique({ where: { id } });
    if (!result) throw new NotFoundException('Result not found');
    await this.examAccess.assertCanManage(result.examId, user);

    const percentage = Number(result.percentage);
    const data: Prisma.ResultUpdateInput = {};

    if (dto.grade !== undefined) {
      data.grade = dto.grade === null ? computeLetterGrade(percentage) : dto.grade;
    } else if (dto.recomputeGrade) {
      data.grade = computeLetterGrade(percentage);
    }

    if (dto.feedback !== undefined) {
      data.feedback = dto.feedback === null ? null : dto.feedback.trim() || null;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No grade changes supplied');
    }

    const updated = await this.prisma.result.update({ where: { id }, data });

    void this.prisma.auditLog
      .create({
        data: {
          actorId: user.sub,
          action: 'RESULT_OVERRIDDEN',
          entity: 'RESULT',
          entityId: id,
          before: JSON.stringify({ grade: result.grade, feedback: result.feedback }),
          after: JSON.stringify({ grade: updated.grade, feedback: updated.feedback }),
        },
      })
      .catch(() => undefined);

    return updated;
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const isAdmin = user.roles.includes(RoleName.SUPER_ADMIN) || user.roles.includes(RoleName.ADMIN);
    const isStudentOnly = user.roles.includes(RoleName.STUDENT) && !user.roles.includes(RoleName.INSTRUCTOR) && !isAdmin;

    const result = await this.prisma.result.findFirst({
      where: {
        id,
        ...this.resultScope(user),
      },
      include: {
        exam: {
          include: {
            course: { include: { subject: true } },
            questions: {
              orderBy: { sortOrder: 'asc' },
              include: {
                question: {
                  include: { options: { orderBy: { sortOrder: 'asc' } } },
                },
              },
            },
          },
        },
        certificate: true,
        submission: {
          include: {
            session: {
              include: {
                student: { select: { id: true, firstName: true, lastName: true, email: true } },
                answers: {
                  include: {
                    question: { include: { options: { orderBy: { sortOrder: 'asc' } } } },
                    grader: { select: { id: true, firstName: true, lastName: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!result) {
      throw new NotFoundException('Result not found');
    }

    if (isStudentOnly) {
      const stripKey = (options: Array<Record<string, unknown>>) =>
        options.map(({ isCorrect: _isCorrect, ...rest }) => rest);
      for (const entry of result.exam?.questions ?? []) {
        if (entry.question) {
          (entry.question as Record<string, unknown>).options = stripKey(entry.question.options as Array<Record<string, unknown>>);
        }
      }
      for (const answer of result.submission?.session?.answers ?? []) {
        if (answer.question) {
          (answer.question as Record<string, unknown>).options = stripKey(answer.question.options as Array<Record<string, unknown>>);
        }
      }
    }

    return result;
  }
}
