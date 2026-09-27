import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RoleName } from '@prisma/client';
import { randomUUID } from 'crypto';
import PDFDocument from 'pdfkit';
import { ExamAccessService } from '../common/exam-access.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
import {
  CERTIFICATE_INELIGIBILITY_MESSAGES,
  CertificateEligibility,
  certificateExpiry,
  evaluateCertificateEligibility,
} from './certificate-eligibility.util';

type ListOptions = {
  examId?: string;
  page?: number;
  limit?: number;
};

/** Bounded so a 5,000-student cohort cannot open 5,000 connections at once. */
const GENERATE_BATCH_SIZE = 100;

/**
 * `satisfies` (rather than a `: Prisma.CertificateInclude` annotation) keeps the
 * literal shape so `findUnique`/`findFirst` can infer the full payload. The plain
 * annotation erased the relation types and broke the PDF builder.
 */
const CERTIFICATE_INCLUDE = {
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
} as const satisfies Prisma.CertificateInclude;

/** Exam columns needed to evaluate certificate eligibility. */
const ELIGIBILITY_EXAM_SELECT = {
  id: true,
  title: true,
  totalMarks: true,
  passingMarks: true,
  certificateEnabled: true,
  certificateMinPercentage: true,
  certificateValidityDays: true,
  certificateAutoIssue: true,
} as const;

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

  private create(resultId: string, validityDays?: number | null, tx: Prisma.TransactionClient = this.prisma) {
    const suffix = `${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`;
    return tx.certificate.create({
      data: {
        resultId,
        certificateNo: `OES-${suffix}`,
        verificationCode: randomUUID(),
        expiresAt: certificateExpiry(validityDays),
      },
    });
  }

  /**
   * The one place eligibility is decided for a single result. `forUnattended`
   * is true for bulk generate / auto-issue, which additionally require the exam
   * to have opted in.
   */
  private eligibilityFor(
    result: {
      passed: boolean;
      percentage: unknown;
      publishedAt: Date | null;
      exam: {
        certificateEnabled: boolean;
        certificateMinPercentage: unknown;
      };
    },
    forUnattended: boolean,
  ): CertificateEligibility {
    return evaluateCertificateEligibility(
      {
        passed: result.passed,
        percentage: Number(result.percentage),
        minPercentage: result.exam.certificateMinPercentage as number | null,
        enabled: result.exam.certificateEnabled,
        requirePublished: forUnattended,
        publishedAt: result.publishedAt,
      },
      forUnattended,
    );
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
      include: { certificate: true, exam: { select: ELIGIBILITY_EXAM_SELECT } },
    });
    if (!result) {
      throw new NotFoundException('Result not found');
    }
    await this.access.assertCanManage(result.examId, user);

    const eligibility = this.eligibilityFor(result, false);
    if (!eligibility.eligible) {
      throw new BadRequestException(
        CERTIFICATE_INELIGIBILITY_MESSAGES[eligibility.reason as keyof typeof CERTIFICATE_INELIGIBILITY_MESSAGES],
      );
    }
    if (result.certificate) {
      return result.certificate;
    }

    const certificate = await this.create(resultId, result.exam.certificateValidityDays);
    this.audit(
      user.sub,
      'CERTIFICATE_ISSUED',
      resultId,
      { resultId, passed: true, percentage: Number(result.percentage) },
      { id: certificate.id, certificateNo: certificate.certificateNo, verificationCode: certificate.verificationCode },
    );
    return certificate;
  }

  /**
   * Issues a certificate for every eligible, not-yet-certified result of an exam.
   *
   * Idempotent: re-running it only fills the gaps, because `Certificate.resultId`
   * is UNIQUE and every candidate is filtered on `certificate: { is: null }`.
   * Runs in bounded batches so a large cohort cannot exhaust the connection
   * pool, and each batch is atomic — a failure mid-run leaves the already-issued
   * certificates valid rather than half-written.
   */
  async generateForExam(examId: string, user: AuthenticatedUser) {
    await this.access.assertCanManage(examId, user);

    const exam = await this.prisma.exam.findUnique({ where: { id: examId }, select: ELIGIBILITY_EXAM_SELECT });
    if (!exam) throw new NotFoundException('Exam not found');

    const summary = { examId, created: 0, alreadyIssued: 0, ineligible: 0, notPublished: 0 };

    // Every result is visited at most once. Without this, a batch of 100 results
    // that are all ineligible (or all awaiting publication) would be re-selected
    // verbatim on the next iteration and the loop would never terminate.
    const visited = new Set<string>();

    for (;;) {
      const candidates = await this.prisma.result.findMany({
        where: { examId, id: { notIn: [...visited] }, certificate: { is: null } },
        select: { id: true, passed: true, percentage: true, publishedAt: true },
        orderBy: { createdAt: 'asc' },
        take: GENERATE_BATCH_SIZE,
      });
      if (candidates.length === 0) break;

      const issueable: string[] = [];
      for (const candidate of candidates) {
        visited.add(candidate.id);
        // `enabled` is checked per candidate so a single summary line can explain
        // exactly why nothing was issued, instead of returning an empty 200.
        if (!exam.certificateEnabled) {
          summary.ineligible += 1;
          continue;
        }
        const eligibility = this.eligibilityFor(
          { ...candidate, exam: { certificateEnabled: exam.certificateEnabled, certificateMinPercentage: exam.certificateMinPercentage } },
          true,
        );
        if (eligibility.eligible) {
          issueable.push(candidate.id);
        } else if (eligibility.reason === 'RESULT_NOT_PUBLISHED') {
          summary.notPublished += 1;
        } else {
          summary.ineligible += 1;
        }
      }

      if (issueable.length > 0) {
        // createMany + skipDuplicates makes a concurrent second run a no-op
        // instead of a P2002 crash.
        const inserted = await this.prisma.certificate.createMany({
          data: issueable.map((resultId) => ({
            resultId,
            certificateNo: `OES-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`,
            verificationCode: randomUUID(),
            expiresAt: certificateExpiry(exam.certificateValidityDays),
          })),
          skipDuplicates: true,
        });
        summary.created += inserted.count;
      }

      if (candidates.length < GENERATE_BATCH_SIZE) break;
    }

    // `created + ineligible + notPublished` now covers every uncertified result
    // exactly once, so the remainder is what already had a certificate.
    const totalForExam = await this.prisma.result.count({ where: { examId } });
    summary.alreadyIssued = totalForExam - summary.created - summary.ineligible - summary.notPublished;

    this.audit(user.sub, 'CERTIFICATES_GENERATED', examId, { examId }, summary);
    return summary;
  }

  /**
   * Issues a certificate the moment a result becomes published, when the exam
   * opted into `certificateAutoIssue`.
   *
   * Called from the result publication paths, so it must never throw: failing to
   * auto-issue must not roll back or hide a result the instructor just published.
   * Returns the certificate, or `null` when auto-issue is off or the result is not
   * yet eligible.
   */
  async issueOnPublish(resultId: string, actorId: string): Promise<{ id: string; certificateNo: string } | null> {
    const result = await this.prisma.result.findUnique({
      where: { id: resultId },
      select: {
        id: true,
        passed: true,
        percentage: true,
        publishedAt: true,
        certificate: { select: { id: true, certificateNo: true } },
        exam: { select: ELIGIBILITY_EXAM_SELECT },
      },
    });
    if (!result || !result.exam.certificateAutoIssue) return null;
    if (result.certificate) return result.certificate;
    if (!result.publishedAt) return null;

    const eligibility = this.eligibilityFor(result, true);
    if (!eligibility.eligible) return null;

    try {
      const certificate = await this.create(result.id, result.exam.certificateValidityDays);
      this.audit(
        actorId,
        'CERTIFICATE_AUTO_ISSUED',
        resultId,
        { resultId },
        { id: certificate.id, certificateNo: certificate.certificateNo },
      );
      return certificate;
    } catch (error) {
      // A concurrent publish may have won the UNIQUE(resultId) race; that is a
      // success from the caller's point of view. Anything else is logged and
      // swallowed so publication still succeeds and the staff bulk button can
      // pick up the gap later.
      const existing = await this.prisma.certificate.findUnique({
        where: { resultId },
        select: { id: true, certificateNo: true },
      });
      if (existing) return existing;
      this.audit(actorId, 'CERTIFICATE_AUTO_ISSUE_FAILED', resultId, { resultId }, { reason: String(error) });
      return null;
    }
  }

  /**
   * Renders the certificate itself as a PDF. Read access mirrors `list`: a
   * student may download their own published certificate, staff may download any
   * certificate for an exam they manage.
   */
  async buildPdf(id: string, user: AuthenticatedUser): Promise<{ filename: string; buffer: Buffer }> {
    const certificate = await this.prisma.certificate.findUnique({ where: { id }, include: CERTIFICATE_INCLUDE });
    if (!certificate) throw new NotFoundException('Certificate not found');

    const scope = this.scopeClauses(user);
    if (scope !== null) {
      const visible = await this.prisma.certificate.count({ where: { id, OR: scope } });
      if (visible === 0) throw new NotFoundException('Certificate not found');
    }

    const result = certificate.result;
    const student = result.submission?.session.student;
    const fullName = student ? `${student.firstName} ${student.lastName}` : 'Student';
    const score = Number(result.score);
    const maxScore = Number(result.maxScore);
    const percentage = Number(result.percentage);
    const expired = certificate.expiresAt !== null && certificate.expiresAt.getTime() < Date.now();

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 56 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    const draw = () => {
      doc.fontSize(26).text('Certificate of Achievement', { align: 'center' });
      doc.moveDown(0.8);
      doc.fontSize(13).text('Online Examination System', { align: 'center' });
      doc.moveDown(1.6);

      doc.fontSize(14).text('This is to certify that', { align: 'center' });
      doc.moveDown(0.4);
      doc.fontSize(24).text(fullName, { align: 'center' });
      if (student?.email) {
        doc.moveDown(0.2);
        doc.fontSize(10).text(student.email, { align: 'center' });
      }
      doc.moveDown(1.4);

      doc.fontSize(14).text('has successfully completed', { align: 'center' });
      doc.moveDown(0.4);
      doc.fontSize(20).text(result.exam.title, { align: 'center' });
      doc.moveDown(1.6);

      doc.fontSize(12).text(`Score: ${score} / ${maxScore}  (${percentage}%)`, { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(12).text(`Issued on: ${certificate.issuedAt.toISOString().slice(0, 10)}`, { align: 'center' });
      if (certificate.expiresAt) {
        doc.moveDown(0.3);
        doc.fontSize(12).text(
          expired
            ? `Expired on: ${certificate.expiresAt.toISOString().slice(0, 10)}`
            : `Valid until: ${certificate.expiresAt.toISOString().slice(0, 10)}`,
          { align: 'center' },
        );
      }
      doc.moveDown(2);

      doc.fontSize(9).text(`Certificate No: ${certificate.certificateNo}`, { align: 'center' });
      doc.moveDown(0.2);
      doc.fontSize(9).text(`Verification code: ${certificate.verificationCode}`, { align: 'center' });
      doc.moveDown(1.4);
      doc
        .fontSize(8)
        .fillColor('#666666')
        .text('Verify this certificate using the verification code at the public verification endpoint.', { align: 'center' });
      doc.end();
    };

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      draw();
    });

    return { filename: `certificate-${certificate.certificateNo}.pdf`, buffer };
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
      include: {
        result: {
          select: {
            id: true,
            examId: true,
            passed: true,
            percentage: true,
            publishedAt: true,
            exam: { select: ELIGIBILITY_EXAM_SELECT },
          },
        },
      },
    });
    if (!certificate) {
      throw new NotFoundException('Certificate not found');
    }
    await this.access.assertCanManage(certificate.result.examId, user);

    const eligibility = this.eligibilityFor(certificate.result, false);
    if (!eligibility.eligible) {
      throw new BadRequestException(
        CERTIFICATE_INELIGIBILITY_MESSAGES[eligibility.reason as keyof typeof CERTIFICATE_INELIGIBILITY_MESSAGES],
      );
    }

    // An interactive callback, not `$transaction([...])`: passing already-created
    // Prisma calls into the array form made them execute eagerly, so the new
    // certificate could be inserted *before* the delete and trip the UNIQUE
    // constraint on resultId, leaving the student with no certificate at all.
    const next = await this.prisma.$transaction(async (tx) => {
      await tx.certificate.delete({ where: { id } });
      return this.create(certificate.resultId, certificate.result.exam.certificateValidityDays, tx);
    });

    this.audit(
      user.sub,
      'CERTIFICATE_REISSUED',
      certificate.resultId,
      { id: certificate.id, certificateNo: certificate.certificateNo, verificationCode: certificate.verificationCode },
      { id: next.id, certificateNo: next.certificateNo, verificationCode: next.verificationCode },
    );
    return next;
  }

  /**
   * Public verification. Accepts either the opaque `verificationCode` or the
   * human-facing `certificateNo`, because a printed certificate shows both and
   * an employer will naturally try the shorter one first.
   */
  async verify(codeOrNumber: string) {
    const value = codeOrNumber?.trim();
    if (!value) return null;
    const certificate = await this.prisma.certificate.findFirst({
      where: { OR: [{ verificationCode: value }, { certificateNo: value }] },
      include: CERTIFICATE_INCLUDE,
    });
    if (!certificate) return null;
    return {
      ...certificate,
      expired: certificate.expiresAt !== null && certificate.expiresAt.getTime() < Date.now(),
    };
  }
}
