import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  findMany() {
    return this.prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { key: 'asc' }] });
  }

  upsert(key: string, label: string, module: string) {
    return this.prisma.permission.upsert({
      where: { key },
      update: { label, module },
      create: { key, label, module },
    });
  }
}
