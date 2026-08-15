import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { RoleName, UserStatus } from '@prisma/client';
import { AuditService } from '../common/audit.service';
import { PrismaService } from '../prisma/prisma.service';

const VALID_STATUSES: UserStatus[] = ['ACTIVE', 'SUSPENDED', 'DEACTIVATED', 'PENDING_VERIFICATION'];

export interface InstructorListQuery {
  search?: string;
  status?: string;
}

export interface InstructorAuditQuery {
  action?: string;
  entity?: string;
  entityId?: string;
  from?: string;
  to?: string;
  examId?: string;
  questionBankId?: string;
  courseId?: string;
  categoryId?: string;
}

@Injectable()
export class InstructorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private whereClause(query: InstructorListQuery) {
    return {
      roles: { some: { role: { name: RoleName.INSTRUCTOR } } },
      ...(query.status ? { status: query.status as UserStatus } : {}),
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' as const } },
              { lastName: { contains: query.search, mode: 'insensitive' as const } },
              { email: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
  }

  async list(query: InstructorListQuery = {}) {
    const users = await this.prisma.user.findMany({
      where: this.whereClause(query),
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        status: true,
        avatarUrl: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    const ids = users.map((u) => u.id);
    if (ids.length === 0) return [];

    const [examCounts, bankCounts, examCourses, bankCourses, assignments] = await Promise.all([
      this.prisma.exam.groupBy({ by: ['createdById'], where: { createdById: { in: ids } }, _count: { _all: true } }),
      this.prisma.questionBank.groupBy({ by: ['createdById'], where: { createdById: { in: ids } }, _count: { _all: true } }),
      this.prisma.exam.findMany({
        where: { createdById: { in: ids } },
        select: { createdById: true, courseId: true, courses: { select: { courseId: true } } },
      }),
      this.prisma.questionBank.findMany({
        where: { createdById: { in: ids } },
        select: { createdById: true, courseId: true },
      }),
      this.prisma.examAssignment.findMany({
        where: { exam: { createdById: { in: ids } } },
        select: { studentId: true, exam: { select: { createdById: true } } },
      }),
    ]);

    const examCountMap = new Map(examCounts.map((e) => [e.createdById, e._count._all]));
    const bankCountMap = new Map(bankCounts.map((b) => [b.createdById, b._count._all]));

    const courseSets = new Map<string, Set<string>>(ids.map((id) => [id, new Set<string>()]));
    for (const exam of examCourses) {
      const set = courseSets.get(exam.createdById);
      if (!set) continue;
      set.add(exam.courseId);
      for (const c of exam.courses) set.add(c.courseId);
    }
    for (const bank of bankCourses) {
      courseSets.get(bank.createdById)?.add(bank.courseId);
    }

    const studentSets = new Map<string, Set<string>>(ids.map((id) => [id, new Set<string>()]));
    for (const a of assignments) {
      studentSets.get(a.exam.createdById)?.add(a.studentId);
    }

    return users.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      status: u.status,
      avatarUrl: u.avatarUrl,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
      courses: courseSets.get(u.id)?.size ?? 0,
      exams: examCountMap.get(u.id) ?? 0,
      questionBanks: bankCountMap.get(u.id) ?? 0,
      students: studentSets.get(u.id)?.size ?? 0,
    }));
  }

