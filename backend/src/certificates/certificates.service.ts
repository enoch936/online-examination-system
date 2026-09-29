import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CertificateAssignment, Prisma, RoleName } from '@prisma/client';
import { randomUUID } from 'crypto';
import { ExamAccessService } from '../common/exam-access.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { CertificateRendererService } from '../content/certificate-renderer.service';
import { ContentService } from '../content/content.service';
import {
  DEFAULT_TEMPLATE_CONTENT,
  DEFAULT_TEMPLATE_DESIGN,
  parseTemplateContent,
  parseTemplateDesign,
  TemplateContent,
  TemplateDesign,
} from '../content/template-content.util';
import { PrismaService } from '../prisma/prisma.service';
import {
  CERTIFICATE_INELIGIBILITY_MESSAGES,
  CertificateEligibility,
  certificateExpiry,
  evaluateCertificateEligibility,
  isExpired,
} from './certificate-eligibility.util';

type ListOptions = {
  examId?: string;
  page?: number;
  limit?: number;
};

/** Bounded so a 5,000-student cohort cannot open 5,000 connections at once. */
const GENERATE_BATCH_SIZE = 100;

/**
 * A justification has to be a sentence, not "ok", so an override record stays
 * meaningful in an audit months later.
 */
const MIN_OVERRIDE_REASON_LENGTH = 10;

/**
 * Public, unauthenticated verification payload. Intentionally omits the
 * student's email and the internal `resultId` / `submissionId` / `sessionId`
 * chain, none of which a verifier needs in order to trust the certificate.
 */
