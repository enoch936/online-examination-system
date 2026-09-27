import {
  computeResultMetrics,
  isAnswerPopulated,
  scoreAttempt,
  selectBestAttempt,
  selectOfficialResults,
  AttemptScoringConfig,
  CalculableQuestion,
} from './result-calculation.util';

const option = (id: string, isCorrect: boolean) => ({ id, text: id.toUpperCase(), isCorrect });

const mc = (questionId: string, points: number, correctIds: string[], all: string[] = ['a', 'b', 'c']): CalculableQuestion => ({
  questionId,
  type: 'MULTIPLE_CHOICE',
  points,
  options: all.map((id) => option(id, correctIds.includes(id))),
});

const config: AttemptScoringConfig = { totalMarks: 100, passingMarks: 40, negativeMarkingRate: 0 };

describe('scoreAttempt', () => {
  it('sums per-question points and counts correct/incorrect/answered', () => {
    const breakdown = scoreAttempt(
      [mc('q1', 50, ['a']), mc('q2', 50, ['a'])],
      [
        { answerId: 'a1', questionId: 'q1', selectedOptionIds: '["a"]' },
        { answerId: 'a2', questionId: 'q2', selectedOptionIds: '["b"]' },
      ],
      config,
    );
    // 50 correct + 50 wrong with no negative marking = 50.
    expect(breakdown.rawTotal).toBe(50);
    expect(breakdown.correctAnswers).toBe(1);
    // A wrong answer is incorrect regardless of whether marks were deducted.
    expect(breakdown.incorrectAnswers).toBe(1);
    expect(breakdown.answeredQuestions).toBe(2);
    expect(breakdown.unansweredQuestions).toBe(0);
  });

  it('treats an unanswered question as 0 with no penalty', () => {
    const breakdown = scoreAttempt([mc('q1', 50, ['a']), mc('q2', 50, ['a'])], [], {
      ...config,
      negativeMarkingRate: 1,
    });
    expect(breakdown.rawTotal).toBe(0);
    expect(breakdown.unansweredQuestions).toBe(2);
    expect(breakdown.incorrectAnswers).toBe(0);
  });

  it('applies negative marking only to wrong-but-answered questions', () => {
    const breakdown = scoreAttempt([mc('q1', 40, ['a'])], [{ answerId: 'a1', questionId: 'q1', selectedOptionIds: '["b"]' }], {
      ...config,
      negativeMarkingRate: 0.25,
    });
    expect(breakdown.rawTotal).toBe(-10);
    expect(breakdown.incorrectAnswers).toBe(1);
  });

  it('returns a per-answer score map for exactly the stored answers', () => {
    const breakdown = scoreAttempt([mc('q1', 10, ['a']), mc('q2', 10, ['a'])], [
      { answerId: 'a1', questionId: 'q1', selectedOptionIds: '["a"]' },
    ], config);
    expect(breakdown.answerScores).toEqual([{ answerId: 'a1', score: 10 }]);
  });

  it('flags manual grading for question types it cannot auto-score', () => {
    const breakdown = scoreAttempt(
      [{ questionId: 'q1', type: 'ESSAY', points: 20, options: [] }],
      [{ answerId: 'a1', questionId: 'q1', answerText: 'some prose' }],
      config,
    );
    expect(breakdown.needsManualGrading).toBe(true);
    expect(breakdown.rawTotal).toBe(0);
    // Unjudged work is neither right nor wrong.
    expect(breakdown.correctAnswers).toBe(0);
    expect(breakdown.incorrectAnswers).toBe(0);
    expect(breakdown.answeredQuestions).toBe(1);
  });

  it('ignores answers that reference a question not on the exam', () => {
    const breakdown = scoreAttempt(
      [mc('q1', 10, ['a'])],
      [
        { answerId: 'a1', questionId: 'q1', selectedOptionIds: '["a"]' },
        { answerId: 'rogue', questionId: 'q-not-on-exam', selectedOptionIds: '["a"]' },
      ],
      config,
    );
    expect(breakdown.rawTotal).toBe(10);
    // The stray answer is not silently scored or counted.
    expect(breakdown.answerScores.map((s) => s.answerId)).toEqual(['a1']);
  });

  it('supports multiple-select with a negative rate producing a negative raw total', () => {
    const multi: CalculableQuestion = {
      questionId: 'q1',
      type: 'MULTIPLE_SELECT',
      points: 20,
      options: [option('a', true), option('b', true), option('c', false)],
    };
    const breakdown = scoreAttempt([multi], [{ answerId: 'a1', questionId: 'q1', selectedOptionIds: '["c"]' }], {
      ...config,
      negativeMarkingRate: 0.5,
    });
    expect(breakdown.rawTotal).toBe(-10);
  });
});

