import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Difficulty, QuestionType, RoleName } from '@prisma/client';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 500;
const AUTHOR_SELECT = { id: true, firstName: true, lastName: true, email: true };

@Injectable()
export class QuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  private isAdmin(user: AuthenticatedUser): boolean {
    return user.roles.includes(RoleName.SUPER_ADMIN) || user.roles.includes(RoleName.ADMIN);
  }

  private async assertCanMutateQuestion(user: AuthenticatedUser, questionId: string) {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      select: { id: true, createdById: true },
    });
    if (!question) throw new NotFoundException('Question not found');
    if (!this.isAdmin(user) && question.createdById !== user.sub) {
      throw new ForbiddenException('You can only modify questions you created');
    }
  }

  private async assertCanUseBank(user: AuthenticatedUser, questionBankId?: string) {
    if (!questionBankId || this.isAdmin(user)) return;
    const bank = await this.prisma.questionBank.findUnique({
      where: { id: questionBankId },
      select: { id: true, createdById: true },
    });
    if (!bank) throw new NotFoundException('Question bank not found');
    if (bank.createdById !== user.sub) {
      throw new ForbiddenException('You can only add questions to banks you created');
    }
  }

  findMany(filters?: {
    type?: QuestionType; difficulty?: Difficulty; subjectId?: string; questionBankId?: string;
    topic?: string; search?: string; skip?: number; take?: number;
  }) {
    const take = Math.min(filters?.take ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const skip = Math.max(filters?.skip ?? 0, 0);
    return this.prisma.question.findMany({
      where: {
        ...(filters?.type && { type: filters.type }),
        ...(filters?.difficulty && { difficulty: filters.difficulty }),
        ...(filters?.subjectId && { subjectId: filters.subjectId }),
        ...(filters?.questionBankId && { questionBankId: filters.questionBankId }),
        ...(filters?.topic && { topic: filters.topic }),
        ...(filters?.search && { prompt: { contains: filters.search, mode: 'insensitive' } }),
      },
      include: { subject: true, questionBank: { select: { id: true, name: true } }, options: { orderBy: { sortOrder: 'asc' } }, createdBy: { select: AUTHOR_SELECT } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      skip,
      take,
    });
  }

  count(filters?: {
    type?: QuestionType; difficulty?: Difficulty; subjectId?: string; questionBankId?: string;
    topic?: string; search?: string;
  }) {
    return this.prisma.question.count({
      where: {
        ...(filters?.type && { type: filters.type }),
        ...(filters?.difficulty && { difficulty: filters.difficulty }),
        ...(filters?.subjectId && { subjectId: filters.subjectId }),
        ...(filters?.questionBankId && { questionBankId: filters.questionBankId }),
        ...(filters?.topic && { topic: filters.topic }),
        ...(filters?.search && { prompt: { contains: filters.search, mode: 'insensitive' } }),
      },
    });
  }

  async findOne(id: string) {
    const question = await this.prisma.question.findUnique({
      where: { id },
      include: { subject: true, questionBank: { select: { id: true, name: true } }, options: { orderBy: { sortOrder: 'asc' } }, createdBy: { select: AUTHOR_SELECT } },
    });
    if (!question) throw new NotFoundException('Question not found');
    return question;
  }

  async create(dto: CreateQuestionDto, createdById: string, user: AuthenticatedUser) {
    await this.assertCanUseBank(user, dto.questionBankId);
    const sortOrder = dto.questionBankId
      ? (await this.nextSortOrder(dto.questionBankId))
      : 0;
    return this.prisma.question.create({
      data: {
        subjectId: dto.subjectId,
        questionBankId: dto.questionBankId,
        createdById,
        type: dto.type,
        difficulty: dto.difficulty,
        prompt: dto.prompt,
        explanation: dto.explanation,
        topic: dto.topic,
        imageUrl: dto.imageUrl,
        points: dto.points ?? 1,
        negativePoints: dto.negativePoints ?? 0,
        sortOrder,
        tags: JSON.stringify(dto.tags ?? []),
        options: {
          create: dto.options?.map((option, index) => ({
            label: option.label,
            text: option.text,
            isCorrect: option.isCorrect,
            sortOrder: option.sortOrder ?? index,
          })),
        },
      },
      include: { options: true, subject: true, questionBank: { select: { id: true, name: true } } },
    });
  }

  async update(id: string, dto: UpdateQuestionDto, user: AuthenticatedUser) {
    await this.assertCanMutateQuestion(user, id);

    const data: Record<string, unknown> = {};
    if (dto.subjectId !== undefined) data.subjectId = dto.subjectId;
    if (dto.questionBankId !== undefined) data.questionBankId = dto.questionBankId;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.difficulty !== undefined) data.difficulty = dto.difficulty;
    if (dto.prompt !== undefined) data.prompt = dto.prompt;
    if (dto.explanation !== undefined) data.explanation = dto.explanation;
    if (dto.topic !== undefined) data.topic = dto.topic;
    if (dto.imageUrl !== undefined) data.imageUrl = dto.imageUrl;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.points !== undefined) data.points = dto.points;
    if (dto.negativePoints !== undefined) data.negativePoints = dto.negativePoints;
    if (dto.tags !== undefined) data.tags = JSON.stringify(dto.tags);

    return this.prisma.$transaction(async (tx) => {
      if (dto.options) {
        await tx.questionOption.deleteMany({ where: { questionId: id } });
        await tx.questionOption.createMany({
          data: dto.options!.map((opt, index) => ({
            questionId: id,
            label: opt.label ?? String.fromCharCode(65 + index),
            text: opt.text ?? '',
            isCorrect: opt.isCorrect ?? false,
            sortOrder: opt.sortOrder ?? index,
          })),
        });
      }

      return tx.question.update({
        where: { id },
        data,
        include: { subject: true, questionBank: { select: { id: true, name: true } }, options: { orderBy: { sortOrder: 'asc' } }, createdBy: true },
      });
    });
  }

  private async nextSortOrder(questionBankId: string) {
    const max = await this.prisma.question.aggregate({
      where: { questionBankId },
      _max: { sortOrder: true },
    });
    return (max._max.sortOrder ?? -1) + 1;
  }

  async remove(id: string, user: AuthenticatedUser) {
    await this.assertCanMutateQuestion(user, id);
    return this.prisma.question.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async bulkImport(questions: CreateQuestionDto[], user: AuthenticatedUser) {
    const created = await Promise.all(questions.map((q) => this.create(q, user.sub, user)));
    return { count: created.length, questions: created };
  }
}
