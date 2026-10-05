import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { QuestionType, RoleName, SubmissionStatus } from '@prisma/client';
import { BulkGradingService } from './bulk-grading.service';

/**
 * An exam with one objective question (6 marks, auto-markable) and one essay
 * (4 marks, needs a human). `totalMarks` 10 keeps the arithmetic readable.
 */
const EXAM = {
  id: 'exam-1',
  totalMarks: 10,
  passingMarks: 5,
  negativeMarkingRate: 0,
  showResultImmediately: false,
  questions: [
    { questionId: 'q-mcq', points: 6, question: { type: QuestionType.MULTIPLE_CHOICE } },
    { questionId: 'q-essay', points: 4, question: { type: QuestionType.ESSAY } },
  ],
};

const OPTIONS = [
  { id: 'opt-a', isCorrect: true },
  { id: 'opt-b', isCorrect: false },
];

type AnswerState = {
  id: string;
  questionId: string;
  selectedOptionIds: string | null;
  answerText: string | null;
  score: number | null;
  graderId: string | null;
};

function makeHarness(options: { essayGraded?: boolean; answers?: AnswerState[] } = {}) {
  const answers: AnswerState[] = options.answers ?? [
    {
      id: 'ans-mcq',
      questionId: 'q-mcq',
      selectedOptionIds: JSON.stringify(['opt-a']),
      answerText: null,
      score: 0,
      graderId: null,
    },
    {
      id: 'ans-essay',
      questionId: 'q-essay',
      selectedOptionIds: null,
      answerText: 'a considered answer',
      score: options.essayGraded === false ? 0 : 3,
      graderId: options.essayGraded === false ? null : 'grader-1',
    },
  ];

  const resultUpdates: Array<{ where: { id: string }; data: Record<string, unknown> }> = [];
  const submissionUpdates: Array<Record<string, unknown>> = [];
  const answerUpdates: Array<{ where: { id: string }; data: Record<string, unknown> }> = [];
  let outstandingManual = options.essayGraded === false ? 1 : 0;

  const detail = {
    id: 'result-1',
    examId: 'exam-1',
    studentId: 'student-1',
    submissionId: 'submission-1',
    regradeCount: 0,
    score: 0,
    maxScore: 10,
    percentage: 0,
    passed: false,
    grade: null,
    autoScore: null,
    manualAdjusted: false,
    gradingStatus: 'PENDING',
    publishedAt: null,
    exam: EXAM,
    submission: {
      id: 'submission-1',
      status: SubmissionStatus.NEEDS_MANUAL_GRADING,
      session: {
        id: 'session-1',
        studentId: 'student-1',
        answers: answers.map((a) => ({
          ...a,
          question: { options: a.questionId === 'q-mcq' ? OPTIONS : [] },
        })),
      },
    },
  };

  const tx = {
    result: {
      findUnique: jest.fn(async () => JSON.parse(JSON.stringify(detail))),
      update: jest.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        resultUpdates.push(args);
        return detail;
      }),
    },
    submission: {
      update: jest.fn(async (args: { data: Record<string, unknown> }) => {
        submissionUpdates.push(args.data);
        return detail.submission;
      }),
    },
    studentAnswer: {
      count: jest.fn(async () => outstandingManual),
      update: jest.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        answerUpdates.push(args);
        return args;
      }),
    },
  };

  const prisma = {
    $transaction: jest.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
    exam: {
      findUnique: jest.fn(async () => EXAM),
    },
    result: {
      findMany: jest.fn(async () => [
        {
          id: 'result-1',
          examId: 'exam-1',
          studentId: 'student-1',
          submissionId: 'submission-1',
          regradeCount: 0,
        },
      ]),
    },
    classEnrollment: {
      findMany: jest.fn(async () => [{ studentId: 'student-1' }]),
    },
    auditLog: { create: jest.fn(async () => ({})) },
  };

  const access = {
    assertCanManage: jest.fn(async () => undefined),
  };

  const service = new BulkGradingService(prisma as never, access as never);
  const instructor = { sub: 'instructor-1', roles: [RoleName.INSTRUCTOR] } as never;
  return {
    service,
    prisma,
    access,
    tx,
    resultUpdates,
    submissionUpdates,
    answerUpdates,
    instructor,
    setOutstanding: (value: number) => {
      outstandingManual = value;
    },
  };
}