describe('computeResultMetrics', () => {
  it('clamps a negative raw total to 0 rather than reporting negative marks', () => {
    const metrics = computeResultMetrics(-30, { totalMarks: 100, passingMarks: 40 });
    expect(metrics.score).toBe(0);
    expect(metrics.percentage).toBe(0);
    expect(metrics.passed).toBe(false);
  });

  it('clamps above maxScore', () => {
    const metrics = computeResultMetrics(150, { totalMarks: 100, passingMarks: 40 });
    expect(metrics.score).toBe(100);
    expect(metrics.percentage).toBe(100);
    expect(metrics.passed).toBe(true);
  });

  it('rounds the percentage to 2dp', () => {
    expect(computeResultMetrics(1, { totalMarks: 3, passingMarks: 0 }).percentage).toBe(33.33);
  });

  it('returns 0 percentage when maxScore is 0 instead of dividing by zero', () => {
    const metrics = computeResultMetrics(5, { totalMarks: 0, passingMarks: 0 });
    expect(metrics.percentage).toBe(0);
    expect(metrics.score).toBe(0);
  });

  it('treats score >= passingMarks as a pass (boundary is inclusive)', () => {
    expect(computeResultMetrics(40, { totalMarks: 100, passingMarks: 40 }).passed).toBe(true);
    expect(computeResultMetrics(39.99, { totalMarks: 100, passingMarks: 40 }).passed).toBe(false);
  });

  it('agrees with scoreAttempt end-to-end for a realistic attempt', () => {
    const questions = [mc('q1', 30, ['a']), mc('q2', 30, ['a']), mc('q3', 40, ['a'])];
    const answers = [
      { answerId: 'a1', questionId: 'q1', selectedOptionIds: '["a"]' },
      { answerId: 'a2', questionId: 'q2', selectedOptionIds: '["a"]' },
      { answerId: 'a3', questionId: 'q3', selectedOptionIds: '["b"]' },
    ];
    const breakdown = scoreAttempt(questions, answers, config);
    const metrics = computeResultMetrics(breakdown.rawTotal, config);
    expect(metrics.score).toBe(60);
    expect(metrics.percentage).toBe(60);
    expect(metrics.passed).toBe(true);
  });
});

describe('isAnswerPopulated', () => {
  it.each([
    ['["a"]', null, true],
    ['[]', null, false],
    ['not-json', null, false],
    ['', 'text', true],
    ['', '   ', false],
    ['', null, false],
  ])('selectedOptionIds=%s answerText=%s -> %s', (selected, text, expected) => {
    expect(isAnswerPopulated({ selectedOptionIds: selected as string, answerText: text as string | null })).toBe(expected);
  });

  it('is false for a null answer', () => {
    expect(isAnswerPopulated(null)).toBe(false);
  });

  // MATCHING and ESSAY answers are stored as a JSON document rather than as
  // option ids or free text. ExamSessionsService and MonitoringService already
  // counted those as answered; the scorer did not, so a student's live progress
  // and their result disagreed about the same question.
  it.each([
    ['{"left":"a","right":"b"}', true],
    ['[["a","b"]]', true],
    ['{"left":null}', true],
    ['"essay text"', true],
    ['{}', false],
    ['[]', false],
    ['null', false],
    ['', false],
    ['   ', false],
    ['{ not json', true],
  ])('answerJson=%s -> %s', (json, expected) => {
    expect(
      isAnswerPopulated({ selectedOptionIds: '[]', answerText: null, answerJson: json as string }),
    ).toBe(expected);
  });

  it('treats an option-based answer as answered even when answerJson is empty', () => {
    expect(isAnswerPopulated({ selectedOptionIds: '["a"]', answerText: null, answerJson: '{}' })).toBe(true);
  });
});

