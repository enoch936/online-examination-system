import { Injectable, NotFoundException } from '@nestjs/common';
import { Difficulty, QuestionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';

@Injectable()
export class QuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  findMany(filters?: {
    type?: QuestionType; difficulty?: Difficulty; subjectId?: string; questionBankId?: string;
    topic?: string; search?: string; skip?: number; take?: number;
  }) {
    return this.prisma.question.findMany({
      where: {
        ...(filters?.type && { type: filters.type }),
        ...(filters?.difficulty && { difficulty: filters.difficulty }),
        ...(filters?.subjectId && { subjectId: filters.subjectId }),
        ...(filters?.questionBankId && { questionBankId: filters.questionBankId }),
        ...(filters?.topic && { topic: filters.topic }),
        ...(filters?.search && { prompt: { contains: filters.search, mode: 'insensitive' } }),
      },
      include: { subject: true, questionBank: { select: { id: true, name: true } }, options: { orderBy: { sortOrder: 'asc' } }, createdBy: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      ...(filters?.take !== undefined ? { skip: filters.skip ?? 0, take: filters.take } : {}),
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
      include: { subject: true, questionBank: { select: { id: true, name: true } }, options: { orderBy: { sortOrder: 'asc' } }, createdBy: true },
    });
    if (!question) throw new NotFoundException('Question not found');
    return question;
  }

  async create(dto: CreateQuestionDto, createdById: string) {
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

  async update(id: string, dto: UpdateQuestionDto) {
    await this.findOne(id);

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

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.question.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async bulkImport(questions: CreateQuestionDto[], createdById: string) {
    const created = await Promise.all(questions.map((q) => this.create(q, createdById)));
    return { count: created.length, questions: created };
  }
}
