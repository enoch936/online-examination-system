import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { ExamAccessService } from '../common/exam-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { GradeAnswerItemDto } from './dto/grade-answers.dto';

type FindManyOptions = {
  examId?: string;
  page?: number;
  limit?: number;
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
      include: { exam: true, submission: { include: { session: { include: { answers: true } } } } },
    });
    if (!result) throw new NotFoundException('Result not found');
    await this.examAccess.assertCanManage(result.examId, user);

    if (!Array.isArray(answers) || answers.length > MAX_GRADE_ITEMS) {
      throw new BadRequestException('Invalid grade payload');
    }

    const graderId = user.sub;
    const toUpdate = answers
      .filter((g) => result.submission?.session.answers.some((a) => a.id === g.answerId))
      .map((g) => this.prisma.studentAnswer.update({
        where: { id: g.answerId },
        data: { score: g.score, feedback: g.feedback, graderId },
      }));
    if (toUpdate.length > 0) {
      await this.prisma.$transaction(toUpdate);
    }

    const allAnswers = result.submission?.session.answers ?? [];
    const maxScore = Number(result.exam.totalMarks);
    const totalScore = allAnswers.reduce((sum, a) => sum + Number(a.score ?? 0), 0);
    const percentage = maxScore > 0 ? Number(((totalScore / maxScore) * 100).toFixed(2)) : 0;
    const passed = totalScore >= Number(result.exam.passingMarks);

    const updated = await this.prisma.result.update({
      where: { id },
      data: {
        score: totalScore,
        percentage,
        passed,
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
          before: JSON.stringify({ score: Number(result.score), percentage: Number(result.percentage), passed: result.passed }),
          after: JSON.stringify({
            score: totalScore,
            percentage,
            passed,
            updatedAnswers: toUpdate.length,
            publishedAt: updated.publishedAt?.toISOString(),
          }),
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
        options.map(({ isCorrect, ...rest }) => rest);
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
