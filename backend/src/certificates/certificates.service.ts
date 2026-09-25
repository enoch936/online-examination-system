import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ExamAccessService } from '../common/exam-access.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CertificatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ExamAccessService,
  ) {}

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

    const suffix = Date.now().toString(36).toUpperCase();
    return this.prisma.certificate.create({
      data: {
        resultId,
        certificateNo: `OES-${suffix}`,
        verificationCode: randomUUID(),
      },
    });
  }

  verify(verificationCode: string) {
    return this.prisma.certificate.findUnique({
      where: { verificationCode },
      include: { result: { include: { exam: true } } },
    });
  }
}