describe('BulkGradingService', () => {
  const scope = { examId: 'exam-1' };

  it('keeps the automatic score beside the final score', async () => {
    const h = makeHarness();

    const outcome = await h.service.run(scope, h.instructor);

    expect(outcome).toMatchObject({ matched: 1, graded: 1, needsManualGrading: 0 });
    const data = h.resultUpdates[0]!.data;
    // Essay scored 3 by a human, objective question scored 6 automatically.
    expect(data.score).toBe(9);
    expect(data.autoScore).toBe(6);
    expect(data.manualAdjusted).toBe(true);
    expect(data.gradingStatus).toBe('GRADED');
    expect(data.regradeCount).toEqual({ increment: 1 });
  });

  it('leaves a result PENDING while a manual answer is unjudged', async () => {
    const h = makeHarness({ essayGraded: false });

    const outcome = await h.service.run(scope, h.instructor);

    expect(outcome.needsManualGrading).toBe(1);
    const data = h.resultUpdates[0]!.data;
    expect(data.gradingStatus).toBe('PENDING');
    expect(data.score).toBe(6);
    expect(data.autoScore).toBe(6);
    expect(h.submissionUpdates[0]).toMatchObject({ status: SubmissionStatus.NEEDS_MANUAL_GRADING });
  });

  it('never overwrites a grader\'s marks with the automatic pass', async () => {
    const h = makeHarness();

    await h.service.run(scope, h.instructor);

    // Only the objective answer is rewritten; the essay mark is left alone.
    expect(h.answerUpdates).toHaveLength(1);
    expect(h.answerUpdates[0]).toEqual({ where: { id: 'ans-mcq' }, data: { score: 6 } });
  });

  it('marks a fully automatic result as unadjusted', async () => {
    const h = makeHarness({
      answers: [
        {
          id: 'ans-mcq',
          questionId: 'q-mcq',
          selectedOptionIds: JSON.stringify(['opt-a']),
          answerText: null,
          score: 0,
          graderId: null,
        },
        // No essay answer at all: nothing for a human to judge.
      ],
    });

    await h.service.run(scope, h.instructor);

    const data = h.resultUpdates[0]!.data;
    expect(data.score).toBe(6);
    expect(data.autoScore).toBe(6);
    expect(data.manualAdjusted).toBe(false);
  });

  it('authorises the exam before any row is touched', async () => {
    const h = makeHarness();
    h.access.assertCanManage.mockRejectedValueOnce(new ForbiddenException('not your exam'));

    await expect(h.service.run(scope, h.instructor)).rejects.toBeInstanceOf(ForbiddenException);
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('resolves a class filter through the real enrollment table', async () => {
    const h = makeHarness();
    await h.service.run({ examId: 'exam-1', classId: 'class-1' }, h.instructor);

    expect(h.prisma.classEnrollment.findMany).toHaveBeenCalledWith({
      where: { classId: 'class-1' },
      select: { studentId: true },
    });
    expect((h.prisma.result.findMany.mock.calls[0] as unknown as Array<Record<string, unknown>>)[0]).toMatchObject({
      where: { submission: { session: { studentId: { in: ['student-1'] } } } },
    });
  });

  it('filters to attempts that still owe grading', async () => {
    const h = makeHarness();
    await h.service.run({ examId: 'exam-1', onlyUngraded: true }, h.instructor);

    expect((h.prisma.result.findMany.mock.calls[0] as unknown as Array<Record<string, unknown>>)[0]).toMatchObject({
      where: { gradingStatus: { not: 'GRADED' } },
    });
  });

  it('keeps going when a single attempt cannot be graded', async () => {
    const h = makeHarness();
    h.prisma.result.findMany.mockResolvedValueOnce([
      { id: 'result-bad', examId: 'exam-1', studentId: 'student-1', submissionId: 'submission-1', regradeCount: 0 },
      { id: 'result-1', examId: 'exam-1', studentId: 'student-1', submissionId: 'submission-1', regradeCount: 0 },
    ] as never);
    h.tx.result.findUnique.mockImplementationOnce(async () => null as never);

    const outcome = await h.service.run(scope, h.instructor);

    expect(outcome.graded).toBe(1);
    expect(outcome.failed).toHaveLength(1);
    expect(outcome.failed[0]!.resultId).toBe('result-bad');
    expect(outcome.failed[0]!.reason).toMatch(/not found/i);
  });

  it('refuses an empty or oversized explicit selection', async () => {
    const h = makeHarness();
    await expect(h.service.run({ resultIds: [] }, h.instructor)).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      h.service.run({ resultIds: Array.from({ length: 501 }, () => 'result-1') }, h.instructor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a selection for an exam that does not exist', async () => {
    const h = makeHarness();
    h.prisma.exam.findUnique.mockResolvedValueOnce(null as never);
    await expect(h.service.run({ examId: 'exam-1' }, h.instructor)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('writes an audit record describing what the run did', async () => {
    const h = makeHarness();
    await h.service.run(scope, h.instructor);

    expect(h.prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actorId: 'instructor-1', action: 'BULK_GRADE' }),
      }),
    );
  });
});