export type CertificateVerification = {
  valid: false;
} | {
  valid: true;
  certificateNo: string;
  issuedAt: Date;
  expiresAt: Date | null;
  expired: boolean;
  recipientName: string;
  examTitle: string;
  grade: string | null;
  percentage: Prisma.Decimal | null;
};

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
    private readonly content: ContentService,
    private readonly renderer: CertificateRendererService,
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

  private create(
    resultId: string,
    validityDays?: number | null,
    options: {
      assignment?: CertificateAssignment;
      overrideReason?: string | null;
      issuedById?: string | null;
      templateId?: string | null;
      templateSnapshot?: string | null;
    } = {},
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const suffix = `${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`;
    return tx.certificate.create({
      data: {
        resultId,
        certificateNo: `OES-${suffix}`,
        verificationCode: randomUUID(),
        expiresAt: certificateExpiry(validityDays),
        assignment: options.assignment ?? CertificateAssignment.BULK,
        overrideReason: options.overrideReason ?? null,
        issuedById: options.issuedById ?? null,
        templateId: options.templateId ?? null,
        templateSnapshot: options.templateSnapshot ?? null,
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
      // `expired` is derived server-side so the client never has to compare
      // clocks, and every consumer gets the same answer the verifier does.
      data: data.map((certificate) => ({ ...certificate, expired: isExpired(certificate.expiresAt) })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Staff assignment. The exam access check is unchanged — only someone who can
   * manage the exam reaches this point.
   *
   * A student who already meets the eligibility rules is issued a certificate
   * normally. One who does not (failed, scored under the exam's extra
   * certificate threshold, results unpublished, or certificates disabled for the
   * exam) can still be issued one, but only with a written justification: the
   * certificate is then recorded as `MANUAL` with `overrideReason` set, so a
   * later reader can always tell an earned certificate from an overridden one.
   */
  async issue(resultId: string, user: AuthenticatedUser, overrideReason?: string | null) {
    const result = await this.prisma.result.findUnique({
      where: { id: resultId },
      include: { certificate: true, exam: { select: ELIGIBILITY_EXAM_SELECT } },
    });
    if (!result) {
      throw new NotFoundException('Result not found');
    }
    await this.access.assertCanManage(result.examId, user);
    if (result.certificate) {
      // Certificates issued before issuing published their result are stranded:
      // they exist, but the owner cannot see them because visibility follows
      // `publishedAt`. Re-running the assign repairs that instead of returning
      // the same invisible certificate again.
      if (!result.publishedAt) {
        await this.prisma.result.update({ where: { id: resultId }, data: { publishedAt: new Date() } });
        this.audit(
          user.sub,
          'CERTIFICATE_ISSUED',
          resultId,
          { resultId, publishedResultNow: true, repairedExistingCertificate: true },
          { id: result.certificate.id, certificateNo: result.certificate.certificateNo, verificationCode: result.certificate.verificationCode, assignment: result.certificate.assignment },
        );
      }
      return result.certificate;
    }

    const reason = overrideReason?.trim();
    const eligibility = this.eligibilityFor(result, false);
    const isOverride = !eligibility.eligible;
    if (isOverride && (!reason || reason.length < MIN_OVERRIDE_REASON_LENGTH)) {
      throw new BadRequestException({
        code: 'CERTIFICATE_OVERRIDE_REASON_REQUIRED',
        message: CERTIFICATE_INELIGIBILITY_MESSAGES[eligibility.reason as keyof typeof CERTIFICATE_INELIGIBILITY_MESSAGES],
        ineligibilityReason: eligibility.reason,
        minReasonLength: MIN_OVERRIDE_REASON_LENGTH,
        // The wording is assembled here so every client asks for consent in the
        // same terms rather than inventing its own.
        overridePrompt:
          'This result is not eligible for a certificate. Provide a justification to issue one anyway; it will be recorded as a manual override.',
      });
    }

    // Issuing a certificate publishes its result. A student may only see
    // certificates on results that are published (see `scopeClauses`), so
    // assigning one onto an unpublished result would otherwise create a
    // certificate that exists for staff, appears on the student's results page,
    // and is nonetheless invisible on their certificate dashboard. Staff
    // assigning a certificate is a deliberate release decision, so this keeps
    // the early-release gate intact rather than dropping it.
    //
    // The publish and the insert share one transaction: publishing outside it
    // would release the student's result to them even if the certificate then
    // failed to be written.
    const template = await this.content.resolveForExam(result.examId);
    let publishedNow = false;
    const certificate = await this.prisma.$transaction(async (tx) => {
      if (!result.publishedAt) {
        await tx.result.update({ where: { id: resultId }, data: { publishedAt: new Date() } });
        publishedNow = true;
      }
      return this.create(
        resultId,
        result.exam.certificateValidityDays,
        {
          // `assignment` records how the certificate came to exist, and a person
          // clicking "assign" on the results list is by definition a manual issue.
          // Whether eligibility was bypassed is carried separately by
          // `overrideReason`, so the two questions stay independent.
          assignment: CertificateAssignment.MANUAL,
          overrideReason: isOverride ? reason! : null,
          issuedById: user.sub,
          templateId: template?.id ?? null,
          templateSnapshot: template
            ? JSON.stringify({ id: template.id, slug: template.slug, name: template.name, version: template.version, content: template.content, design: template.design })
            : null,
        },
        tx,
      );
    });

    this.audit(
      user.sub,
      isOverride ? 'CERTIFICATE_ISSUED_OVERRIDE' : 'CERTIFICATE_ISSUED',
      resultId,
      {
        resultId,
        passed: result.passed,
        percentage: Number(result.percentage),
        eligible: !isOverride,
        ...(isOverride ? { ineligibilityReason: eligibility.reason, overrideReason: reason } : {}),
        // Recorded so an auditor can tell that issuing this certificate was also
        // what released the result to the student.
        ...(publishedNow ? { publishedResultNow: true } : {}),
      },
      {
        id: certificate.id,
        certificateNo: certificate.certificateNo,
        verificationCode: certificate.verificationCode,
        assignment: certificate.assignment,
        templateId: certificate.templateId,
      },
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
        // Resolved once for the whole run: every certificate from this bulk
        // operation must render from the same template version, even if an
        // admin publishes a new default mid-run.
        const template = await this.content.resolveForExam(examId);
        const snapshot = template
          ? JSON.stringify({ id: template.id, slug: template.slug, name: template.name, version: template.version, content: template.content, design: template.design })
          : null;
        const templateId = template?.id ?? null;

        // createMany + skipDuplicates makes a concurrent second run a no-op
        // instead of a P2002 crash.
        const inserted = await this.prisma.certificate.createMany({
          data: issueable.map((resultId) => ({
            resultId,
            certificateNo: `OES-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`,
            verificationCode: randomUUID(),
            expiresAt: certificateExpiry(exam.certificateValidityDays),
            assignment: CertificateAssignment.BULK,
            templateId,
            templateSnapshot: snapshot,
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
      const template = await this.content.resolveForExam(result.exam.id);
      const certificate = await this.create(result.id, result.exam.certificateValidityDays, {
        assignment: CertificateAssignment.AUTO,
        templateId: template?.id ?? null,
        templateSnapshot: template
          ? JSON.stringify({ id: template.id, slug: template.slug, name: template.name, version: template.version, content: template.content, design: template.design })
          : null,
      });
      this.audit(
        actorId,
        'CERTIFICATE_AUTO_ISSUED',
        resultId,
        { resultId },
        { id: certificate.id, certificateNo: certificate.certificateNo, templateId: certificate.templateId },
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
   * Reads the frozen template copy stored on the certificate. Falls back to the
   * built-in wording for certificates issued before the CMS existed, and treats
   * any corrupt or partial snapshot the same way rather than failing the render.
   */
  private snapshotFor(snapshot: string | null): { content: TemplateContent; design: TemplateDesign } {
    if (!snapshot) {
      return { content: { ...DEFAULT_TEMPLATE_CONTENT }, design: { ...DEFAULT_TEMPLATE_DESIGN } };
    }
    try {
      const parsed = JSON.parse(snapshot) as { content?: unknown; design?: unknown };
      return {
        content: parseTemplateContent(typeof parsed.content === 'string' ? parsed.content : JSON.stringify(parsed.content ?? {})),
        design: parseTemplateDesign(typeof parsed.design === 'string' ? parsed.design : JSON.stringify(parsed.design ?? {})),
      };
    } catch {
      return { content: { ...DEFAULT_TEMPLATE_CONTENT }, design: { ...DEFAULT_TEMPLATE_DESIGN } };
    }
  }

  /**
   * Renders the certificate itself as a PDF. Read access mirrors `list`: a
   * student may download their own published certificate, staff may download any
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
    const expired = isExpired(certificate.expiresAt);

    // The snapshot taken at issue time is the source of truth, never the live
    // template: editing a template must not change a certificate a student
    // already holds. Only a certificate issued before the CMS existed has no
    // snapshot, and those render the built-in wording.
    const { content: text, design } = this.snapshotFor(certificate.templateSnapshot);
    const logo = text.logoUrl ? await this.renderer.loadLogo(text.logoUrl) : null;

    const buffer = await this.renderer.render(text, design, {
      recipientName: fullName,
      recipientEmail: student?.email ?? '',
      examTitle: result.exam.title,
      score: Number(result.score),
      maxScore: Number(result.maxScore),
      percentage: Number(result.percentage),
      grade: String(result.grade ?? ''),
      issuedOn: certificate.issuedAt.toISOString().slice(0, 10),
      expiryOn: certificate.expiresAt ? certificate.expiresAt.toISOString().slice(0, 10) : null,
      expired,
      certificateNo: certificate.certificateNo,
      verificationCode: certificate.verificationCode,
      logo,
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

  async reissue(id: string, user: AuthenticatedUser, overrideReason?: string | null) {
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
    const reason = overrideReason?.trim();
    // An override reason is accepted here for the same reason it is on issue: a
    // certificate that was legitimately issued under a manual override must
    // still be replaceable after the exam's rules tighten, otherwise revoking
    // it would permanently strand the student.
    const carriedReason = certificate.overrideReason;
    const isOverride = !eligibility.eligible;
    if (isOverride && !carriedReason && (!reason || reason.length < MIN_OVERRIDE_REASON_LENGTH)) {
      throw new BadRequestException({
        code: 'CERTIFICATE_OVERRIDE_REASON_REQUIRED',
        message: CERTIFICATE_INELIGIBILITY_MESSAGES[eligibility.reason as keyof typeof CERTIFICATE_INELIGIBILITY_MESSAGES],
        ineligibilityReason: eligibility.reason,
        minReasonLength: MIN_OVERRIDE_REASON_LENGTH,
        overridePrompt:
          'This result is no longer eligible for a certificate. Provide a justification to reissue it anyway; it will be recorded as a manual override.',
      });
    }

    // An interactive callback, not `$transaction([...])`: passing already-created
    // Prisma calls into the array form made them execute eagerly, so the new
    // certificate could be inserted *before* the delete and trip the UNIQUE
    // constraint on resultId, leaving the student with no certificate at all.
    const next = await this.prisma.$transaction(async (tx) => {
      // Same reasoning as `issue`: a reissued certificate must be visible to its
      // owner, and visibility follows the result being published. Applied inside
      // the transaction so a failure cannot leave a published result with no
      // certificate.
      if (!certificate.result.publishedAt) {
        await tx.result.update({
          where: { id: certificate.resultId },
          data: { publishedAt: new Date() },
        });
      }
      await tx.certificate.delete({ where: { id } });
      // A reissue stands in for the same achievement, so it keeps the original's
      // provenance and, critically, its template snapshot: reissuing must not
      // silently re-render the certificate with a template edited since.
      return this.create(
        certificate.resultId,
        certificate.result.exam.certificateValidityDays,
        {
          assignment: certificate.assignment,
          overrideReason: carriedReason ?? (isOverride ? reason! : null),
          issuedById: user.sub,
          templateId: certificate.templateId,
          templateSnapshot: certificate.templateSnapshot,
        },
        tx,
      );
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
   *
   * This route is unauthenticated, so it returns a deliberately narrow payload
   * rather than the record: enough to prove authenticity and nothing more. The
   * full chain returned by the authenticated list contains the student's email
   * address along with `resultId` / `submissionId` / `sessionId`, and all of
   * that would otherwise be readable by anyone holding a printed certificate
   * number.
   *
   * Unknown codes return `{ valid: false }` with 200 rather than null, so a
   * verification page does not have to distinguish "no match" from "valid" by
   * null-checking.
   */
  async verify(codeOrNumber: string): Promise<CertificateVerification> {
    const value = codeOrNumber?.trim();
    if (!value) return { valid: false };
    const certificate = await this.prisma.certificate.findFirst({
      where: { OR: [{ verificationCode: value }, { certificateNo: value }] },
      include: CERTIFICATE_INCLUDE,
    });
    if (!certificate) return { valid: false };
    const student = certificate.result.submission.session.student;
    return {
      valid: true,
      certificateNo: certificate.certificateNo,
      issuedAt: certificate.issuedAt,
      expiresAt: certificate.expiresAt,
      expired: isExpired(certificate.expiresAt),
      recipientName: [student?.firstName, student?.lastName].filter(Boolean).join(' '),
      examTitle: certificate.result.exam.title,
      grade: certificate.result.grade,
      percentage: certificate.result.percentage,
    };
  }
}
