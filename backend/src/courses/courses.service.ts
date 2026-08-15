import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  findMany() {
    return this.prisma.course.findMany({
      include: { subject: true, _count: { select: { exams: true } } },
      orderBy: { name: 'asc' },
    });
  }

  create(dto: CreateCourseDto) {
    return this.prisma.course.create({
      data: {
        subjectId: dto.subjectId,
        code: dto.code.toUpperCase(),
        name: dto.name,
        description: dto.description,
      },
    });
  }

  async update(id: string, dto: UpdateCourseDto) {
    const existing = await this.prisma.course.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Course not found');

    return this.prisma.course.update({
      where: { id },
      data: {
        subjectId: dto.subjectId,
        code: dto.code ? dto.code.toUpperCase() : undefined,
        name: dto.name,
        description: dto.description,
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.course.findUnique({
      where: { id },
      include: { _count: { select: { exams: true, questionBanks: true, examCourses: true } } },
    });
    if (!existing) throw new NotFoundException('Course not found');

    if (existing._count.exams > 0 || existing._count.questionBanks > 0 || existing._count.examCourses > 0) {
      throw new ConflictException(
        'Course is in use and cannot be deleted. Remove its exams and question banks first.',
      );
    }

    await this.prisma.course.delete({ where: { id } });
    return { id };
  }
}
