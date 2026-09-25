import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Difficulty, QuestionBankStatus, QuestionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuestionDto } from '../questions/dto/create-question.dto';
import { CreateQuestionBankDto } from './dto/create-question-bank.dto';
import { BankImportQuestionDto } from './dto/import-questions.dto';
import { UpdateQuestionBankDto } from './dto/update-question-bank.dto';

@Injectable()
export class QuestionBanksService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly bankInclude = {
    course: { include: { subject: true } },
    category: true,
    createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
    _count: { select: { questions: true } },
  } as const;

  findMany(filters?: {
    search?: string;
    courseId?: string;
    categoryId?: string;
    status?: QuestionBankStatus;
    difficulty?: Difficulty;
  }) {
    return this.prisma.questionBank.findMany({
      where: {
        ...(filters?.courseId && { courseId: filters.courseId }),
        ...(filters?.categoryId && { categoryId: filters.categoryId }),
        ...(filters?.status && { status: filters.status }),
        ...(filters?.difficulty && { difficulty: filters.difficulty }),
        ...(filters?.search && { name: { contains: filters.search, mode: 'insensitive' } }),
      },
      include: this.bankInclude,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const bank = await this.prisma.questionBank.findUnique({
      where: { id },
      include: this.bankInclude,
    });
    if (!bank) throw new NotFoundException('Question bank not found');
    return bank;
  }

  async create(dto: CreateQuestionBankDto, createdById: string) {
    await this.assertCourseCategoryMatch(dto.courseId, dto.categoryId);
    return this.prisma.questionBank.create({
      data: {
        courseId: dto.courseId,
        categoryId: dto.categoryId,
        createdById,
        name: dto.name,
        description: dto.description,
        difficulty: dto.difficulty,
        status: dto.status ?? QuestionBankStatus.DRAFT,
      },
      include: this.bankInclude,
    });
  }

  async update(id: string, dto: UpdateQuestionBankDto) {
    await this.findOne(id);
    if (dto.courseId !== undefined && dto.categoryId !== undefined) {
      await this.assertCourseCategoryMatch(dto.courseId, dto.categoryId);
    }
    const data: Record<string, unknown> = {};
    if (dto.courseId !== undefined) data.courseId = dto.courseId;
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId;
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.difficulty !== undefined) data.difficulty = dto.difficulty;
    if (dto.status !== undefined) data.status = dto.status;

    return this.prisma.questionBank.update({
      where: { id },
      data,
      include: this.bankInclude,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.questionBank.delete({ where: { id } });
    return { success: true };
  }

  async duplicate(id: string, createdById: string) {
    const bank = await this.findOne(id);
    const questions = await this.prisma.question.findMany({
      where: { questionBankId: id },
      include: { options: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    });

    return this.prisma.questionBank.create({
      data: {
        courseId: bank.courseId,
        categoryId: bank.categoryId,
        createdById,
        name: `${bank.name} (Copy)`,
        description: bank.description,
        difficulty: bank.difficulty,
        status: QuestionBankStatus.DRAFT,
        questions: {
          create: questions.map((q) => ({
            subjectId: q.subjectId,
            createdById: q.createdById,
            type: q.type,
            difficulty: q.difficulty,
            prompt: q.prompt,
            explanation: q.explanation,
            points: q.points,
            negativePoints: q.negativePoints,
            tags: q.tags,
            topic: q.topic,
            imageUrl: q.imageUrl,
            sortOrder: q.sortOrder,
            isActive: q.isActive,
            options: {
              create: q.options.map((opt) => ({
                label: opt.label,
                text: opt.text,
                isCorrect: opt.isCorrect,
                sortOrder: opt.sortOrder,
              })),
            },
          })),
        },
      },
      include: this.bankInclude,
    });
  }

  async getQuestions(
    id: string,
    filters?: { search?: string; type?: QuestionType; difficulty?: Difficulty; topic?: string },
  ) {
    await this.findOne(id);
    const where = {
      questionBankId: id,
      ...(filters?.type && { type: filters.type }),
      ...(filters?.difficulty && { difficulty: filters.difficulty }),
      ...(filters?.topic && { topic: filters.topic }),
      ...(filters?.search && { prompt: { contains: filters.search, mode: 'insensitive' as const } }),
    };

    const [questions, total, topicRows] = await Promise.all([
      this.prisma.question.findMany({
        where,
        include: { subject: true, options: { orderBy: { sortOrder: 'asc' } }, createdBy: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.question.count({ where }),
      this.prisma.question.findMany({
        where: { questionBankId: id, topic: { not: null } },
        select: { topic: true },
        distinct: ['topic'],
      }),
    ]);

    return {
      questions,
      total,
      topics: topicRows.map((t) => t.topic).filter((t): t is string => !!t),
    };
  }

  async duplicateQuestion(id: string, questionId: string) {
    const bank = await this.findOne(id);
    const question = await this.prisma.question.findFirst({
      where: { id: questionId, questionBankId: id },
      include: { options: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!question) throw new NotFoundException('Question not found in this bank');
    const sortOrder = await this.nextSortOrder(id);

    return this.prisma.question.create({
      data: {
        subjectId: question.subjectId,
        questionBankId: id,
        createdById: question.createdById,
        type: question.type,
        difficulty: question.difficulty,
        prompt: `${question.prompt} (Copy)`,
        explanation: question.explanation,
        points: question.points,
        negativePoints: question.negativePoints,
        tags: question.tags,
        topic: question.topic,
        imageUrl: question.imageUrl,
        sortOrder,
        isActive: question.isActive,
        options: {
          create: question.options.map((opt) => ({
            label: opt.label,
            text: opt.text,
            isCorrect: opt.isCorrect,
            sortOrder: opt.sortOrder,
          })),
        },
      },
      include: { options: true, subject: true },
    });
  }

  async bulkDeleteQuestions(id: string, ids: string[]) {
    await this.findOne(id);
    const result = await this.prisma.question.updateMany({
      where: { id: { in: ids }, questionBankId: id },
      data: { isActive: false },
    });
    return { deleted: result.count };
  }

  async reorderQuestions(id: string, questionIds: string[]) {
    await this.findOne(id);
    await this.prisma.$transaction(
      questionIds.map((questionId, index) =>
        this.prisma.question.updateMany({
          where: { id: questionId, questionBankId: id },
          data: { sortOrder: index },
        }),
      ),
    );
    return { success: true };
  }

  async importQuestions(id: string, questions: BankImportQuestionDto[], createdById: string) {
    const bank = await this.findOne(id);
    let sortOrder = await this.nextSortOrder(id);
    const created = await this.prisma.$transaction(
      questions.map((q) =>
        this.prisma.question.create({
          data: {
            subjectId: bank.categoryId,
            questionBankId: id,
            createdById,
            type: q.type,
            difficulty: q.difficulty ?? Difficulty.MEDIUM,
            prompt: q.prompt,
            explanation: q.explanation,
            topic: q.topic,
            imageUrl: q.imageUrl,
            points: q.points ?? 1,
            negativePoints: q.negativePoints ?? 0,
            sortOrder: sortOrder++,
            tags: JSON.stringify(q.tags ?? []),
            options: {
              create: q.options?.map((option, index) => ({
                label: option.label,
                text: option.text,
                isCorrect: option.isCorrect,
                sortOrder: option.sortOrder ?? index,
              })),
            },
          },
        }),
      ),
    );
    return { count: created.length, questions: created };
  }

  async exportQuestions(id: string) {
    const bank = await this.findOne(id);
    const questions = await this.prisma.question.findMany({
      where: { questionBankId: id },
      include: { options: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    });
    return {
      bank: { id: bank.id, name: bank.name, courseId: bank.courseId, categoryId: bank.categoryId },
      questions: questions.map((q) => ({
        subjectId: q.subjectId,
        type: q.type,
        difficulty: q.difficulty,
        prompt: q.prompt,
        explanation: q.explanation,
        topic: q.topic,
        imageUrl: q.imageUrl,
        points: q.points,
        negativePoints: q.negativePoints,
        tags: q.tags,
        options: q.options.map((opt) => ({
          label: opt.label,
          text: opt.text,
          isCorrect: opt.isCorrect,
          sortOrder: opt.sortOrder,
        })),
      })),
    };
  }

  private async assertCourseCategoryMatch(courseId: string, categoryId: string) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId }, select: { subjectId: true } });
    if (!course) throw new NotFoundException('Course not found');
    if (course.subjectId !== categoryId) {
      throw new BadRequestException('Category must match the subject of the selected course');
    }
  }

  private async nextSortOrder(questionBankId: string) {
    const max = await this.prisma.question.aggregate({
      where: { questionBankId },
      _max: { sortOrder: true },
    });
    return (max._max.sortOrder ?? -1) + 1;
  }
}
