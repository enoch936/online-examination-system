import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(actorId: string, entity: string, entityId: string, action: string, metadata?: { before?: string; after?: string }) {
    return this.prisma.auditLog.create({
      data: {
        actorId,
        entity,
        entityId,
        action,
        before: metadata?.before,
        after: metadata?.after,
      },
    });
  }

  async listForExam(examId: string, limit = 50) {
    return this.prisma.auditLog.findMany({
      where: { entity: 'EXAM', entityId: examId },
      include: { actor: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
