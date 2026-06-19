import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubjectDto } from './dto/create-subject.dto';

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
}
