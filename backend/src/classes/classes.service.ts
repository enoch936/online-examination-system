import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RoleName } from '@prisma/client';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';

const ADMIN_ROLES = [RoleName.SUPER_ADMIN, RoleName.ADMIN];

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  private isAdmin(user: AuthenticatedUser) {
    return user.roles.some((role) => ADMIN_ROLES.some((admin) => admin === role));
  }

  private async assertManageAccess(classId: string, user: AuthenticatedUser) {
    const cls = await this.prisma.class.findUnique({
      where: { id: classId },
      select: { id: true, instructorId: true },
    });
    if (!cls) throw new NotFoundException('Class not found');
    if (!this.isAdmin(user) && cls.instructorId !== user.sub) {
      throw new ForbiddenException('You do not have access to this class');
    }
    return cls;
  }

  async findMany(user: AuthenticatedUser) {
    const where: Prisma.ClassWhereInput = {};
    if (!this.isAdmin(user)) {
      where.instructorId = user.sub;
    }

    const classes = await this.prisma.class.findMany({
      where,
      include: {
        instructor: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { enrollments: true, examClasses: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return classes.map((cls) => ({
      ...cls,
      studentCount: cls._count.enrollments,
      examCount: cls._count.examClasses,
      _count: undefined,
    }));
  }

  async findMyClasses(studentId: string) {
    const enrollments = await this.prisma.classEnrollment.findMany({
      where: { studentId },
      include: {
        class: {
          include: {
            instructor: { select: { id: true, firstName: true, lastName: true, email: true } },
            examClasses: {
              include: {
                exam: {
                  select: {
                    id: true,
                    title: true,
                    slug: true,
                    status: true,
                    durationMinutes: true,
                    totalMarks: true,
                    passingMarks: true,
                    startsAt: true,
                    endsAt: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { enrolledAt: 'desc' },
    });

    return enrollments.map((en) => ({
      id: en.class.id,
      name: en.class.name,
      code: en.class.code,
      description: en.class.description,
      instructor: en.class.instructor,
      enrolledAt: en.enrolledAt,
      exams: en.class.examClasses
        .map((eca) => eca.exam)
        .filter((exam) => exam.status === 'PUBLISHED' || exam.status === 'LIVE')
        .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()),
    }));
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const cls = await this.prisma.class.findUnique({
      where: { id },
      include: {
        instructor: { select: { id: true, firstName: true, lastName: true, email: true } },
        enrollments: {
          include: {
            student: {
              select: { id: true, firstName: true, lastName: true, email: true, status: true },
            },
          },
          orderBy: { enrolledAt: 'asc' },
        },
        _count: { select: { examClasses: true } },
      },
    });
    if (!cls) throw new NotFoundException('Class not found');
    if (!this.isAdmin(user) && cls.instructor.id !== user.sub) {
      throw new ForbiddenException('You do not have access to this class');
    }
    return {
      ...cls,
      students: cls.enrollments.map((en) => en.student),
      enrollments: undefined,
      examCount: cls._count.examClasses,
      _count: undefined,
    };
  }

  async create(dto: CreateClassDto) {
    const instructor = await this.prisma.user.findUnique({
      where: { id: dto.instructorId },
      include: { roles: { include: { role: true } } },
    });
    if (!instructor) throw new BadRequestException('Instructor not found');
    if (!instructor.roles.some((ur) => ur.role.name === RoleName.INSTRUCTOR)) {
      throw new BadRequestException('The assigned instructor must be an instructor account');
    }

    try {
      return await this.prisma.class.create({
        data: {
          instructorId: dto.instructorId,
          name: dto.name,
          code: dto.code.toUpperCase(),
          description: dto.description,
        },
        include: {
          instructor: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('A class with this code or name already exists');
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateClassDto, user: AuthenticatedUser) {
    const existing = await this.prisma.class.findUnique({
      where: { id },
      select: { id: true, instructorId: true, tenantId: true },
    });
    if (!existing) throw new NotFoundException('Class not found');
    if (!this.isAdmin(user) && existing.instructorId !== user.sub) {
      throw new ForbiddenException('You do not have access to this class');
    }

    if (dto.instructorId) {
      const instructor = await this.prisma.user.findUnique({
        where: { id: dto.instructorId },
        include: { roles: { include: { role: true } } },
      });
      if (!instructor) throw new BadRequestException('Instructor not found');
      if (!instructor.roles.some((ur) => ur.role.name === RoleName.INSTRUCTOR)) {
        throw new BadRequestException('The assigned instructor must be an instructor account');
      }
    }

    try {
      return await this.prisma.class.update({
        where: { id },
        data: {
          instructorId: dto.instructorId,
          name: dto.name,
          code: dto.code ? dto.code.toUpperCase() : undefined,
          description: dto.description,
        },
        include: {
          instructor: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('A class with this code or name already exists');
      }
      throw error;
    }
  }

  async remove(id: string, user: AuthenticatedUser) {
    const existing = await this.prisma.class.findUnique({
      where: { id },
      select: { id: true, instructorId: true, tenantId: true, _count: { select: { examClasses: true } } },
    });
    if (!existing) throw new NotFoundException('Class not found');
    if (!this.isAdmin(user) && existing.instructorId !== user.sub) {
      throw new ForbiddenException('You do not have access to this class');
    }
    if (existing._count.examClasses > 0) {
      throw new ConflictException('Class is assigned to exams and cannot be deleted. Unassign it first.');
    }
    await this.prisma.class.delete({ where: { id } });
    return { id };
  }

  async enrollStudents(id: string, studentIds: string[], user: AuthenticatedUser) {
    await this.assertManageAccess(id, user);

    const students = await this.prisma.user.findMany({
      where: {
        id: { in: studentIds },
        roles: { some: { role: { name: RoleName.STUDENT } } },
      },
      select: { id: true },
    });

    const existing = await this.prisma.classEnrollment.findMany({
      where: { classId: id, studentId: { in: studentIds } },
      select: { studentId: true },
    });

    const existingIds = new Set(existing.map((e) => e.studentId));
    const enrolledStudentIds = students.map((s) => s.id);
    const newIds = enrolledStudentIds.filter((sid) => !existingIds.has(sid));

    if (newIds.length > 0) {
      await this.prisma.classEnrollment.createMany({
        data: newIds.map((studentId) => ({ classId: id, studentId })),
      });
    }

    return {
      enrolled: newIds.length,
      alreadyEnrolled: existingIds.size,
      invalid: studentIds.length - enrolledStudentIds.length,
    };
  }

  async unenrollStudent(id: string, studentId: string, user: AuthenticatedUser) {
    await this.assertManageAccess(id, user);

    const existing = await this.prisma.classEnrollment.findMany({
      where: { classId: id, studentId },
    });
    if (existing.length === 0) throw new NotFoundException('Student is not enrolled in this class');
    await this.prisma.classEnrollment.deleteMany({ where: { classId: id, studentId } });
    return { success: true };
  }
}