  private async assertInstructor(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, roles: { select: { role: { select: { name: true } } } } },
    });
    if (!user) throw new NotFoundException('Instructor not found');
    const isInstructor = user.roles.some((r) => r.role.name === RoleName.INSTRUCTOR);
    if (!isInstructor) throw new BadRequestException('Only instructor accounts can be managed here');
    return user;
  }

  async detail(id: string) {
    await this.assertInstructor(id);

    const [profile, exams, banks, questions, assignments, liveSessions, sharedExams] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          avatarUrl: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
          roles: { select: { role: { select: { name: true } } } },
        },
      }),
      this.prisma.exam.findMany({
        where: { createdById: id },
        orderBy: { createdAt: 'desc' },
        include: {
          course: { select: { id: true, name: true } },
          courses: { include: { course: { select: { id: true, name: true } } } },
          _count: { select: { sessions: true, assignments: true } },
          shares: { include: { instructor: { select: { id: true, firstName: true, lastName: true, email: true } } } },
        },
      }),
      this.prisma.questionBank.findMany({
        where: { createdById: id },
        orderBy: { createdAt: 'desc' },
        include: { course: { select: { id: true, name: true } }, _count: { select: { questions: true } } },
      }),
      this.prisma.question.count({ where: { createdById: id } }),
      this.prisma.examAssignment.findMany({
        where: { exam: { createdById: id } },
        select: { student: { select: { id: true, firstName: true, lastName: true, email: true } } },
        distinct: ['studentId'],
        take: 200,
      }),
      this.prisma.examSession.findMany({
        where: { exam: { createdById: id }, status: { in: ['IN_PROGRESS', 'PAUSED'] } },
        orderBy: { lastActivityAt: 'desc' },
        take: 50,
        include: {
          exam: { select: { id: true, title: true, status: true } },
          student: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      this.prisma.examShare.findMany({
        where: { instructorId: id },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          exam: {
            select: {
              id: true,
              title: true,
              status: true,
              createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
          },
        },
      }),
    ]);

    const courseMap = new Map<string, { id: string; name: string; examCount: number }>();
    const addCourse = (course: { id: string; name: string }) => {
      const existing = courseMap.get(course.id);
      if (existing) existing.examCount += 1;
      else courseMap.set(course.id, { ...course, examCount: 1 });
    };
    for (const exam of exams) {
      addCourse(exam.course);
      for (const c of exam.courses) addCourse(c.course);
    }

    return {
      profile: {
        id: profile!.id,
        firstName: profile!.firstName,
        lastName: profile!.lastName,
        email: profile!.email,
        phone: profile!.phone,
        avatarUrl: profile!.avatarUrl,
        status: profile!.status,
        lastLoginAt: profile!.lastLoginAt,
        createdAt: profile!.createdAt,
        roles: profile!.roles.map((r) => r.role.name),
      },
      stats: {
        exams: exams.length,
        questionBanks: banks.length,
        questions,
        courses: courseMap.size,
        students: assignments.length,
        liveSessions: liveSessions.length,
      },
      courses: [...courseMap.values()],
      exams: exams.map((e) => ({
        id: e.id,
        title: e.title,
        status: e.status,
        course: e.course?.name ?? e.courses.map((c) => c.course.name).join(', '),
        sessions: e._count.sessions,
        assignments: e._count.assignments,
        isLive: e.status === 'LIVE' || e.status === 'PUBLISHED',
        shares: e.shares.map((s) => ({
          id: s.instructor.id,
          firstName: s.instructor.firstName,
          lastName: s.instructor.lastName,
          email: s.instructor.email,
          permissionLevel: s.permissionLevel,
        })),
      })),
      questionBanks: banks.map((b) => ({
        id: b.id,
        name: b.name,
        status: b.status,
        course: b.course?.name ?? null,
        questions: b._count.questions,
      })),
      students: assignments.map((a) => a.student),
      sharedExams: sharedExams.map((s) => ({
        examId: s.exam.id,
        title: s.exam.title,
        status: s.exam.status,
        owner: s.exam.createdBy,
        permissionLevel: s.permissionLevel,
      })),
      liveSessions: liveSessions.map((s) => ({
        sessionId: s.id,
        examId: s.exam.id,
        examTitle: s.exam.title,
        studentId: s.student.id,
        studentName: `${s.student.firstName} ${s.student.lastName}`,
        status: s.status,
        riskLevel: s.riskLevel,
        lastActivityAt: s.lastActivityAt,
      })),
    };
  }

  async updateStatus(actorId: string, id: string, status: string) {
    const user = await this.assertInstructor(id);
    if (user.roles.some((r) => r.role.name === RoleName.SUPER_ADMIN)) {
      throw new ForbiddenException('Super admin accounts cannot be managed here');
    }
    if (!VALID_STATUSES.includes(status as UserStatus)) {
      throw new BadRequestException(`status must be one of ${VALID_STATUSES.join(', ')}`);
    }

    const current = await this.prisma.user.findUnique({
      where: { id },
      select: { status: true },
    });

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status: status as UserStatus },
      select: { id: true, status: true },
    });

    await this.audit.log(actorId, 'USER', id, 'INSTRUCTOR_STATUS_CHANGED', {
      before: current?.status,
      after: updated.status,
    });

    return updated;
  }

  async auditLogs(id: string, query: InstructorAuditQuery = {}) {
    await this.assertInstructor(id);

    const where: {
      actorId: string;
      action?: string;
      entity?: string;
      entityId?: string | { in: string[] };
      createdAt?: { gte?: Date; lte?: Date };
    } = { actorId: id };

    if (query.action) where.action = query.action;
    if (query.entity) where.entity = query.entity;

    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999Z`) } : {}),
      };
    }

    if (query.examId) {
      where.entity = 'EXAM';
      where.entityId = query.examId;
    } else if (query.questionBankId) {
      where.entity = 'QUESTION_BANK';
      where.entityId = query.questionBankId;
    } else if (query.courseId || query.categoryId) {
      const conditions: object[] = [];
      if (query.courseId) conditions.push({ courseId: query.courseId });
      if (query.categoryId) conditions.push({ course: { subjectId: query.categoryId } });
      const exams = await this.prisma.exam.findMany({
        where: { OR: conditions },
        select: { id: true },
      });
      where.entity = 'EXAM';
      where.entityId = { in: exams.map((e) => e.id) };
    }

    return this.prisma.auditLog.findMany({
      where,
      include: { actor: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async sessions(id: string) {
    await this.assertInstructor(id);
    return this.prisma.examSession.findMany({
      where: { exam: { createdById: id }, status: { in: ['IN_PROGRESS', 'PAUSED'] } },
      orderBy: { lastActivityAt: 'desc' },
      take: 100,
      include: {
        exam: { select: { id: true, title: true, status: true } },
        student: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }
}
