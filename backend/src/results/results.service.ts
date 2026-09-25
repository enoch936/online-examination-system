import { Injectable, NotFoundException } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';

type FindManyOptions = {
  examId?: string;
  page?: number;
  limit?: number;
};

@Injectable()
export class ResultsService {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(user: AuthenticatedUser, options: FindManyOptions = {}) {
    const isStudentOnly = user.roles.includes(RoleName.STUDENT) && !user.roles.includes(RoleName.INSTRUCTOR) && !user.roles.includes(RoleName.ADMIN) && !user.roles.includes(RoleName.SUPER_ADMIN);

    const page = options.page ?? 1;
    const limit = Math.min(options.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where = {
      ...(isStudentOnly ? { studentId: user.sub } : {}),
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

  async publish(id: string) {
    const result = await this.prisma.result.findUnique({ where: { id } });
    if (!result) throw new NotFoundException('Result not found');
    if (result.publishedAt) return result;

    return this.prisma.result.update({
      where: { id },
      data: { publishedAt: new Date() },
    });
  }

  async gradeManually(id: string, graderId: string, answers: Array<{ answerId: string; score: number; feedback?: string }>) {
    const result = await this.prisma.result.findUnique({
      where: { id },
      include: { exam: true, submission: { include: { session: { include: { answers: true } } } } },
    });
    if (!result) throw new NotFoundException('Result not found');

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

    return this.prisma.result.update({
      where: { id },
      data: {
        score: totalScore,
        percentage,
        passed,
        publishedAt: result.publishedAt ?? new Date(),
      },
    });
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const isStudentOnly = user.roles.includes(RoleName.STUDENT) && !user.roles.includes(RoleName.INSTRUCTOR) && !user.roles.includes(RoleName.ADMIN) && !user.roles.includes(RoleName.SUPER_ADMIN);

    const result = await this.prisma.result.findFirst({
      where: {
        id,
        ...(isStudentOnly ? { studentId: user.sub } : {}),
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

    return result;
  }
}
