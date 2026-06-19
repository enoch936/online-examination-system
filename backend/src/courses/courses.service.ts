import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';

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
}
