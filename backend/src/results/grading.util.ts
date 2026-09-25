export const GRADE_LETTERS = ['A', 'B', 'C', 'D', 'F'] as const;

export type GradeLetter = (typeof GRADE_LETTERS)[number];

/**
 * Grade bands are ordered from highest to lowest threshold. The first band whose
 * minimum is satisfied by the percentage wins, so the list must stay sorted desc.
 */
export const GRADE_BANDS: ReadonlyArray<{ min: number; letter: GradeLetter }> = [
  { min: 90, letter: 'A' },
  { min: 80, letter: 'B' },
  { min: 70, letter: 'C' },
  { min: 60, letter: 'D' },
  { min: 0, letter: 'F' },
];

export function computeLetterGrade(percentage: number): GradeLetter {
  const normalized = Number.isFinite(percentage) ? percentage : 0;
  return GRADE_BANDS.find((band) => normalized >= band.min)?.letter ?? 'F';
}

export function isGradeLetter(value: unknown): value is GradeLetter {
  return typeof value === 'string' && (GRADE_LETTERS as readonly string[]).includes(value);
}

export function roundPercentage(score: number, maxScore: number): number {
  if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) {
    return 0;
  }
  return Number(((score / maxScore) * 100).toFixed(2));
}
