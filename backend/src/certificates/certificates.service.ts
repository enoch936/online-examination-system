import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RoleName } from '@prisma/client';
import { randomUUID } from 'crypto';
import { ExamAccessService } from '../common/exam-access.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';

type ListOptions = {
  examId?: string;
  page?: number;
  limit?: number;
};

const CERTIFICATE_INCLUDE: Prisma.CertificateInclude = {
  result: {
    include: {
      exam: { select: { id: true, title: true, totalMarks: true, passingMarks: true } },
      submission: {
        include: {
          session: {
            select: {
              student: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
          },
        },
      },
    },
  },
};

@Injectable()
export class CertificatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ExamAccessService,
  ) {}

  /**
   * Returns the OR clauses a user is confined to, or `null` when the user is
   * allowed to see every certificate (admins). An empty array means the user's
   * role grants no visibility at all, which must never fall through to "all".
   */
  private scopeClauses(user: AuthenticatedUser): Prisma.CertificateWhereInput[] | null {
    const isAdmin = user.roles.includes(RoleName.SUPER_ADMIN) || user.roles.includes(RoleName.ADMIN);
    if (isAdmin) return null;

    const isInstructor = user.roles.includes(RoleName.INSTRUCTOR);
    const isStudent = user.roles.includes(RoleName.STUDENT);

    const clauses: Prisma.CertificateWhereInput[] = [];
    if (isStudent) {
      clauses.push({ result: { studentId: user.sub, publishedAt: { not: null } } });
    }
    if (isInstructor) {
      clauses.push({
        result: {
          exam: { OR: [{ createdById: user.sub }, { shares: { some: { instructorId: user.sub } } }] },
        },
      });
    }
    return clauses;
  }

  private audit(actorId: string, action: string, entityId: string, before: unknown, after: unknown) {
    void this.prisma.auditLog
      .create({
        data: {
          actorId,
          action,
          entity: 'CERTIFICATE',
          entityId,
          before: JSON.stringify(before ?? null),
          after: JSON.stringify(after ?? null),
        },
      })
      .catch(() => undefined);
  }

  private create(resultId: string) {
    const suffix = `${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`;
    return this.prisma.certificate.create({
      data: {
        resultId,
        certificateNo: `OES-${suffix}`,
        verificationCode: randomUUID(),
      },
    });
  }

  async list(user: AuthenticatedUser, options: ListOptions = {}) {
    const page = Math.max(options.page ?? 1, 1);
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
    const skip = (page - 1) * limit;
    const scope = this.scopeClauses(user);

    if (scope !== null && scope.length === 0) {
      return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
    }

    const where: Prisma.CertificateWhereInput = {
      ...(scope ? { OR: scope } : {}),
      ...(options.examId ? { result: { examId: options.examId } } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.certificate.findMany({
        where,
        include: CERTIFICATE_INCLUDE,
        orderBy: { issuedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.certificate.count({ where }),
    ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async issue(resultId: string, user: AuthenticatedUser) {
    const result = await this.prisma.result.findUnique({
      where: { id: resultId },
      include: { certificate: true },
    });
    if (!result) {
      throw new NotFoundException('Result not found');
    }
    await this.access.assertCanManage(result.examId, user);
    if (!result.passed) {
      throw new BadRequestException('Certificate can only be issued for passed results');
    }
    if (result.certificate) {
      return result.certificate;
    }

    const certificate = await this.create(resultId);
    this.audit(
      user.sub,
      'CERTIFICATE_ISSUED',
      resultId,
      { resultId, passed: true },
      { id: certificate.id, certificateNo: certificate.certificateNo, verificationCode: certificate.verificationCode },
    );
    return certificate;
  }

  /**
   * Revoking removes the certificate so its verification code stops resolving.
   * A replacement can always be issued afterwards, which keeps the student-facing
   * list free of permanently invalidated records.
   */
  async revoke(id: string, user: AuthenticatedUser) {
    const certificate = await this.prisma.certificate.findUnique({
      where: { id },
      include: { result: { select: { id: true, examId: true, studentId: true } } },
    });
    if (!certificate) {
      throw new NotFoundException('Certificate not found');
    }
    await this.access.assertCanManage(certificate.result.examId, user);

    await this.prisma.certificate.delete({ where: { id } });
    this.audit(
      user.sub,
      'CERTIFICATE_REVOKED',
      certificate.resultId,
      { id: certificate.id, certificateNo: certificate.certificateNo, resultId: certificate.resultId },
      { revoked: true, studentId: certificate.result.studentId },
    );
    return { id, revoked: true as const };
  }

  async reissue(id: string, user: AuthenticatedUser) {
    const certificate = await this.prisma.certificate.findUnique({
      where: { id },
      include: { result: { select: { id: true, examId: true, passed: true } } },
    });
    if (!certificate) {
      throw new NotFoundException('Certificate not found');
    }
    await this.access.assertCanManage(certificate.result.examId, user);
    if (!certificate.result.passed) {
      throw new BadRequestException('Certificate can only be issued for passed results');
    }

    const [, next] = await this.prisma.$transaction([
      this.prisma.certificate.delete({ where: { id } }),
      this.create(certificate.resultId),
    ]);

    this.audit(
      user.sub,
      'CERTIFICATE_REISSUED',
      certificate.resultId,
      { id: certificate.id, certificateNo: certificate.certificateNo, verificationCode: certificate.verificationCode },
      { id: next.id, certificateNo: next.certificateNo, verificationCode: next.verificationCode },
    );
    return next;
  }

  verify(verificationCode: string) {
    return this.prisma.certificate.findUnique({
      where: { verificationCode },
      include: CERTIFICATE_INCLUDE,
    });
  }
}
