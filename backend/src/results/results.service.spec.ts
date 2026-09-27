import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ResultsService } from './results.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ExamAccessService } from '../common/exam-access.service';
import type { CertificatesService } from '../certificates/certificates.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

/**
 * The transaction boundary in `gradeManually` is the point of these tests: the
 * per-answer writes, the re-aggregation, the submission status flip and the
 * result write must all commit or none of them may. A fake client is used so the
 * exact call sequence can be asserted, including that nothing escaped the
 * transaction callback.
 */

const instructor = { sub: 'instructor-1', roles: ['INSTRUCTOR'] } as unknown as AuthenticatedUser;

const ESSAY = 'ESSAY';
const MCQ = 'MCQ';

interface FakeResult {
  id: string;
  examId: string;
  submissionId: string;
  score: number;
  percentage: number;
  passed: boolean;
  grade: string | null;
  publishedAt: Date | null;
  exam: {
    id: string;
    totalMarks: number;
    passingMarks: number;
    showResultImmediately: boolean;
    questions: Array<{ questionId: string; points: number; question: { type: string } }>;
  };
  submission: {
    id: string;
    sessionId: string;
    session: { answers: Array<{ id: string; questionId: string; score: number; graderId: string | null }> };
  };
}

function baseResult(overrides: Partial<FakeResult> = {}): FakeResult {
  return {
    id: 'result-1',
    examId: 'exam-1',
    submissionId: 'sub-1',
    score: 0,
    percentage: 0,
    passed: false,
    grade: null,
    publishedAt: null,
    exam: {
      id: 'exam-1',
      totalMarks: 10,
      passingMarks: 4,
      showResultImmediately: false,
      questions: [
        { questionId: 'q-essay', points: 6, question: { type: ESSAY } },
        { questionId: 'q-mcq', points: 4, question: { type: MCQ } },
      ],
    },
    submission: {
      id: 'sub-1',
      sessionId: 'sess-1',
      session: {
        answers: [
          { id: 'ans-essay', questionId: 'q-essay', score: 0, graderId: null },
          { id: 'ans-mcq', questionId: 'q-mcq', score: 4, graderId: null },
        ],
      },
    },
    ...overrides,
  };
}

