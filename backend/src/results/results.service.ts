import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RoleName } from '@prisma/client';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { ExamAccessService } from '../common/exam-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { clampScore } from '../submissions/scoring.util';
import { GradeAnswerItemDto } from './dto/grade-answers.dto';
import { OverrideResultDto } from './dto/override-result.dto';
import { computeLetterGrade, roundPercentage } from './grading.util';

type FindManyOptions = {
  examId?: string;
  page?: number;
  limit?: number;
  passed?: boolean;
  certificateStatus?: 'issued' | 'none';
};

const MAX_GRADE_ITEMS = 1000;

@Injectable()
export class ResultsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly examAccess: ExamAccessService,
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

  async findMany(user: AuthenticatedUser, options: FindManyOptions = {}) {
    const page = options.page ?? 1;
    const limit = Math.min(options.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where = {
      ...this.resultScope(user),
      ...(options.examId ? { examId: options.examId } : {}),
      ...(options.passed !== undefined ? { passed: options.passed } : {}),
      ...(options.certificateStatus === 'issued' ? { certificate: { isNot: null } } : {}),
      ...(options.certificateStatus === 'none' ? { certificate: { is: null } } : {}),
    };

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
        orderBy: { createdAt: 'desc' },
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

    return this.prisma.result.update({
      where: { id },
      data: { publishedAt: new Date() },
    });
  }

  async gradeManually(id: string, user: AuthenticatedUser, answers: GradeAnswerItemDto[]) {
    const result = await this.prisma.result.findUnique({
      where: { id },
      include: {
        exam: true,
        submission: {
          include: {
            session: { include: { answers: { include: { question: { select: { points: true } } } } } },
          },
        },
      },
    });
    if (!result) throw new NotFoundException('Result not found');
    await this.examAccess.assertCanManage(result.examId, user);

    if (!Array.isArray(answers) || answers.length > MAX_GRADE_ITEMS) {
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

    const graderId = user.sub;
    const toUpdate = answers.map((g) => {
      const answer = answerById.get(g.answerId) as (typeof existingAnswers)[number];
      const rawMax = Number(answer.question?.points ?? Number.NaN);
      const maxPoints = Number.isFinite(rawMax) && rawMax >= 0 ? rawMax : Number(result.exam.totalMarks);
      return this.prisma.studentAnswer.update({
        where: { id: g.answerId },
        data: {
          score: clampScore(g.score, maxPoints),
          feedback: g.feedback === undefined ? undefined : g.feedback.trim() || null,
          graderId,
        },
      });
    });
    if (toUpdate.length > 0) {
      await this.prisma.$transaction(toUpdate);
    }

    const freshAnswers = existingAnswers.length
      ? await this.prisma.studentAnswer.findMany({
          where: { id: { in: existingAnswers.map((a) => a.id) } },
          select: { id: true, score: true },
        })
      : [];
    const maxScore = Number(result.exam.totalMarks);
    const rawTotal = freshAnswers.reduce((sum, a) => sum + Number(a.score ?? 0), 0);
    const totalScore = clampScore(rawTotal, maxScore);
    const percentage = roundPercentage(totalScore, maxScore);
    const passed = totalScore >= Number(result.exam.passingMarks);
    const grade = result.grade ?? computeLetterGrade(percentage);

    const updated = await this.prisma.result.update({
      where: { id },
      data: {
        score: totalScore,
        percentage,
        passed,
        grade,
        publishedAt: result.publishedAt ?? new Date(),
      },
    });

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
            updatedAnswers: toUpdate.length,
            publishedAt: updated.publishedAt?.toISOString(),
          }),
        },
      })
      .catch(() => undefined);

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