describe('selectOfficialResults', () => {
  const row = (id: string, studentId: string, examId: string, percentage: number, attemptNumber: number) => ({
    id,
    studentId,
    examId,
    percentage,
    startedAt: new Date(2026, 0, 1, 9, 0),
    submittedAt: new Date(2026, 0, 1, 10, 0),
    attemptNumber,
  });

  it('keeps one best attempt per student', () => {
    const official = selectOfficialResults([
      row('a1', 's1', 'e1', 40, 1),
      row('a2', 's1', 'e1', 90, 2),
      row('a3', 's1', 'e1', 60, 3),
    ]);
    expect(official.map((r) => r.id)).toEqual(['a2']);
  });

  it('keeps one attempt per student per exam, not one per student overall', () => {
    // The official attempt is per exam: a good result on one exam must not
    // stand in for the student's result on a different exam.
    const official = selectOfficialResults([
      row('x1', 's1', 'e1', 95, 1),
      row('x2', 's1', 'e2', 30, 1),
      row('x3', 's2', 'e1', 50, 1),
    ]);
    expect(official.map((r) => r.id).sort()).toEqual(['x1', 'x2', 'x3']);
  });

  it('treats a query already scoped to one exam as before', () => {
    const official = selectOfficialResults([
      { id: 'y1', studentId: 's1', percentage: 20, submittedAt: new Date(), attemptNumber: 1 },
      { id: 'y2', studentId: 's1', percentage: 80, submittedAt: new Date(), attemptNumber: 2 },
    ]);
    expect(official.map((r) => r.id)).toEqual(['y2']);
  });

  it('returns an empty array for no rows', () => {
    expect(selectOfficialResults([])).toEqual([]);
  });
});

describe('selectBestAttempt', () => {
  const at = (percentage: number, minutes: number, day: number, attemptNumber: number) => ({
    id: `r${percentage}-${attemptNumber}`,
    percentage,
    durationMinutes: minutes,
    submittedAt: new Date(2026, 0, day),
    attemptNumber,
  });

  it('returns null for no attempts', () => {
    expect(selectBestAttempt([])).toBeNull();
  });

  it('picks the highest percentage', () => {
    expect(selectBestAttempt([at(40, 10, 1, 1), at(80, 5, 2, 2), at(60, 30, 3, 3)])?.percentage).toBe(80);
  });

  it('prefers the longer attempt when percentages tie', () => {
    expect(selectBestAttempt([at(70, 10, 1, 1), at(70, 40, 2, 2)])?.durationMinutes).toBe(40);
  });

  it('falls back to the earliest submission when percentage and effort tie', () => {
    expect(selectBestAttempt([at(70, 20, 5, 3), at(70, 20, 2, 2)])?.submittedAt.getDate()).toBe(2);
  });

  it('is deterministic when everything ties', () => {
    const a = at(70, 20, 2, 2);
    const b = at(70, 20, 2, 2);
    expect(selectBestAttempt([a, b])?.attemptNumber).toBe(2);
    expect(selectBestAttempt([b, a])?.attemptNumber).toBe(2);
  });

  it('does not mutate its input', () => {
    const input = [at(40, 10, 1, 1), at(80, 5, 2, 2)];
    const copy = [...input];
    selectBestAttempt(input);
    expect(input).toEqual(copy);
  });
});
