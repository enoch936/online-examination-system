import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ExamPermissionLevel, ExamStatus, RoleName } from '@prisma/client';
import { AuditService } from '../common/audit.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { distributePoints } from '../submissions/scoring.util';
import { CreateExamDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';

const ADMIN_ROLES = [RoleName.SUPER_ADMIN, RoleName.ADMIN];
const PERMISSION_LEVELS = Object.values(ExamPermissionLevel);

@Injectable()
export class ExamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findMany(user: AuthenticatedUser) {
    const isAdmin = user.roles.some((role) => ADMIN_ROLES.some((admin) => admin === role));
    const where = isAdmin
      ? {}
      : {
          OR: [
            { createdById: user.sub },
            { shares: { some: { instructorId: user.sub } } },
          ],
        };

    const exams = await this.prisma.exam.findMany({
      where,
      take: 500,
      include: {
        course: { include: { subject: true } },
        courses: { include: { course: { include: { subject: true } } } },
        questionBanks: { include: { questionBank: { select: { id: true, name: true } } } },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        shares: {
          select: {
            permissionLevel: true,
            instructor: { select: { id: true, firstName: true, lastName: true, email: true } },
            grantedBy: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        _count: { select: { questions: true, sessions: true, assignments: true } },
      },
      orderBy: { startsAt: 'desc' },
    });

    const examIds = exams.map((exam) => exam.id);
    const [submissionRows, sessionRows, violationRows] = await Promise.all([
      this.prisma.examSession.groupBy({
        by: ['examId'],
        where: { examId: { in: examIds }, submission: { isNot: null } },
        _count: { _all: true },
      }),
      this.prisma.examSession.findMany({
        where: { examId: { in: examIds } },
        select: { id: true, examId: true },
      }),
      this.prisma.examViolation.groupBy({
        by: ['sessionId'],
        where: { session: { examId: { in: examIds } } },
        _count: { _all: true },
      }),
    ]);

    const sessionExam = new Map(sessionRows.map((s) => [s.id, s.examId]));
    const violationsByExam = new Map<string, number>();
    const submissionsByExam = new Map<string, number>();
    for (const row of submissionRows) {
      submissionsByExam.set(row.examId, row._count._all);
    }
    for (const violation of violationRows) {
      const examId = sessionExam.get(violation.sessionId);
      if (examId) {
        violationsByExam.set(examId, (violationsByExam.get(examId) ?? 0) + violation._count._all);
      }
    }

    return exams.map((exam) => {
      const myShare = exam.shares.find((s) => s.instructor.id === user.sub);
      return {
        ...exam,
        isOwner: exam.createdById === user.sub || isAdmin,
        myPermission: exam.createdById === user.sub ? 'OWNER' : (myShare?.permissionLevel ?? null),
        shares: exam.shares.map((share) => ({
          id: share.instructor.id,
          firstName: share.instructor.firstName,
          lastName: share.instructor.lastName,
          email: share.instructor.email,
          permissionLevel: share.permissionLevel,
          grantedBy: share.grantedBy.firstName,
        })),
        monitoring: {
          violations: violationsByExam.get(exam.id) ?? 0,
          submissions: submissionsByExam.get(exam.id) ?? 0,
        },
      };
    });
  }

  async getInstructors() {
    return this.prisma.user.findMany({
      where: { roles: { some: { role: { name: RoleName.INSTRUCTOR } } } },
      select: { id: true, firstName: true, lastName: true, email: true, status: true },
      orderBy: { firstName: 'asc' },
    });
  }

  async getShares(id: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id },
      select: {
        id: true,
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        shares: {
          select: {
            permissionLevel: true,
            instructor: { select: { id: true, firstName: true, lastName: true, email: true } },
            grantedBy: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
    if (!exam) throw new NotFoundException('Exam not found');
    return {
      owner: exam.createdBy,
      shares: exam.shares.map((share) => ({
        id: share.instructor.id,
        firstName: share.instructor.firstName,
        lastName: share.instructor.lastName,
        email: share.instructor.email,
        permissionLevel: share.permissionLevel,
        grantedBy: `${share.grantedBy.firstName} ${share.grantedBy.lastName}`.trim(),
      })),
    };
  }

  private assertPermissionLevel(level: ExamPermissionLevel) {
    if (!PERMISSION_LEVELS.includes(level)) {
      throw new BadRequestException('permissionLevel must be one of VIEWER, MONITOR, PROCTOR, CO_OWNER');
    }
  }

  async share(id: string, instructorIds: string[], permissionLevel: ExamPermissionLevel, user: AuthenticatedUser) {
    this.assertPermissionLevel(permissionLevel);

    const exam = await this.prisma.exam.findUnique({
      where: { id },
      select: { id: true, title: true, createdById: true },
    });
    if (!exam) throw new NotFoundException('Exam not found');

    const uniqueIds = [...new Set(instructorIds)]
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((instructorId) => instructorId !== exam.createdById);

    if (uniqueIds.length === 0) return this.getShares(id);

    const instructors = await this.prisma.user.count({
      where: {
        id: { in: uniqueIds },
        roles: { some: { role: { name: RoleName.INSTRUCTOR } } },
      },
    });
    if (instructors !== uniqueIds.length) {
      throw new BadRequestException('Access can only be granted to instructor accounts');
    }

    await this.prisma.$transaction(
      uniqueIds.map((instructorId) =>
        this.prisma.examShare.upsert({
          where: { examId_instructorId: { examId: id, instructorId } },
          create: { examId: id, instructorId, permissionLevel, grantedById: user.sub },
          update: { permissionLevel, grantedById: user.sub },
        }),
      ),
    );

    await this.audit.log(
      user.sub,
      'EXAM',
      id,
      'SHARE_GRANTED',
      { after: JSON.stringify({ instructorIds: uniqueIds, permissionLevel }) },
    );

    return this.getShares(id);
  }

  async updateShareLevel(id: string, instructorId: string, permissionLevel: ExamPermissionLevel, user: AuthenticatedUser) {
    this.assertPermissionLevel(permissionLevel);

    const existing = await this.prisma.examShare.findUnique({
      where: { examId_instructorId: { examId: id, instructorId } },
      select: { permissionLevel: true },
    });
    if (!existing) throw new NotFoundException('Instructor does not have access to this exam');

    await this.prisma.examShare.update({
      where: { examId_instructorId: { examId: id, instructorId } },
      data: { permissionLevel, grantedById: user.sub },
    });

    await this.audit.log(
      user.sub,
      'EXAM',
      id,
      'SHARE_LEVEL_CHANGED',
      { before: existing.permissionLevel, after: permissionLevel },
    );

    return this.getShares(id);
  }

  async unshare(id: string, instructorId: string, user: AuthenticatedUser) {
    const exam = await this.prisma.exam.findUnique({ where: { id }, select: { id: true, title: true } });
    if (!exam) throw new NotFoundException('Exam not found');

    const existing = await this.prisma.examShare.findUnique({
      where: { examId_instructorId: { examId: id, instructorId } },
      select: { permissionLevel: true },
    });

    await this.prisma.examShare.deleteMany({
      where: { examId: id, instructorId },
    });

    if (existing) {
      await this.audit.log(
        user.sub,
        'EXAM',
        id,
        'SHARE_REVOKED',
        { after: JSON.stringify({ instructorId, previousLevel: existing.permissionLevel }) },
      );
    }

    return this.getShares(id);
  }

  async transferOwnership(id: string, toInstructorId: string, user: AuthenticatedUser) {
    const exam = await this.prisma.exam.findUnique({
      where: { id },
      select: { id: true, title: true, createdById: true },
    });
    if (!exam) throw new NotFoundException('Exam not found');

    const target = await this.prisma.user.findUnique({
      where: { id: toInstructorId },
      select: { id: true, roles: { select: { role: { select: { name: true } } } } },
    });
    if (!target) throw new NotFoundException('Target instructor not found');
    const isInstructor = target.roles.some((r) => r.role.name === RoleName.INSTRUCTOR);
    if (!isInstructor) throw new BadRequestException('Ownership can only be transferred to an instructor');
    if (target.id === exam.createdById) throw new BadRequestException('Instructor is already the owner of this exam');

    await this.prisma.$transaction(async (tx) => {
      await tx.exam.update({
        where: { id },
        data: { createdById: toInstructorId },
      });
      await tx.examShare.deleteMany({
        where: { examId: id, instructorId: toInstructorId },
      });
      await tx.examShare.upsert({
        where: { examId_instructorId: { examId: id, instructorId: exam.createdById } },
        create: { examId: id, instructorId: exam.createdById, permissionLevel: ExamPermissionLevel.CO_OWNER, grantedById: toInstructorId },
        update: { permissionLevel: ExamPermissionLevel.CO_OWNER, grantedById: toInstructorId },
      });
    });

    await this.audit.log(
      user.sub,
      'EXAM',
      id,
      'OWNERSHIP_TRANSFERRED',
      { before: exam.createdById, after: toInstructorId },
    );

    return this.getShares(id);
  }

  async getAuditLogs(id: string) {
    return this.audit.listForExam(id, 100);
  }

  async findAvailable(studentId: string) {
    const now = new Date();
    const exams = await this.prisma.exam.findMany({
      where: {
        status: { in: [ExamStatus.PUBLISHED, ExamStatus.LIVE] },
        endsAt: { gte: now },
        OR: [{ assignments: { none: {} } }, { assignments: { some: { studentId } } }],
      },
      include: {
        course: { include: { subject: true } },
        courses: { include: { course: { include: { subject: true } } } },
        questionBanks: { include: { questionBank: { select: { id: true, name: true } } } },
        _count: { select: { questions: true } },
      },
      orderBy: { endsAt: 'asc' },
    });

    const sessions = await this.prisma.examSession.findMany({
      where: {
        studentId,
        examId: { in: exams.map((e) => e.id) },
        status: { in: ['IN_PROGRESS', 'SUBMITTED', 'AUTO_SUBMITTED'] },
      },
      select: { examId: true, status: true, id: true, attemptNumber: true },
    });

    const sessionMap = new Map(sessions.map((s) => [s.examId, s]));

    return exams.map((exam) => ({
      ...exam,
      session: sessionMap.get(exam.id) ?? null,
    }));
  }

  async findOne(id: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id },
      include: {
        course: { include: { subject: true } },
        courses: { include: { course: { include: { subject: true } } } },
        questionBanks: { include: { questionBank: { select: { id: true, name: true } } } },
        questions: {
          orderBy: { sortOrder: 'asc' },
          include: {
            question: {
              include: {
                options: { orderBy: { sortOrder: 'asc' } },
                questionBank: { select: { id: true, name: true } },
                subject: { select: { id: true, name: true } },
              },
            },
          },
        },
        assignments: {
          include: { student: { select: { id: true, firstName: true, lastName: true, email: true } } },
        },
      },
    });
    if (!exam) {
      throw new NotFoundException('Exam not found');
    }
    return exam;
  }

  async getQuestionPool(courseIds: string[]) {
    const courses = await this.prisma.course.findMany({
      where: { id: { in: courseIds } },
      include: { subject: true },
    });
    if (courses.length !== courseIds.length) {
      const found = new Set(courses.map((c) => c.id));
      const missing = courseIds.filter((id) => !found.has(id));
      throw new NotFoundException(`Course(s) not found: ${missing.join(', ')}`);
    }

    const coursePools = await Promise.all(
      courses.map(async (course) => {
        const [banks, standaloneQuestions] = await Promise.all([
          this.prisma.questionBank.findMany({
            where: { courseId: course.id, categoryId: course.subjectId },
            include: {
              _count: { select: { questions: true } },
              questions: {
                where: { isActive: true },
                include: { options: { orderBy: { sortOrder: 'asc' } } },
                orderBy: { sortOrder: 'asc' },
              },
            },
            orderBy: { name: 'asc' },
          }),
          this.prisma.question.findMany({
            where: { subjectId: course.subjectId, questionBankId: null, isActive: true },
            include: { options: { orderBy: { sortOrder: 'asc' } } },
            orderBy: [{ topic: 'asc' }, { createdAt: 'desc' }],
          }),
        ]);

        return {
          course: {
            id: course.id,
            code: course.code,
            name: course.name,
            subject: { id: course.subjectId, name: course.subject.name },
          },
          banks: banks.map((bank) => ({
            id: bank.id,
            name: bank.name,
            description: bank.description,
            courseId: bank.courseId,
            categoryId: bank.categoryId,
            questionCount: bank._count.questions,
            questions: bank.questions,
          })),
          standaloneQuestions,
        };
      }),
    );

    const totalQuestions = coursePools.reduce(
      (sum, pool) =>
        sum +
        pool.banks.reduce((s, b) => s + b.questionCount, 0) +
        pool.standaloneQuestions.length,
      0,
    );

    return { courses: coursePools, totalQuestions };
  }

  async create(dto: CreateExamDto, createdById: string) {
    const slug = `${this.slugify(dto.title)}-${Date.now()}`;
    const courseIds = Array.from(new Set([dto.courseId, ...(dto.courseIds ?? [])]));
    const questionBankId = dto.questionBankId ?? null;
    const questionBankIds = Array.from(
      new Set([...(dto.questionBankIds ?? []), ...(questionBankId ? [questionBankId] : [])]),
    );
    const questionIds = await this.resolveQuestionIds(dto, courseIds, questionBankIds);
    if (questionBankIds.length > 0) {
      await this.assertBanksInCourses(questionBankIds, courseIds);
    }
    this.assertScoringBounds(dto.totalMarks, dto.passingMarks, dto.negativeMarkingRate ?? 0);
    const points = distributePoints(dto.totalMarks, questionIds.length);

    return this.prisma.exam.create({
      data: {
        courseId: dto.courseId,
        createdById,
        title: dto.title,
        slug,
        description: dto.description,
        instructions: dto.instructions,
        durationMinutes: dto.durationMinutes,
        totalMarks: dto.totalMarks,
        passingMarks: dto.passingMarks,
        negativeMarkingRate: dto.negativeMarkingRate ?? 0,
        attemptsAllowed: dto.attemptsAllowed ?? 1,
        randomizeQuestions: dto.randomizeQuestions ?? true,
        randomizeOptions: dto.randomizeOptions ?? true,
        fullscreenRequired: dto.fullscreenRequired ?? true,
        showResultImmediately: dto.showResultImmediately ?? false,
        resumeApprovalRequired: dto.resumeApprovalRequired ?? false,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        status: ExamStatus.SCHEDULED,
        questionBankId: questionBankIds.length === 1 ? questionBankIds[0] : null,
        courses: {
          create: courseIds.map((courseId) => ({ courseId })),
        },
        questionBanks: {
          create: questionBankIds.map((bankId) => ({ questionBankId: bankId })),
        },
        questions: {
          create: questionIds.map((questionId, index) => ({
            questionId,
            points: points[index],
            sortOrder: index,
          })),
        },
      },
      include: { questions: true, courses: true, questionBanks: true },
    });
  }

  private async resolveQuestionIds(
    dto: CreateExamDto,
    courseIds: string[],
    questionBankIds: string[],
  ): Promise<string[]> {
    const courses = await this.prisma.course.findMany({
      where: { id: { in: courseIds } },
      select: { id: true, subjectId: true },
    });
    if (courses.length !== courseIds.length) {
      throw new NotFoundException('Course(s) not found');
    }
    const courseIdSet = new Set(courses.map((c) => c.id));
    const subjectIdSet = new Set(courses.map((c) => c.subjectId));

    if (dto.questionIds && dto.questionIds.length > 0) {
      await this.assertQuestionsInCourses(dto.questionIds, courseIdSet, subjectIdSet);
      return dto.questionIds;
    }

    if (questionBankIds.length === 0) {
      return [];
    }

    const bank = await this.prisma.questionBank.findUnique({
      where: { id: questionBankIds[0] },
      select: { id: true, courseId: true, categoryId: true },
    });
    if (!bank) throw new NotFoundException('Question bank not found');
    if (!courseIdSet.has(bank.courseId) || !subjectIdSet.has(bank.categoryId)) {
      throw new BadRequestException('Question bank does not belong to the selected course(s)');
    }

    const questions = await this.prisma.question.findMany({
      where: { questionBankId: bank.id, isActive: true, subjectId: bank.categoryId },
      select: { id: true },
      orderBy: { sortOrder: 'asc' },
    });

    const count = dto.questionCount !== undefined ? Math.min(dto.questionCount, questions.length) : questions.length;
    const shuffled = this.shuffle(questions.map((q) => q.id));
    return shuffled.slice(0, count);
  }

  private async assertQuestionsInCourses(
    questionIds: string[],
    courseIdSet: Set<string>,
    subjectIdSet: Set<string>,
  ): Promise<void> {
    const questions = await this.prisma.question.findMany({
      where: { id: { in: questionIds }, isActive: true },
      select: {
        id: true,
        subjectId: true,
        questionBankId: true,
        questionBank: { select: { courseId: true, categoryId: true } },
      },
    });
    if (questions.length !== questionIds.length) {
      throw new BadRequestException('Some questions do not exist or are inactive');
    }

    const byId = new Map(questions.map((q) => [q.id, q]));
    for (const id of questionIds) {
      const q = byId.get(id);
      if (!q) {
        throw new BadRequestException('Some questions do not exist or are inactive');
      }
      if (q.questionBankId === null) {
        if (!subjectIdSet.has(q.subjectId)) {
          throw new BadRequestException('Question does not belong to the selected course(s)');
        }
        continue;
      }
      const bank = q.questionBank;
      if (
        !bank ||
        !courseIdSet.has(bank.courseId) ||
        !subjectIdSet.has(bank.categoryId) ||
        q.subjectId !== bank.categoryId
      ) {
        throw new BadRequestException('Question does not belong to the selected course(s)');
      }
    }
  }

  private async assertBanksInCourses(
    questionBankIds: string[],
    courseIds: string[],
  ): Promise<void> {
    const banks = await this.prisma.questionBank.findMany({
      where: { id: { in: questionBankIds } },
      select: { id: true, courseId: true },
    });
    if (banks.length !== questionBankIds.length) {
      throw new BadRequestException('Some question banks do not exist');
    }
    const courseIdSet = new Set(courseIds);
    for (const bank of banks) {
      if (!courseIdSet.has(bank.courseId)) {
        throw new BadRequestException('Question bank does not belong to the selected course(s)');
      }
    }
  }

  private assertScoringBounds(totalMarks: number, passingMarks: number, negativeMarkingRate: number) {
    if (!(totalMarks >= 1)) {
      throw new BadRequestException('Total marks must be at least 1');
    }
    if (passingMarks < 0) {
      throw new BadRequestException('Passing marks cannot be negative');
    }
    if (passingMarks > totalMarks) {
      throw new BadRequestException('Passing marks cannot exceed total marks');
    }
    if (negativeMarkingRate < 0 || negativeMarkingRate > 1) {
      throw new BadRequestException('Negative marking rate must be between 0 and 1');
    }
  }

  private shuffle<T>(items: T[]): T[] {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  async update(id: string, dto: UpdateExamDto) {
    const existing = await this.findOne(id);
    const effectiveTotalMarks = Number(dto.totalMarks ?? existing.totalMarks);
    const effectivePassingMarks = Number(dto.passingMarks ?? existing.passingMarks);
    this.assertScoringBounds(
      effectiveTotalMarks,
      effectivePassingMarks,
      Number(dto.negativeMarkingRate ?? existing.negativeMarkingRate),
    );
    const data: Record<string, unknown> = {};
    if (dto.courseId !== undefined) data.courseId = dto.courseId;
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.instructions !== undefined) data.instructions = dto.instructions;
    if (dto.durationMinutes !== undefined) data.durationMinutes = dto.durationMinutes;
    if (dto.totalMarks !== undefined) data.totalMarks = dto.totalMarks;
    if (dto.passingMarks !== undefined) data.passingMarks = dto.passingMarks;
    if (dto.attemptsAllowed !== undefined) data.attemptsAllowed = dto.attemptsAllowed;
    if (dto.randomizeQuestions !== undefined) data.randomizeQuestions = dto.randomizeQuestions;
    if (dto.randomizeOptions !== undefined) data.randomizeOptions = dto.randomizeOptions;
    if (dto.fullscreenRequired !== undefined) data.fullscreenRequired = dto.fullscreenRequired;
    if (dto.showResultImmediately !== undefined) data.showResultImmediately = dto.showResultImmediately;
    if (dto.resumeApprovalRequired !== undefined) data.resumeApprovalRequired = dto.resumeApprovalRequired;
    if (dto.negativeMarkingRate !== undefined) data.negativeMarkingRate = dto.negativeMarkingRate;
    if (dto.startsAt !== undefined) data.startsAt = new Date(dto.startsAt);
    if (dto.endsAt !== undefined) data.endsAt = new Date(dto.endsAt);
    if (dto.title !== undefined) data.slug = `${this.slugify(dto.title)}-${Date.now()}`;

    return this.prisma.$transaction(async (tx) => {
      if (dto.questionIds) {
        const effectiveCourseIds = Array.from(
          new Set([
            ...(dto.courseIds ?? []),
            ...(existing.courses ?? []).map((ec) => ec.course.id),
            existing.courseId,
          ]),
        );
        const courses = await this.prisma.course.findMany({
          where: { id: { in: effectiveCourseIds } },
          select: { id: true, subjectId: true },
        });
        if (courses.length !== effectiveCourseIds.length) {
          throw new BadRequestException('Course not found');
        }
        await this.assertQuestionsInCourses(
          dto.questionIds,
          new Set(courses.map((c) => c.id)),
          new Set(courses.map((c) => c.subjectId)),
        );
        const newPoints = distributePoints(effectiveTotalMarks, dto.questionIds!.length);
        await tx.examQuestion.deleteMany({ where: { examId: id } });
        await tx.examQuestion.createMany({
          data: dto.questionIds!.map((questionId, index) => ({
            examId: id,
            questionId,
            points: newPoints[index],
            sortOrder: index,
          })),
        });
      }

      if (dto.courseIds !== undefined || dto.courseId !== undefined) {
        const baseCourseIds = dto.courseIds ?? (existing.courses ?? []).map((ec) => ec.course.id);
        const primaryCourseId = dto.courseId ?? existing.courseId;
        const allCourses = Array.from(new Set([primaryCourseId, ...baseCourseIds]));
        await tx.examCourse.deleteMany({ where: { examId: id } });
        await tx.examCourse.createMany({
          data: allCourses.map((courseId) => ({ examId: id, courseId })),
        });
      }

      if (dto.questionBankIds !== undefined) {
        const effectiveCourseIds = Array.from(
          new Set([
            ...(dto.courseIds ?? []),
            ...(existing.courses ?? []).map((ec) => ec.course.id),
            dto.courseId ?? existing.courseId,
          ]),
        );
        await this.assertBanksInCourses(dto.questionBankIds, effectiveCourseIds);
        await tx.examQuestionBank.deleteMany({ where: { examId: id } });
        await tx.examQuestionBank.createMany({
          data: dto.questionBankIds.map((questionBankId) => ({ examId: id, questionBankId })),
        });
      }

      if (dto.totalMarks !== undefined && !dto.questionIds) {
        const newPoints = distributePoints(dto.totalMarks, existing.questions.length);
        for (const [index, examQuestion] of existing.questions.entries()) {
          await tx.examQuestion.update({
            where: { id: examQuestion.id },
            data: { points: newPoints[index] },
          });
        }
      }

      return tx.exam.update({
        where: { id },
        data,
        include: {
          course: { include: { subject: true } },
          courses: { include: { course: { include: { subject: true } } } },
          questionBanks: { include: { questionBank: { select: { id: true, name: true } } } },
          questions: {
            orderBy: { sortOrder: 'asc' },
            include: {
              question: {
                include: {
                  options: { orderBy: { sortOrder: 'asc' } },
                  questionBank: { select: { id: true, name: true } },
                  subject: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      });
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.exam.update({
      where: { id },
      data: { status: ExamStatus.CLOSED },
    });
  }

  async publish(id: string) {
    await this.findOne(id);
    return this.prisma.exam.update({
      where: { id },
      data: { status: ExamStatus.PUBLISHED },
    });
  }

  async start(id: string) {
    const exam = await this.findOne(id);
    const now = new Date();
    return this.prisma.exam.update({
      where: { id },
      data: {
        status: ExamStatus.LIVE,
        startsAt: new Date(now.getTime() - 60_000),
        endsAt: new Date(now.getTime() + exam.durationMinutes * 60 * 1000),
      },
    });
  }

  async restart(id: string) {
    const old = await this.findOne(id);
    if (old.status !== ExamStatus.CLOSED) {
      throw new BadRequestException('Only closed exams can be restarted');
    }
    const now = new Date();
    const slug = `${this.slugify(old.title)}-${Date.now()}`;

    const newExam = await this.prisma.$transaction(async (tx) => {
      const created = await tx.exam.create({
        data: {
          courseId: old.courseId,
          createdById: old.createdById,
          title: old.title,
          slug,
          description: old.description,
          instructions: old.instructions,
          durationMinutes: old.durationMinutes,
          totalMarks: old.totalMarks,
          passingMarks: old.passingMarks,
          negativeMarkingRate: old.negativeMarkingRate,
          attemptsAllowed: old.attemptsAllowed,
          randomizeQuestions: old.randomizeQuestions,
          randomizeOptions: old.randomizeOptions,
          fullscreenRequired: old.fullscreenRequired,
          showResultImmediately: old.showResultImmediately,
          startsAt: now,
          endsAt: new Date(now.getTime() + old.durationMinutes * 60 * 1000),
          status: ExamStatus.PUBLISHED,
          questionBankId: old.questionBankId,
        },
      });

      if (old.courses && old.courses.length > 0) {
        await tx.examCourse.createMany({
          data: old.courses.map((ec) => ({ examId: created.id, courseId: ec.course.id })),
        });
      }

      if (old.questionBanks && old.questionBanks.length > 0) {
        await tx.examQuestionBank.createMany({
          data: old.questionBanks.map((qb) => ({ examId: created.id, questionBankId: qb.questionBank.id })),
        });
      }

      if (old.questions && old.questions.length > 0) {
        await tx.examQuestion.createMany({
          data: old.questions.map((eq, index) => ({
            examId: created.id,
            questionId: eq.questionId,
            points: eq.points,
            sortOrder: index,
          })),
        });
      }

      return created;
    });

    return this.findOne(newExam.id);
  }

  async assignStudents(examId: string, studentIds: string[]) {
    await this.findOne(examId);
    const existing = await this.prisma.examAssignment.findMany({
      where: { examId, studentId: { in: studentIds } },
      select: { studentId: true },
    });
    const existingIds = new Set(existing.map((a) => a.studentId));
    const newIds = studentIds.filter((id) => !existingIds.has(id));

    if (newIds.length > 0) {
      await this.prisma.examAssignment.createMany({
        data: newIds.map((studentId) => ({ examId, studentId })),
      });
    }

    return { assigned: newIds.length, alreadyAssigned: existing.length };
  }

  async unassignStudent(examId: string, studentId: string) {
    await this.prisma.examAssignment.deleteMany({
      where: { examId, studentId },
    });
    return { success: true };
  }

  async getAssignedStudents(examId: string) {
    const assignments = await this.prisma.examAssignment.findMany({
      where: { examId },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, email: true, status: true } },
      },
    });
    return assignments.map((a) => a.student);
  }

  private slugify(input: string) {
    return input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
}
