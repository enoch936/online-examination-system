import { clampScore, distributePoints, gradeQuestion, round2, sameSet } from './scoring.util';

describe('scoring.util', () => {
  describe('distributePoints', () => {
    it('20 questions over 100 marks -> 5 each, sum exactly 100', () => {
      const points = distributePoints(100, 20);
      expect(points).toHaveLength(20);
      expect(points.every((p) => p === 5)).toBe(true);
      expect(points.reduce((a, b) => a + b, 0)).toBe(100);
    });

    it('3 questions over 100 marks -> 34 + 33 + 33, sum exactly 100', () => {
      const points = distributePoints(100, 3);
      expect([...points].sort((a, b) => a - b)).toEqual([33, 33, 34]);
      expect(points.reduce((a, b) => a + b, 0)).toBe(100);
    });

    it('4 questions over 10 marks -> 3 + 3 + 2 + 2, sum exactly 10', () => {
      const points = distributePoints(10, 4);
      expect([...points].sort((a, b) => a - b)).toEqual([2, 2, 3, 3]);
      expect(points.reduce((a, b) => a + b, 0)).toBe(10);
    });

    it('summary invariant: sum(points) === totalMarks for many sizes', () => {
      for (let total = 1; total <= 200; total++) {
        for (let count = 1; count <= 60; count++) {
          const points = distributePoints(total, count);
          expect(points).toHaveLength(count);
          expect(points.reduce((a, b) => a + b, 0)).toBe(total);
          expect(points.every((p) => p >= 0)).toBe(true);
        }
      }
    });

    it('zero or negative count -> empty', () => {
      expect(distributePoints(100, 0)).toEqual([]);
      expect(distributePoints(100, -3)).toEqual([]);
    });
  });

  describe('gradeQuestion (negative marking)', () => {
    const opts = (
      defs: Array<{ id: string; text: string; isCorrect: boolean }> = [
        { id: 'a', text: 'A', isCorrect: true },
        { id: 'b', text: 'B', isCorrect: false },
        { id: 'c', text: 'C', isCorrect: false },
      ],
    ) => defs;

    it('correct multiple choice earns full points even with negative marking', () => {
      const out = gradeQuestion({
        type: 'MULTIPLE_CHOICE',
        points: 5,
        options: opts(),
        answer: { selectedOptionIds: JSON.stringify(['a']) },
        negativeMarkingRate: 0.25,
      });
      expect(out.score).toBe(5);
      expect(out.needsManualGrading).toBe(false);
    });

    it('wrong answered question loses points * rate', () => {
      const out = gradeQuestion({
        type: 'MULTIPLE_CHOICE',
        points: 5,
        options: opts(),
        answer: { selectedOptionIds: JSON.stringify(['b']) },
        negativeMarkingRate: 0.25,
      });
      expect(out.score).toBe(-1.25);
    });

    it('no negative marking and wrong answer -> 0', () => {
      const out = gradeQuestion({
        type: 'MULTIPLE_CHOICE',
        points: 5,
        options: opts(),
        answer: { selectedOptionIds: JSON.stringify(['b']) },
        negativeMarkingRate: 0,
      });
      expect(out.score).toBe(0);
    });

    it('unanswered question earns 0 (no penalty)', () => {
      const out = gradeQuestion({
        type: 'MULTIPLE_CHOICE',
        points: 5,
        options: opts(),
        answer: null,
        negativeMarkingRate: 0.25,
      });
      expect(out.score).toBe(0);
    });

    it('garbage selectedOptionIds is treated as unanswered (0)', () => {
      const out = gradeQuestion({
        type: 'MULTIPLE_SELECT',
        points: 5,
        options: opts(),
        answer: { selectedOptionIds: 'not-json' },
        negativeMarkingRate: 0.5,
      });
      expect(out.score).toBe(0);
    });

    it('fill-blank correct match earns points', () => {
      const out = gradeQuestion({
        type: 'FILL_BLANK',
        points: 4,
        options: [{ id: 'o1', text: 'Addis Ababa', isCorrect: true }],
        answer: { answerText: 'addis ababa' },
        negativeMarkingRate: 0.25,
      });
      expect(out.score).toBe(4);
    });

    it('fill-blank wrong answer with negative marking', () => {
      const out = gradeQuestion({
        type: 'FILL_BLANK',
        points: 4,
        options: [{ id: 'o1', text: 'Addis Ababa', isCorrect: true }],
        answer: { answerText: 'Lagos' },
        negativeMarkingRate: 0.25,
      });
      expect(out.score).toBe(-1);
    });

    it('manual grading types are flagged', () => {
      const out = gradeQuestion({
        type: 'ESSAY',
        points: 10,
        options: [],
        answer: { answerText: 'anything' },
        negativeMarkingRate: 0.25,
      });
      expect(out.score).toBe(0);
      expect(out.needsManualGrading).toBe(true);
    });
  });

  describe('clampScore + round2', () => {
    it('clamps below zero to 0', () => {
      expect(clampScore(-10, 100)).toBe(0);
    });

    it('clamps above max to max', () => {
      expect(clampScore(150, 100)).toBe(100);
    });

    it('keeps value inside bounds', () => {
      expect(clampScore(80, 100)).toBe(80);
    });

    it('rounds floating point noise', () => {
      expect(round2(0.1 + 0.2)).toBe(0.3);
      expect(clampScore(33.3333 + 33.3333 + 33.3334, 100)).toBe(100);
    });

    it('zero or negative maxScore -> 0', () => {
      expect(clampScore(50, 0)).toBe(0);
      expect(clampScore(50, -1)).toBe(0);
    });
  });

  describe('sameSet', () => {
    it('equality ignores order', () => {
      expect(sameSet(['a', 'b'], ['b', 'a'])).toBe(true);
      expect(sameSet(['a', 'b'], ['a', 'c'])).toBe(false);
      expect(sameSet(['a'], ['a', 'a'])).toBe(true);
    });
  });

  describe('20 questions at 80% scenario', () => {
    it('all-correct sums to 100 and passes 80', () => {
      const points = distributePoints(100, 20);
      const marks = points.map((p) =>
        gradeQuestion({
          type: 'MULTIPLE_CHOICE',
          points: p,
          options: [{ id: 'a', text: 'A', isCorrect: true }, { id: 'b', text: 'B', isCorrect: false }],
          answer: { selectedOptionIds: JSON.stringify(['a']) },
          negativeMarkingRate: 0,
        }).score,
      );
      const total = markRoundSafe(marks);
      expect(total).toBe(100);
      expect(total >= 80).toBe(true);
    });

    it('16/20 correct (80%) -> exactly 80', () => {
      const points = distributePoints(100, 20);
      const marks = points.map((p, i) =>
        gradeQuestion({
          type: 'MULTIPLE_CHOICE',
          points: p,
          options: [{ id: 'a', text: 'A', isCorrect: true }, { id: 'b', text: 'B', isCorrect: false }],
          answer: { selectedOptionIds: JSON.stringify([i < 16 ? 'a' : 'b']) },
          negativeMarkingRate: 0,
        }).score,
      );
      const total = markRoundSafe(marks);
      expect(total).toBe(80);
      expect(total >= 80).toBe(true);
    });

    it('15/20 correct (75%) -> 75, fails 80 alongside 0.25 negative rate keeps pass/fail sound', () => {
      const points = distributePoints(100, 20);
      const marks = points.map((p, i) =>
        gradeQuestion({
          type: 'MULTIPLE_CHOICE',
          points: p,
          options: [{ id: 'a', text: 'A', isCorrect: true }, { id: 'b', text: 'B', isCorrect: false }],
          answer: { selectedOptionIds: JSON.stringify([i < 15 ? 'a' : 'b']) },
          negativeMarkingRate: 0.25,
        }).score,
      );
      const total = markRoundSafe(marks);
      expect(total).toBe(75 - 25 * 0.25); // 68.75
      expect(total).toBeLessThan(80);
    });
  });
});

function markRoundSafe(marks: number[]): number {
  return marks.reduce((a, b) => round2(a + b), 0);
}