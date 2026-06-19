import { Injectable, NotFoundException } from '@nestjs/common';
import { ExamStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExamDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';

@Injectable()
export class ExamsService {
  constructor(private readonly prisma: PrismaService) {}

  findMany() {
    return this.prisma.exam.findMany({
      include: {
        course: { include: { subject: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { questions: true, sessions: true, assignments: true } },
      },
      orderBy: { startsAt: 'desc' },
    });
  }

  async findAvailable(studentId: string) {
    const now = new Date();
    const exams = await this.prisma.exam.findMany({
      where: {
        status: { in: [ExamStatus.PUBLISHED, ExamStatus.LIVE] },
        startsAt: { lte: now },
        endsAt: { gte: now },
        assignments: { some: { studentId } },
      },
      include: {
        course: { include: { subject: true } },
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
        questions: {
          orderBy: { sortOrder: 'asc' },
          include: { question: { include: { options: { orderBy: { sortOrder: 'asc' } } } } },
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

  async create(dto: CreateExamDto, createdById: string) {
    const slug = `${this.slugify(dto.title)}-${Date.now()}`;
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
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        status: ExamStatus.SCHEDULED,
        questions: {
          create: dto.questionIds?.map((questionId, index) => ({
            questionId,
            points: 1,
            sortOrder: index,
          })),
        },
      },
      include: { questions: true },
    });
  }

  async update(id: string, dto: UpdateExamDto) {
    await this.findOne(id);
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
    if (dto.negativeMarkingRate !== undefined) data.negativeMarkingRate = dto.negativeMarkingRate;
    if (dto.startsAt !== undefined) data.startsAt = new Date(dto.startsAt);
    if (dto.endsAt !== undefined) data.endsAt = new Date(dto.endsAt);
    if (dto.title !== undefined) data.slug = `${this.slugify(dto.title)}-${Date.now()}`;

    return this.prisma.$transaction(async (tx) => {
      if (dto.questionIds) {
        await tx.examQuestion.deleteMany({ where: { examId: id } });
        await tx.examQuestion.createMany({
          data: dto.questionIds!.map((questionId, index) => ({
            examId: id,
            questionId,
            points: 1,
            sortOrder: index,
          })),
        });
      }

      return tx.exam.update({
        where: { id },
        data,
        include: {
          course: { include: { subject: true } },
          questions: {
            orderBy: { sortOrder: 'asc' },
            include: { question: { include: { options: { orderBy: { sortOrder: 'asc' } } } } },
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
