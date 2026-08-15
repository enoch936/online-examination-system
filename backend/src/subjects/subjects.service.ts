import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';

@Injectable()
export class SubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  findMany() {
    return this.prisma.subject.findMany({
      include: { _count: { select: { courses: true, questions: true } } },
      orderBy: { name: 'asc' },
    });
  }

  create(dto: CreateSubjectDto) {
    return this.prisma.subject.create({
      data: {
        code: dto.code.toUpperCase(),
        name: dto.name,
        description: dto.description,
      },
    });
  }

  async update(id: string, dto: UpdateSubjectDto) {
    const existing = await this.prisma.subject.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Subject not found');

    return this.prisma.subject.update({
      where: { id },
      data: {
        code: dto.code ? dto.code.toUpperCase() : undefined,
        name: dto.name,
        description: dto.description,
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.subject.findUnique({
      where: { id },
      include: { _count: { select: { courses: true, questions: true, questionBanks: true } } },
    });
    if (!existing) throw new NotFoundException('Subject not found');

    if (existing._count.courses > 0 || existing._count.questions > 0 || existing._count.questionBanks > 0) {
      throw new ConflictException(
        'Subject is in use and cannot be deleted. Remove its courses, questions, and question banks first.',
      );
    }

    await this.prisma.subject.delete({ where: { id } });
    return { id };
  }
}