function makeService(mutate: (r: FakeResult) => void = () => undefined) {
  const tx = {
    studentAnswer: {
      update: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    submission: { update: jest.fn().mockResolvedValue({}) },
    result: { update: jest.fn().mockResolvedValue({ id: 'result-1' }) },
  };

  const seed = baseResult();
  mutate(seed);

  const prisma = {
    result: { findUnique: jest.fn().mockResolvedValue(seed) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  };

  const examAccess = { assertCanManage: jest.fn() } as unknown as ExamAccessService;
  const certificates = { issueOnPublish: jest.fn().mockResolvedValue(null) } as unknown as CertificatesService;

  const service = new ResultsService(prisma as unknown as PrismaService, examAccess, certificates);
  return { service, prisma, tx, examAccess, certificates };
}

describe('ResultsService.gradeManually validation', () => {
  it('rejects a missing result', async () => {
    const { service, prisma } = makeService();
    prisma.result.findUnique.mockResolvedValue(null);

    await expect(service.gradeManually('result-1', instructor, [])).rejects.toThrow(NotFoundException);
  });

  it('authorises the exam before writing anything', async () => {
    const { service, examAccess, prisma } = makeService();
    (examAccess.assertCanManage as jest.Mock).mockRejectedValue(new NotFoundException('nope'));

    await expect(service.gradeManually('result-1', instructor, [{ answerId: 'ans-essay', score: 3 }])).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  // Regression: an empty payload used to be accepted and zero every answer.
  it('rejects an empty payload', async () => {
    const { service, prisma } = makeService();

    await expect(service.gradeManually('result-1', instructor, [])).rejects.toThrow(BadRequestException);
    await expect(service.gradeManually('result-1', instructor, undefined as never)).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a payload larger than the cap', async () => {
    const { service } = makeService();
    const many = Array.from({ length: 501 }, (_, i) => ({ answerId: `ans-${i}`, score: 1 }));

    await expect(service.gradeManually('result-1', instructor, many)).rejects.toThrow(BadRequestException);
  });

  it('rejects an answerId that belongs to another submission', async () => {
    const { service, prisma } = makeService();

    await expect(
      service.gradeManually('result-1', instructor, [{ answerId: 'ans-from-another-student', score: 3 }]),
    ).rejects.toThrow(/outside this submission/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects duplicate answer entries', async () => {
    const { service, prisma } = makeService();

    await expect(
      service.gradeManually('result-1', instructor, [
        { answerId: 'ans-essay', score: 3 },
        { answerId: 'ans-essay', score: 5 },
      ]),
    ).rejects.toThrow(/duplicate/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('ResultsService.gradeManually scoring', () => {
  it('clamps a manual score to the exam question allocation', async () => {
    const { service, tx } = makeService();
    tx.studentAnswer.count.mockResolvedValue(0);
    tx.studentAnswer.findMany.mockResolvedValue([
      { id: 'ans-essay', questionId: 'q-essay', score: 6 },
      { id: 'ans-mcq', questionId: 'q-mcq', score: 4 },
    ]);

    await service.gradeManually('result-1', instructor, [{ answerId: 'ans-essay', score: 999 }]);

    const [updateArgs] = tx.studentAnswer.update.mock.calls[0];
    // The exam allocates 6 points to the essay, so 999 becomes 6, not 10.
    expect(updateArgs.data.score).toBe(6);
  });

  it('clamps a negative score to zero', async () => {
    const { service, tx } = makeService();
    tx.studentAnswer.count.mockResolvedValue(0);
    tx.studentAnswer.findMany.mockResolvedValue([
      { id: 'ans-essay', questionId: 'q-essay', score: 0 },
      { id: 'ans-mcq', questionId: 'q-mcq', score: 4 },
    ]);

    await service.gradeManually('result-1', instructor, [{ answerId: 'ans-essay', score: -50 }]);

    expect(tx.studentAnswer.update.mock.calls[0][0].data.score).toBe(0);
  });

  it('re-aggregates from the persisted rows and writes matching result metrics', async () => {
    const { service, tx } = makeService();
    tx.studentAnswer.count.mockResolvedValue(0);
    tx.studentAnswer.findMany.mockResolvedValue([
      { id: 'ans-essay', questionId: 'q-essay', score: 5 },
      { id: 'ans-mcq', questionId: 'q-mcq', score: 4 },
    ]);

    await service.gradeManually('result-1', instructor, [{ answerId: 'ans-essay', score: 5, feedback: '  good  ' }]);

    // 5 + 4 = 9 of 10 => 90%, which clears the 4-mark pass line.
    const resultWrite = tx.result.update.mock.calls[0][0].data;
    expect(resultWrite.score).toBe(9);
    expect(resultWrite.percentage).toBe(90);
    expect(resultWrite.passed).toBe(true);
    // Blank-padded feedback is trimmed.
    expect(tx.studentAnswer.update.mock.calls[0][0].data.feedback).toBe('good');
  });

  it('ignores a feedback field that is only whitespace', async () => {
    const { service, tx } = makeService();
    tx.studentAnswer.count.mockResolvedValue(0);
    tx.studentAnswer.findMany.mockResolvedValue([
      { id: 'ans-essay', questionId: 'q-essay', score: 3 },
      { id: 'ans-mcq', questionId: 'q-mcq', score: 4 },
    ]);

    await service.gradeManually('result-1', instructor, [{ answerId: 'ans-essay', score: 3, feedback: '   ' }]);

    expect(tx.studentAnswer.update.mock.calls[0][0].data.feedback).toBeNull();
  });

  it('excludes answers whose question has no point allocation from the total', async () => {
    const { service, tx } = makeService((r) => {
      r.submission.session.answers = [
        { id: 'ans-orphan', questionId: 'q-not-in-exam', score: 500, graderId: null },
        { id: 'ans-mcq', questionId: 'q-mcq', score: 4, graderId: null },
      ];
    });
    tx.studentAnswer.count.mockResolvedValue(0);
    tx.studentAnswer.findMany.mockResolvedValue([
      { id: 'ans-orphan', questionId: 'q-not-in-exam', score: 500 },
      { id: 'ans-mcq', questionId: 'q-mcq', score: 4 },
    ]);

    await service.gradeManually('result-1', instructor, [{ answerId: 'ans-orphan', score: 500 }]);

    // 500 points on a question the exam never allocated is discarded; only the
    // MCQ's own 4 allocated points survive.
    expect(tx.result.update.mock.calls[0][0].data.score).toBe(4);
  });
});

describe('ResultsService.gradeManually completion', () => {
  it('leaves the submission in NEEDS_MANUAL_GRADING while a human question is ungraded', async () => {
    const { service, tx } = makeService();
    // The essay is still awaiting a grader.
    tx.studentAnswer.count.mockResolvedValue(1);
    tx.studentAnswer.findMany.mockResolvedValue([
      { id: 'ans-essay', questionId: 'q-essay', score: 3 },
      { id: 'ans-mcq', questionId: 'q-mcq', score: 4 },
    ]);

    await service.gradeManually('result-1', instructor, [{ answerId: 'ans-mcq', score: 4 }]);

    expect(tx.submission.update.mock.calls[0][0].data.status).toBe('NEEDS_MANUAL_GRADING');
    expect(tx.submission.update.mock.calls[0][0].data.gradingCompletedAt).toBeNull();
  });

  it('flips the submission to GRADED once the last human question is scored', async () => {
    const { service, tx } = makeService();
    tx.studentAnswer.count.mockResolvedValue(0);
    tx.studentAnswer.findMany.mockResolvedValue([
      { id: 'ans-essay', questionId: 'q-essay', score: 3 },
      { id: 'ans-mcq', questionId: 'q-mcq', score: 4 },
    ]);

    await service.gradeManually('result-1', instructor, [{ answerId: 'ans-essay', score: 3 }]);

    expect(tx.submission.update.mock.calls[0][0].data.status).toBe('GRADED');
    expect(tx.submission.update.mock.calls[0][0].data.gradingCompletedAt).toBeInstanceOf(Date);
  });

  it('does not auto-publish when the exam hides results until release', async () => {
    const { service, tx, certificates } = makeService();
    tx.studentAnswer.count.mockResolvedValue(0);
    tx.studentAnswer.findMany.mockResolvedValue([
      { id: 'ans-essay', questionId: 'q-essay', score: 3 },
      { id: 'ans-mcq', questionId: 'q-mcq', score: 4 },
    ]);

    await service.gradeManually('result-1', instructor, [{ answerId: 'ans-essay', score: 3 }]);

    expect(tx.result.update.mock.calls[0][0].data.publishedAt).toBeNull();
    expect(certificates.issueOnPublish).not.toHaveBeenCalled();
  });

  it('auto-publishes and triggers certificate issue when the exam shows results immediately', async () => {
    const { service, tx, certificates } = makeService((r) => {
      r.exam.showResultImmediately = true;
    });
    tx.studentAnswer.count.mockResolvedValue(0);
    tx.studentAnswer.findMany.mockResolvedValue([
      { id: 'ans-essay', questionId: 'q-essay', score: 3 },
      { id: 'ans-mcq', questionId: 'q-mcq', score: 4 },
    ]);
    tx.result.update.mockResolvedValue({ id: 'result-1', publishedAt: new Date() });

    await service.gradeManually('result-1', instructor, [{ answerId: 'ans-essay', score: 3 }]);

    expect(certificates.issueOnPublish).toHaveBeenCalledWith('result-1', 'instructor-1');
  });

  it('keeps an already-published result published', async () => {
    const { service, tx } = makeService((r) => {
      r.publishedAt = new Date('2026-01-01');
    });
    tx.studentAnswer.count.mockResolvedValue(0);
    tx.studentAnswer.findMany.mockResolvedValue([
      { id: 'ans-essay', questionId: 'q-essay', score: 3 },
      { id: 'ans-mcq', questionId: 'q-mcq', score: 4 },
    ]);

    await service.gradeManually('result-1', instructor, [{ answerId: 'ans-essay', score: 3 }]);

    expect(tx.result.update.mock.calls[0][0].data.publishedAt).toEqual(new Date('2026-01-01'));
  });
});

describe('ResultsService.gradeManually atomicity', () => {
  it('performs every write through the transaction callback', async () => {
    const { service, prisma, tx } = makeService();
    tx.studentAnswer.count.mockResolvedValue(0);
    tx.studentAnswer.findMany.mockResolvedValue([
      { id: 'ans-essay', questionId: 'q-essay', score: 3 },
      { id: 'ans-mcq', questionId: 'q-mcq', score: 4 },
    ]);

    await service.gradeManually('result-1', instructor, [{ answerId: 'ans-essay', score: 3 }]);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.studentAnswer.update).toHaveBeenCalledTimes(1);
    expect(tx.submission.update).toHaveBeenCalledTimes(1);
    expect(tx.result.update).toHaveBeenCalledTimes(1);
    // Nothing wrote through the outer client, so a rollback cannot strand a
    // half-graded submission.
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it('surfaces a mid-transaction failure instead of committing partial grades', async () => {
    const { service, prisma, tx } = makeService();
    tx.studentAnswer.update.mockResolvedValue({});
    tx.studentAnswer.findMany.mockRejectedValue(new Error('connection reset'));

    await expect(service.gradeManually('result-1', instructor, [{ answerId: 'ans-essay', score: 3 }])).rejects.toThrow(
      'connection reset',
    );

    // The submission and result were never touched, so the rollback discards the
    // answer score too.
    expect(tx.submission.update).not.toHaveBeenCalled();
    expect(tx.result.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('does not write an audit trail when the transaction fails', async () => {
    const { service, prisma, tx } = makeService();
    tx.studentAnswer.findMany.mockRejectedValue(new Error('deadlock detected'));

    await expect(service.gradeManually('result-1', instructor, [{ answerId: 'ans-essay', score: 3 }])).rejects.toThrow();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('records before and after aggregates on the audit trail', async () => {
    const { service, prisma, tx } = makeService();
    tx.studentAnswer.count.mockResolvedValue(0);
    tx.studentAnswer.findMany.mockResolvedValue([
      { id: 'ans-essay', questionId: 'q-essay', score: 3 },
      { id: 'ans-mcq', questionId: 'q-mcq', score: 4 },
    ]);
    tx.result.update.mockResolvedValue({ id: 'result-1', publishedAt: null });

    await service.gradeManually('result-1', instructor, [{ answerId: 'ans-essay', score: 3 }]);

    const [auditArgs] = prisma.auditLog.create.mock.calls[0];
    expect(auditArgs.data.action).toBe('GRADE_MODIFIED');
    expect(JSON.parse(auditArgs.data.after).updatedAnswers).toBe(1);
    expect(JSON.parse(auditArgs.data.before).percentage).toBe(0);
  });
});

describe('ResultsService result visibility', () => {
  const student = { sub: 'student-1', roles: ['STUDENT'] } as unknown as AuthenticatedUser;
  const instructor = { sub: 'instructor-1', roles: ['INSTRUCTOR'] } as unknown as AuthenticatedUser;
  const admin = { sub: 'admin-1', roles: ['ADMIN'] } as unknown as AuthenticatedUser;
  const superAdmin = { sub: 'root-1', roles: ['SUPER_ADMIN'] } as unknown as AuthenticatedUser;

  function serviceFor(user: AuthenticatedUser) {
    // A minimal row that survives `findOne`'s student sanitising loop.
    const row = { id: 'r1', examId: 'exam-1', studentId: 'student-1', exam: { questions: [] }, submission: { session: { answers: [] } } };
    const prisma = {
      result: { findFirst: jest.fn().mockResolvedValue(row), findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn() },
      examSession: { count: jest.fn().mockResolvedValue(0) },
      exam: { count: jest.fn().mockResolvedValue(0) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn(),
    };
    return {
      prisma,
      row,
      service: new ResultsService(prisma as unknown as PrismaService, { assertCanManage: jest.fn() } as unknown as ExamAccessService, {} as CertificatesService),
    };
  }

  // A student reaching a result by guessing its id is the highest-value
  // invariant in this file: `findOne` must constrain on the caller, not on the
  // id the client supplied.
  it('constrains a student to their own results', async () => {
    const { service, prisma } = serviceFor(student);
    await service.findOne(student, 'someone-elses-result');
    const [args] = prisma.result.findFirst.mock.calls[0];
    expect(JSON.stringify(args.where)).toContain('student-1');
  });

  it('does not let a student read a result that is not theirs', async () => {
    const { service, prisma } = serviceFor(student);
    // Prisma returns null when the scoped predicate matches nothing.
    prisma.result.findFirst.mockResolvedValue(null);
    await expect(service.findOne(student, 'someone-elses-result')).rejects.toThrow();
  });

  it('scopes an instructor to exams they own or are shared with', async () => {
    const { service, prisma } = serviceFor(instructor);
    await service.findOne(instructor, 'r1');
    const [args] = prisma.result.findFirst.mock.calls[0];
    const serialised = JSON.stringify(args.where);
    expect(serialised).toContain('instructor-1');
    expect(serialised).not.toContain('studentId');
  });

  it('imposes no exam restriction on an admin', async () => {
    const { service, prisma } = serviceFor(admin);
    await service.findOne(admin, 'r1');
    const [args] = prisma.result.findFirst.mock.calls[0];
    expect(args.where.OR).toBeUndefined();
  });

  it('imposes no exam restriction on a super admin', async () => {
    const { service, prisma } = serviceFor(superAdmin);
    await service.findOne(superAdmin, 'r1');
    const [args] = prisma.result.findFirst.mock.calls[0];
    expect(args.where.OR).toBeUndefined();
  });

  it('keeps the student branch for a user who is both student and instructor', async () => {
    const both = { sub: 'multi-1', roles: ['STUDENT', 'INSTRUCTOR'] } as unknown as AuthenticatedUser;
    const { service, prisma } = serviceFor(both);
    await service.findOne(both, 'r1');
    const [args] = prisma.result.findFirst.mock.calls[0];
    const serialised = JSON.stringify(args.where.OR);
    // Both branches are kept: they widen access, they never narrow it.
    expect(serialised).toContain('multi-1');
    expect(serialised).toContain('createdById');
  });
});
