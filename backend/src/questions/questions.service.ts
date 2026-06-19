import { Injectable, NotFoundException } from '@nestjs/common';
import { Difficulty, QuestionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';

@Injectable()
export class QuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  findMany(filters?: { type?: QuestionType; difficulty?: Difficulty; subjectId?: string; search?: string }) {
    return this.prisma.question.findMany({
      where: {
        ...(filters?.type && { type: filters.type }),
        ...(filters?.difficulty && { difficulty: filters.difficulty }),
        ...(filters?.subjectId && { subjectId: filters.subjectId }),
        ...(filters?.search && { prompt: { contains: filters.search, mode: 'insensitive' } }),
      },
      include: { subject: true, options: { orderBy: { sortOrder: 'asc' } }, createdBy: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const question = await this.prisma.question.findUnique({
      where: { id },
      include: { subject: true, options: { orderBy: { sortOrder: 'asc' } }, createdBy: true },
    });
    if (!question) throw new NotFoundException('Question not found');
    return question;
  }

  create(dto: CreateQuestionDto, createdById: string) {
    return this.prisma.question.create({
      data: {
        subjectId: dto.subjectId,
        createdById,
        type: dto.type,
        difficulty: dto.difficulty,
        prompt: dto.prompt,
        explanation: dto.explanation,
        points: dto.points ?? 1,
        negativePoints: dto.negativePoints ?? 0,
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
      include: { options: true, subject: true },
    });
  }

  async update(id: string, dto: UpdateQuestionDto) {
    await this.findOne(id);

    const data: Record<string, unknown> = {};
    if (dto.subjectId !== undefined) data.subjectId = dto.subjectId;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.difficulty !== undefined) data.difficulty = dto.difficulty;
    if (dto.prompt !== undefined) data.prompt = dto.prompt;
    if (dto.explanation !== undefined) data.explanation = dto.explanation;
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
        include: { subject: true, options: { orderBy: { sortOrder: 'asc' } }, createdBy: true },
      });
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.question.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async bulkImport(questions: CreateQuestionDto[], createdById: string) {
    const created = [];
    for (const question of questions) {
      created.push(await this.create(question, createdById));
    }
    return { count: created.length, questions: created };
  }
}
