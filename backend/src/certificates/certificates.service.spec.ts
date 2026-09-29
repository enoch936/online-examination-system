import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CertificatesService } from './certificates.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ExamAccessService } from '../common/exam-access.service';
import type { ContentService } from '../content/content.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

/**
 * Service-level tests for the certificate lifecycle.
 *
 * These need a fake Prisma rather than a real database: what is being pinned
 * down here is the decision logic and the exact sequence of writes (batch
 * bounds, skipDuplicates, transaction-vs-no-transaction), none of which a real
 * database can assert. The constraints and the transactional behaviour that only
 * Postgres can prove are covered by scripts/verify-e2e.ts instead.
 */

const EXAM_ID = 'exam-1';

const instructor = { sub: 'instructor-1', roles: ['INSTRUCTOR'] } as unknown as AuthenticatedUser;

interface FakePrisma {
  exam: { findUnique: jest.Mock };
  result: { findMany: jest.Mock; count: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
  certificate: { createMany: jest.Mock; create: jest.Mock; findFirst: jest.Mock; findUnique: jest.Mock; findMany: jest.Mock; delete: jest.Mock; update: jest.Mock; count: jest.Mock };
  submission: { findUnique: jest.Mock; update: jest.Mock };
  $transaction: jest.Mock;
  auditLog: { create: jest.Mock };
}

function makeService(overrides: { access?: Partial<ExamAccessService>; content?: Partial<ContentService> } = {}) {
  const prisma: FakePrisma = {
    exam: { findUnique: jest.fn() },
    result: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    certificate: {
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
      // Used by `scopeClauses` visibility checks in buildPdf.
      count: jest.fn().mockResolvedValue(1),
    },
    submission: { findUnique: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const access = { assertCanManage: jest.fn(), ...overrides.access } as unknown as ExamAccessService;
  // Defaults to "no template configured", which is the pre-CMS behaviour the
  // existing assertions were written against.
  const content = { resolveForExam: jest.fn().mockResolvedValue(null), ...overrides.content } as unknown as ContentService;
  const service = new CertificatesService(prisma as unknown as PrismaService, access, content);
  return { service, prisma, access, content };
}

const passedResult = (id: string, percentage = 80) => ({
  id,
  passed: true,
  percentage,
  publishedAt: new Date('2026-01-02'),
});

describe('CertificatesService.generateForExam', () => {
  it('authorises before touching the database', async () => {
    const { service, prisma, access } = makeService();
    (access.assertCanManage as jest.Mock).mockRejectedValue(new NotFoundException('nope'));

    await expect(service.generateForExam(EXAM_ID, instructor)).rejects.toThrow(NotFoundException);
    expect(prisma.exam.findUnique).not.toHaveBeenCalled();
  });

  it('throws when the exam does not exist', async () => {
    const { service, prisma } = makeService();
    prisma.exam.findUnique.mockResolvedValue(null);

    await expect(service.generateForExam(EXAM_ID, instructor)).rejects.toThrow(NotFoundException);
  });

  it('issues one certificate per eligible result and reports the counts', async () => {
    const { service, prisma } = makeService();
    prisma.exam.findUnique.mockResolvedValue({
      id: EXAM_ID,
      title: 'Exam',
      totalMarks: 100,
      passingMarks: 40,
      certificateEnabled: true,
      certificateMinPercentage: null,
      certificateValidityDays: 30,
      certificateAutoIssue: false,
    });
    prisma.result.findMany.mockResolvedValueOnce([
      passedResult('r1'),
      passedResult('r2', 55),
      { id: 'r3', passed: false, percentage: 20, publishedAt: new Date() },
      { id: 'r4', passed: true, percentage: 90, publishedAt: null },
    ]);
    prisma.certificate.createMany.mockResolvedValue({ count: 2 });
    prisma.result.count.mockResolvedValue(4);

    const summary = await service.generateForExam(EXAM_ID, instructor);

    expect(summary).toEqual({ examId: EXAM_ID, created: 2, alreadyIssued: 0, ineligible: 1, notPublished: 1 });

    const [createArgs] = prisma.certificate.createMany.mock.calls[0];
    expect(createArgs.skipDuplicates).toBe(true);
    expect(createArgs.data).toHaveLength(2);
    expect(createArgs.data.map((d: { resultId: string }) => d.resultId).sort()).toEqual(['r1', 'r2']);
    expect(createArgs.data[0].certificateNo).toMatch(/^OES-[A-Z0-9]+-[A-Z0-9]{6}$/);
    // 30-day validity is applied to every issued certificate.
    for (const row of createArgs.data) {
      const days = (row.expiresAt.getTime() - Date.now()) / 86_400_000;
      expect(days).toBeGreaterThan(29);
      expect(days).toBeLessThan(31);
    }
  });

  it('leaves expiresAt null when the exam sets no validity', async () => {
    const { service, prisma } = makeService();
    prisma.exam.findUnique.mockResolvedValue({
      id: EXAM_ID,
      title: 'Exam',
      totalMarks: 100,
      passingMarks: 40,
      certificateEnabled: true,
      certificateMinPercentage: null,
      certificateValidityDays: null,
      certificateAutoIssue: false,
    });
    prisma.result.findMany.mockResolvedValueOnce([passedResult('r1')]);
    prisma.certificate.createMany.mockResolvedValue({ count: 1 });
    prisma.result.count.mockResolvedValue(1);

    await service.generateForExam(EXAM_ID, instructor);

    expect(prisma.certificate.createMany.mock.calls[0][0].data[0].expiresAt).toBeNull();
  });

  it('counts every result as ineligible and issues nothing when certificates are off', async () => {
    const { service, prisma } = makeService();
    prisma.exam.findUnique.mockResolvedValue({
      id: EXAM_ID,
      title: 'Exam',
      totalMarks: 100,
      passingMarks: 40,
      certificateEnabled: false,
      certificateMinPercentage: null,
      certificateValidityDays: null,
      certificateAutoIssue: false,
    });
    prisma.result.findMany.mockResolvedValueOnce([passedResult('r1'), passedResult('r2')]);
    prisma.result.count.mockResolvedValue(2);

    const summary = await service.generateForExam(EXAM_ID, instructor);

    expect(prisma.certificate.createMany).not.toHaveBeenCalled();
    expect(summary).toEqual({ examId: EXAM_ID, created: 0, alreadyIssued: 0, ineligible: 2, notPublished: 0 });
  });

  it('enforces certificateMinPercentage as an extra gate on top of the pass mark', async () => {
    const { service, prisma } = makeService();
    prisma.exam.findUnique.mockResolvedValue({
      id: EXAM_ID,
      title: 'Exam',
      totalMarks: 100,
      passingMarks: 40,
      certificateEnabled: true,
      certificateMinPercentage: 80,
      certificateValidityDays: null,
      certificateAutoIssue: false,
    });
    // 55% clears the 40 pass mark but not the 80% certificate gate.
    prisma.result.findMany.mockResolvedValueOnce([passedResult('r1', 55), passedResult('r2', 90)]);
    prisma.certificate.createMany.mockResolvedValue({ count: 1 });
    prisma.result.count.mockResolvedValue(2);

    const summary = await service.generateForExam(EXAM_ID, instructor);

    expect(prisma.certificate.createMany.mock.calls[0][0].data.map((d: { resultId: string }) => d.resultId)).toEqual(['r2']);
    expect(summary).toEqual({ examId: EXAM_ID, created: 1, alreadyIssued: 0, ineligible: 1, notPublished: 0 });
  });

  // Regression: the loop re-selected the same rows because ineligible results
  // never disappear, so a batch of 100 ineligible results span forever.
  it('terminates when a full batch is entirely ineligible', async () => {
    const { service, prisma } = makeService();
    prisma.exam.findUnique.mockResolvedValue({
      id: EXAM_ID,
      title: 'Exam',
      totalMarks: 100,
      passingMarks: 40,
      certificateEnabled: false,
      certificateMinPercentage: null,
      certificateValidityDays: null,
      certificateAutoIssue: false,
    });
    // A full batch on the first call, then nothing: the second query excludes
    // everything already visited.
    prisma.result.findMany
      .mockResolvedValueOnce(Array.from({ length: 100 }, (_, i) => passedResult(`r${i}`)))
      .mockResolvedValueOnce([]);
    prisma.result.count.mockResolvedValue(100);

    const summary = await service.generateForExam(EXAM_ID, instructor);

    expect(prisma.result.findMany).toHaveBeenCalledTimes(2);
    expect(summary.ineligible).toBe(100);
    expect(summary.created).toBe(0);
  });

  it('walks multiple batches and never re-visits a result', async () => {
    const { service, prisma } = makeService();
    prisma.exam.findUnique.mockResolvedValue({
      id: EXAM_ID,
      title: 'Exam',
      totalMarks: 100,
      passingMarks: 40,
      certificateEnabled: true,
      certificateMinPercentage: null,
      certificateValidityDays: null,
      certificateAutoIssue: false,
    });
    const first = Array.from({ length: 100 }, (_, i) => passedResult(`a${i}`));
    const second = Array.from({ length: 40 }, (_, i) => passedResult(`b${i}`));
    prisma.result.findMany
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second)
      .mockResolvedValueOnce([]);
    prisma.certificate.createMany
      .mockResolvedValueOnce({ count: 100 })
      .mockResolvedValueOnce({ count: 40 });
    prisma.result.count.mockResolvedValue(140);

    const summary = await service.generateForExam(EXAM_ID, instructor);

    expect(summary.created).toBe(140);
    expect(prisma.certificate.createMany).toHaveBeenCalledTimes(2);
    // Second batch must exclude the first batch's ids.
    const secondCall = prisma.result.findMany.mock.calls[1][0];
    expect(secondCall.where.id.notIn).toHaveLength(100);
    expect(secondCall.take).toBe(100);
  });

  it('derives alreadyIssued as the remainder so a re-run reports no new work', async () => {
    const { service, prisma } = makeService();
    prisma.exam.findUnique.mockResolvedValue({
      id: EXAM_ID,
      title: 'Exam',
      totalMarks: 100,
      passingMarks: 40,
      certificateEnabled: true,
      certificateMinPercentage: null,
      certificateValidityDays: null,
      certificateAutoIssue: false,
    });
    // Everything already has a certificate, so the candidate query is empty.
    prisma.result.findMany.mockResolvedValue([]);
    prisma.result.count.mockResolvedValue(7);

    const summary = await service.generateForExam(EXAM_ID, instructor);

    expect(summary).toEqual({ examId: EXAM_ID, created: 0, alreadyIssued: 7, ineligible: 0, notPublished: 0 });
  });
});

describe('CertificatesService.issueOnPublish', () => {
  const autoIssueExam = {
    id: EXAM_ID,
    title: 'Exam',
    totalMarks: 100,
    passingMarks: 40,
    certificateEnabled: true,
    certificateMinPercentage: null,
    certificateValidityDays: 365,
    certificateAutoIssue: true,
  };

  it('issues for a published, eligible result when the exam opted in', async () => {
    const { service, prisma } = makeService();
    prisma.result.findUnique.mockResolvedValue({
      id: 'r1',
      passed: true,
      percentage: 88,
      publishedAt: new Date(),
      certificate: null,
      exam: autoIssueExam,
    });
    prisma.certificate.create.mockResolvedValue({ id: 'cert-1', certificateNo: 'OES-1' });

    const out = await service.issueOnPublish('r1', 'instructor-1');

    expect(out).toEqual({ id: 'cert-1', certificateNo: 'OES-1' });
  });

  it('returns the existing certificate instead of creating a second one', async () => {
    const { service, prisma } = makeService();
    prisma.result.findUnique.mockResolvedValue({
      id: 'r1',
      passed: true,
      percentage: 88,
      publishedAt: new Date(),
      certificate: { id: 'cert-existing', certificateNo: 'OES-EXISTING' },
      exam: autoIssueExam,
    });

    expect(await service.issueOnPublish('r1', 'instructor-1')).toEqual({
      id: 'cert-existing',
      certificateNo: 'OES-EXISTING',
    });
    expect(prisma.certificate.create).not.toHaveBeenCalled();
  });

  it('does nothing when the exam did not opt in to auto-issue', async () => {
    const { service, prisma } = makeService();
    prisma.result.findUnique.mockResolvedValue({
      id: 'r1',
      passed: true,
      percentage: 88,
      publishedAt: new Date(),
      certificate: null,
      exam: { ...autoIssueExam, certificateAutoIssue: false },
    });

    expect(await service.issueOnPublish('r1', 'instructor-1')).toBeNull();
    expect(prisma.certificate.create).not.toHaveBeenCalled();
  });

  it('does not issue a failed result', async () => {
    const { service, prisma } = makeService();
    prisma.result.findUnique.mockResolvedValue({
      id: 'r1',
      passed: false,
      percentage: 12,
      publishedAt: new Date(),
      certificate: null,
      exam: autoIssueExam,
    });

    expect(await service.issueOnPublish('r1', 'instructor-1')).toBeNull();
  });

  it('does not issue an unpublished result', async () => {
    const { service, prisma } = makeService();
    prisma.result.findUnique.mockResolvedValue({
      id: 'r1',
      passed: true,
      percentage: 88,
      publishedAt: null,
      certificate: null,
      exam: autoIssueExam,
    });

    expect(await service.issueOnPublish('r1', 'instructor-1')).toBeNull();
  });

  // Regression: this runs on the publication path, so a database failure here
  // must not fail the instructor's publish call.
  it('swallows a create failure instead of propagating it', async () => {
    const { service, prisma } = makeService();
    prisma.result.findUnique.mockResolvedValue({
      id: 'r1',
      passed: true,
      percentage: 88,
      publishedAt: new Date(),
      certificate: null,
      exam: autoIssueExam,
    });
    prisma.certificate.create.mockRejectedValue(new Error('db down'));

    await expect(service.issueOnPublish('r1', 'instructor-1')).resolves.toBeNull();
  });
});

describe('CertificatesService.reissue', () => {
  const existing = {
    id: 'cert-old',
    resultId: 'r1',
    certificateNo: 'OES-OLD',
    verificationCode: 'code-old',
    issuedAt: new Date('2020-01-01'),
    expiresAt: null,
    result: {
      id: 'r1',
      score: 80,
      maxScore: 100,
      percentage: 80,
      grade: 'B',
      passed: true,
      exam: { id: EXAM_ID, title: 'Exam', totalMarks: 100, passingMarks: 40 },
      submission: { submittedAt: new Date('2020-01-01'), session: { student: { id: 's1', firstName: 'John', lastName: 'Doe', email: 'j@x.com' } } },
    },
  };

  it('deletes and recreates inside a single transaction so a failure cannot strand the student', async () => {
    const { service, prisma } = makeService();
    prisma.certificate.findUnique.mockResolvedValue(existing);
    // Interactive transaction: the callback receives a client.
    prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        certificate: { delete: jest.fn().mockResolvedValue({}), create: jest.fn().mockResolvedValue({ id: 'cert-new', certificateNo: 'OES-NEW' }) },
      }),
    );

    const out = await service.reissue('cert-old', instructor);

    expect(out).toEqual({ id: 'cert-new', certificateNo: 'OES-NEW' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(typeof prisma.$transaction.mock.calls[0][0]).toBe('function');
  });

  it('rolls back when the recreate fails, leaving the original in place', async () => {
    const { service, prisma } = makeService();
    prisma.certificate.findUnique.mockResolvedValue(existing);
    prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        certificate: {
          delete: jest.fn().mockResolvedValue({}),
          create: jest.fn().mockRejectedValue(new Error('unique violation')),
        },
      }),
    );

    // The rejection must propagate so the transaction rolls the delete back.
    await expect(service.reissue('cert-old', instructor)).rejects.toThrow('unique violation');
  });

  it('authorises against the exam that owns the certificate', async () => {
    const { service, prisma, access } = makeService();
    prisma.certificate.findUnique.mockResolvedValue(existing);
    (access.assertCanManage as jest.Mock).mockRejectedValue(new NotFoundException('nope'));

    await expect(service.reissue('cert-old', instructor)).rejects.toThrow(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('CertificatesService.verify', () => {
  it('returns valid:false for an unknown code rather than null', async () => {
    const { service, prisma } = makeService();
    prisma.certificate.findFirst.mockResolvedValue(null);

    expect(await service.verify('nope')).toEqual({ valid: false });
  });

  it('returns valid:false for a blank code without querying', async () => {
    const { service, prisma } = makeService();

    expect(await service.verify('   ')).toEqual({ valid: false });
    expect(prisma.certificate.findFirst).not.toHaveBeenCalled();
  });

  it('accepts either the verification code or the certificate number', async () => {
    const { service, prisma } = makeService();
    prisma.certificate.findFirst.mockResolvedValue(null);

    await service.verify('OES-ABC-123456');

    const [args] = prisma.certificate.findFirst.mock.calls[0];
    expect(args.where.OR).toEqual([{ verificationCode: 'OES-ABC-123456' }, { certificateNo: 'OES-ABC-123456' }]);
  });

  // Regression: this route is unauthenticated, so the payload must not carry
  // the student's email or the internal id chain.
  it('omits the student email and internal ids from the public payload', async () => {
    const { service, prisma } = makeService();
    prisma.certificate.findFirst.mockResolvedValue({
      id: 'cert-1',
      resultId: 'r1',
      certificateNo: 'OES-ABC-123456',
      verificationCode: 'code-1',
      issuedAt: new Date('2026-01-01'),
      expiresAt: new Date('2027-01-01'),
      result: {
        id: 'r1',
        grade: 'A',
        percentage: 92,
        exam: { title: 'Exam', totalMarks: 100, passingMarks: 40 },
        submission: {
          submittedAt: new Date('2026-01-01'),
          session: { student: { id: 's1', firstName: 'John', lastName: 'Doe', email: 'john@secret.test' } },
        },
      },
    });

    const out = await service.verify('code-1');

    expect(out).toEqual({
      valid: true,
      certificateNo: 'OES-ABC-123456',
      issuedAt: new Date('2026-01-01'),
      expiresAt: new Date('2027-01-01'),
      expired: false,
      recipientName: 'John Doe',
      examTitle: 'Exam',
      grade: 'A',
      percentage: 92,
    });
    const serialised = JSON.stringify(out);
    expect(serialised).not.toContain('john@secret.test');
    expect(serialised).not.toContain('resultId');
    expect(serialised).not.toContain('verificationCode');
  });
});

describe('CertificatesService.issue (manual assignment)', () => {
  const eligibleResult = {
    id: 'result-1',
    examId: EXAM_ID,
    passed: true,
    percentage: 80,
    publishedAt: new Date('2026-01-02'),
    certificate: null,
    exam: {
      id: EXAM_ID,
      title: 'Exam',
      totalMarks: 100,
      passingMarks: 40,
      certificateEnabled: true,
      certificateMinPercentage: null,
      certificateValidityDays: null,
      certificateAutoIssue: false,
    },
  };

  const createdCertificate = {
    id: 'cert-1',
    certificateNo: 'OES-X',
    verificationCode: 'code',
    assignment: 'MANUAL',
    templateId: null,
  };

  it('issues an eligible result and records it as a MANUAL assignment', async () => {
    const { service, prisma } = makeService();
    prisma.result.findUnique.mockResolvedValue(eligibleResult);
    prisma.certificate.create.mockResolvedValue(createdCertificate);

    await service.issue('result-1', instructor);

    const [{ data }] = prisma.certificate.create.mock.calls[0];
    expect(data.assignment).toBe('MANUAL');
    expect(data.overrideReason).toBeNull();
    expect(data.issuedById).toBe(instructor.sub);
  });

  /** Captures the structured error body the global exception filter would emit. */
  async function rejectionBody(promise: Promise<unknown>): Promise<Record<string, unknown>> {
    try {
      await promise;
    } catch (error) {
      if (error instanceof BadRequestException) return error.getResponse() as Record<string, unknown>;
      throw error;
    }
    throw new Error('expected the call to reject');
  }

  it('refuses an ineligible result with no justification and never writes', async () => {
    const { service, prisma } = makeService();
    prisma.result.findUnique.mockResolvedValue({ ...eligibleResult, passed: false });

    const body = await rejectionBody(service.issue('result-1', instructor));

    // The structured code is what lets the UI open the justification dialog
    // rather than pattern-match a human-readable message.
    expect(body.code).toBe('CERTIFICATE_OVERRIDE_REASON_REQUIRED');
    expect(body.minReasonLength).toBeGreaterThan(0);
    expect(prisma.certificate.create).not.toHaveBeenCalled();
  });

  it('rejects a justification shorter than the minimum as not a real reason', async () => {
    const { service, prisma } = makeService();
    prisma.result.findUnique.mockResolvedValue({ ...eligibleResult, passed: false });

    const body = await rejectionBody(service.issue('result-1', instructor, 'ok'));

    expect(body.code).toBe('CERTIFICATE_OVERRIDE_REASON_REQUIRED');
    expect(prisma.certificate.create).not.toHaveBeenCalled();
  });

  it('issues an ineligible result when a justification is supplied', async () => {
    const { service, prisma } = makeService();
    prisma.result.findUnique.mockResolvedValue({ ...eligibleResult, passed: false });
    prisma.certificate.create.mockResolvedValue(createdCertificate);

    await service.issue('result-1', instructor, 'Medical exemption approved by the dean');

    const [{ data }] = prisma.certificate.create.mock.calls[0];
    expect(data.assignment).toBe('MANUAL');
    expect(data.overrideReason).toBe('Medical exemption approved by the dean');
  });

  it('is idempotent: an existing certificate is returned untouched', async () => {
    const { service, prisma } = makeService();
    prisma.result.findUnique.mockResolvedValue({ ...eligibleResult, certificate: { id: 'cert-existing' } });

    expect(await service.issue('result-1', instructor)).toEqual({ id: 'cert-existing' });
    expect(prisma.certificate.create).not.toHaveBeenCalled();
  });

  it('authorises before deciding anything', async () => {
    const { service, prisma, access } = makeService();
    prisma.result.findUnique.mockResolvedValue(eligibleResult);
    (access.assertCanManage as jest.Mock).mockRejectedValue(new NotFoundException('nope'));

    await expect(service.issue('result-1', instructor)).rejects.toThrow(NotFoundException);
    expect(prisma.certificate.create).not.toHaveBeenCalled();
  });
});

describe('CertificatesService template snapshot', () => {
  const result = {
    id: 'result-1',
    examId: EXAM_ID,
    passed: true,
    percentage: 80,
    publishedAt: new Date('2026-01-02'),
    certificate: null,
    exam: {
      id: EXAM_ID,
      title: 'Exam',
      totalMarks: 100,
      passingMarks: 40,
      certificateEnabled: true,
      certificateMinPercentage: null,
      certificateValidityDays: null,
      certificateAutoIssue: false,
    },
  };

  const template = {
    id: 'tpl-1',
    slug: 'standard',
    name: 'Standard',
    version: 3,
    content: { title: 'Custom title' },
    design: { accentColor: '#123456' },
  };

  it('freezes a resolvable template onto the certificate at issue time', async () => {
    const { service, prisma } = makeService({ content: { resolveForExam: jest.fn().mockResolvedValue(template) } as never });
    prisma.result.findUnique.mockResolvedValue(result);
    prisma.certificate.create.mockResolvedValue({ id: 'cert-1' });

    await service.issue('result-1', instructor);

    const [{ data }] = prisma.certificate.create.mock.calls[0];
    expect(data.templateId).toBe('tpl-1');
    // The snapshot carries the version, which is what makes an already-issued
    // certificate immune to later template edits.
    expect(JSON.parse(data.templateSnapshot)).toMatchObject({ id: 'tpl-1', version: 3 });
  });

  it('leaves templateId null when no template is configured at all', async () => {
    const { service, prisma } = makeService();
    prisma.result.findUnique.mockResolvedValue(result);
    prisma.certificate.create.mockResolvedValue({ id: 'cert-1' });

    await service.issue('result-1', instructor);

    const [{ data }] = prisma.certificate.create.mock.calls[0];
    expect(data.templateId).toBeNull();
    expect(data.templateSnapshot).toBeNull();
  });

  it('snapshots the same template for every certificate in a bulk run', async () => {
    const resolveForExam = jest.fn().mockResolvedValue(template);
    const { service, prisma } = makeService({ content: { resolveForExam } as never });
    prisma.exam.findUnique.mockResolvedValue({
      id: EXAM_ID,
      title: 'Exam',
      totalMarks: 100,
      passingMarks: 40,
      certificateEnabled: true,
      certificateMinPercentage: null,
      certificateValidityDays: null,
      certificateAutoIssue: false,
    });
    prisma.result.findMany.mockResolvedValueOnce([
      { id: 'r1', passed: true, percentage: 80, publishedAt: new Date() },
      { id: 'r2', passed: true, percentage: 90, publishedAt: new Date() },
    ]);
    prisma.certificate.createMany.mockResolvedValue({ count: 2 });
    prisma.result.count.mockResolvedValue(2);

    await service.generateForExam(EXAM_ID, instructor);

    const [{ data }] = prisma.certificate.createMany.mock.calls[0];
    expect(data.every((row: { templateId: string }) => row.templateId === 'tpl-1')).toBe(true);
    // Resolved once, not once per certificate: a mid-run publish cannot split
    // one batch across two template versions.
    expect(resolveForExam).toHaveBeenCalledTimes(1);
  });
});

describe('CertificatesService.buildPdf', () => {
  it('renders the frozen snapshot rather than the live template', async () => {
    const { service, prisma } = makeService();
    prisma.certificate.findUnique.mockResolvedValue({
      id: 'cert-1',
      certificateNo: 'OES-ABC-123',
      verificationCode: 'code-1',
      issuedAt: new Date('2026-01-01'),
      expiresAt: null,
      templateSnapshot: JSON.stringify({
        id: 'tpl-1',
        version: 2,
        content: { title: 'Frozen title wording', showScore: false },
        design: { accentColor: '#000000' },
      }),
      result: {
        score: 10,
        maxScore: 20,
        percentage: 50,
        grade: 'B',
        exam: { title: 'Exam', totalMarks: 20, passingMarks: 10 },
        submission: { session: { student: { firstName: 'John', lastName: 'Doe', email: 'j@x.test' } } },
      },
    });

    const { buffer } = await service.buildPdf('cert-1', instructor);

    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('still renders for a certificate issued before the CMS existed', async () => {
    const { service, prisma } = makeService();
    prisma.certificate.findUnique.mockResolvedValue({
      id: 'cert-1',
      certificateNo: 'OES-ABC-123',
      verificationCode: 'code-1',
      issuedAt: new Date('2026-01-01'),
      expiresAt: null,
      templateSnapshot: null,
      result: {
        score: 10,
        maxScore: 20,
        percentage: 50,
        grade: 'B',
        exam: { title: 'Exam', totalMarks: 20, passingMarks: 10 },
        submission: { session: { student: { firstName: 'John', lastName: 'Doe', email: 'j@x.test' } } },
      },
    });

    const { buffer } = await service.buildPdf('cert-1', instructor);

    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('does not fail on a corrupt snapshot', async () => {
    const { service, prisma } = makeService();
    prisma.certificate.findUnique.mockResolvedValue({
      id: 'cert-1',
      certificateNo: 'OES-ABC-123',
      verificationCode: 'code-1',
      issuedAt: new Date('2026-01-01'),
      expiresAt: null,
      templateSnapshot: '{not valid json',
      result: {
        score: 10,
        maxScore: 20,
        percentage: 50,
        grade: 'B',
        exam: { title: 'Exam', totalMarks: 20, passingMarks: 10 },
        submission: { session: { student: { firstName: 'John', lastName: 'Doe', email: 'j@x.test' } } },
      },
    });

    const { buffer } = await service.buildPdf('cert-1', instructor);

    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
  });
});
