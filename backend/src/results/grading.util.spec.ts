import { computeLetterGrade, GRADE_LETTERS, isGradeLetter, roundPercentage } from './grading.util';

describe('grading.util', () => {
  describe('computeLetterGrade', () => {
    it('maps percentage bands to the expected letters', () => {
      expect(computeLetterGrade(100)).toBe('A');
      expect(computeLetterGrade(90)).toBe('A');
      expect(computeLetterGrade(89.99)).toBe('B');
      expect(computeLetterGrade(80)).toBe('B');
      expect(computeLetterGrade(79.99)).toBe('C');
      expect(computeLetterGrade(70)).toBe('C');
      expect(computeLetterGrade(69.99)).toBe('D');
      expect(computeLetterGrade(60)).toBe('D');
      expect(computeLetterGrade(59.99)).toBe('F');
      expect(computeLetterGrade(0)).toBe('F');
    });

    it('never returns a letter outside the allowed set', () => {
      for (let pct = -10; pct <= 120; pct += 0.5) {
        expect(GRADE_LETTERS).toContain(computeLetterGrade(pct));
      }
    });

    it('is monotonic: a higher percentage never yields a lower letter', () => {
      // GRADE_LETTERS runs best-to-worst, so rank is negated to make higher
      // grades compare as larger numbers.
      const rank = (letter: string) => -GRADE_LETTERS.indexOf(letter as (typeof GRADE_LETTERS)[number]);
      let previous = rank(computeLetterGrade(0));
      for (let pct = 0; pct <= 100; pct += 0.25) {
        const current = rank(computeLetterGrade(pct));
        expect(current).toBeGreaterThanOrEqual(previous);
        previous = current;
      }
    });

    it('treats non-finite input as zero rather than throwing', () => {
      expect(computeLetterGrade(Number.NaN)).toBe('F');
      expect(computeLetterGrade(Number.POSITIVE_INFINITY)).toBe('F');
      expect(computeLetterGrade(Number.NEGATIVE_INFINITY)).toBe('F');
    });
  });

  describe('isGradeLetter', () => {
    it('accepts every supported letter and rejects anything else', () => {
      for (const letter of GRADE_LETTERS) {
        expect(isGradeLetter(letter)).toBe(true);
      }
      expect(isGradeLetter('a')).toBe(false);
      expect(isGradeLetter('AA')).toBe(false);
      expect(isGradeLetter('')).toBe(false);
      expect(isGradeLetter(null)).toBe(false);
      expect(isGradeLetter(undefined)).toBe(false);
      expect(isGradeLetter(1)).toBe(false);
    });
  });

  describe('roundPercentage', () => {
    it('rounds to two decimals', () => {
      expect(roundPercentage(1, 3)).toBe(33.33);
      expect(roundPercentage(2, 3)).toBe(66.67);
      expect(roundPercentage(10, 10)).toBe(100);
      expect(roundPercentage(0, 10)).toBe(0);
    });

    it('returns 0 when the exam has no usable maximum', () => {
      expect(roundPercentage(5, 0)).toBe(0);
      expect(roundPercentage(5, -1)).toBe(0);
      expect(roundPercentage(5, Number.NaN)).toBe(0);
    });

    it('agrees with computeLetterGrade at the D/F boundary', () => {
      // The D band starts at 60%: 12/20 lands on D, 11/20 falls through to F.
      expect(roundPercentage(12, 20)).toBe(60);
      expect(computeLetterGrade(roundPercentage(12, 20))).toBe('D');
      expect(roundPercentage(11, 20)).toBe(55);
      expect(computeLetterGrade(roundPercentage(11, 20))).toBe('F');
    });
  });
});
