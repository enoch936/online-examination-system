export const OPTION_BASED_QUESTION_TYPES = new Set(['MULTIPLE_CHOICE', 'MULTIPLE_SELECT', 'TRUE_FALSE']);
export const TEXT_BASED_QUESTION_TYPES = new Set(['FILL_BLANK', 'SHORT_ANSWER']);

export interface ScorableOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface ScorableAnswer {
  selectedOptionIds?: string | null;
  answerText?: string | null;
}

export interface GradeQuestionInput {
  type: string;
  points: number;
  options: ScorableOption[];
  answer?: ScorableAnswer | null;
  negativeMarkingRate: number;
}

export interface GradeQuestionOutput {
  score: number;
  needsManualGrading: boolean;
}

/** Round to two decimal places to avoid floating point noise. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Distribute `totalMarks` across `count` questions so that the sum of all points
 * equals `totalMarks` exactly. The largest questions get at most one extra mark.
 *
 * e.g. 20 questions, 100 marks -> 5 × 20
 *      3 questions, 100 marks  -> 34 + 33 + 33
 *      4 questions, 10 marks   -> 3 + 3 + 2 + 2
 */
export function distributePoints(totalMarks: number, count: number): number[] {
  const n = Math.max(0, Math.trunc(count));
  if (n === 0) return [];
  const base = Math.floor(totalMarks / n);
  const remainder = totalMarks - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0));
}

/** Compare two sets ignoring order and duplicates. */
export function sameSet(left: string[], right: string[]): boolean {
  const l = Array.from(new Set(left)).sort();
  const r = Array.from(new Set(right)).sort();
  return l.length === r.length && l.every((value, index) => value === r[index]);
}

/**
 * Grade a single answer.
 *
 * - Correct answer earns the question points (+points)
 * - Wrong but answered answer loses `points * negativeMarkingRate` (negative marking)
 * - Unanswered earns 0 (no penalty, no reward)
 * - Manual review types always need a human grader
 */
export function gradeQuestion(input: GradeQuestionInput): GradeQuestionOutput {
  const points = Number(input.points) || 0;
  const rate = Math.max(0, Number(input.negativeMarkingRate) || 0);
  const answer = input.answer;

  if (OPTION_BASED_QUESTION_TYPES.has(input.type)) {
    let selected: string[] = [];
    try {
      const parsed = JSON.parse(answer?.selectedOptionIds ?? '[]');
      if (Array.isArray(parsed)) selected = parsed.map(String);
    } catch {
      selected = [];
    }
    const correctIds = input.options
      .filter((option) => option.isCorrect)
      .map((option) => option.id)
      .sort();
    selected.sort();
    if (sameSet(correctIds, selected)) {
      return { score: round2(points), needsManualGrading: false };
    }
    if (selected.length === 0) {
      return { score: 0, needsManualGrading: false };
    }
    return { score: round2(-points * rate), needsManualGrading: false };
  }

  if (TEXT_BASED_QUESTION_TYPES.has(input.type)) {
    const correctAnswers = input.options
      .filter((option) => option.isCorrect)
      .map((option) => option.text.toLowerCase().trim());
    const studentAnswer = (answer?.answerText ?? '').toLowerCase().trim();
    if (!studentAnswer) {
      return { score: 0, needsManualGrading: false };
    }
    const correct = correctAnswers.some((ca) => studentAnswer.includes(ca) || ca.includes(studentAnswer));
    if (correct) {
      return { score: round2(points), needsManualGrading: false };
    }
    return { score: round2(-points * rate), needsManualGrading: false };
  }

  return { score: 0, needsManualGrading: true };
}

/** Clamp the raw accumulated score into [0, maxScore] and round to 2 decimals. */
export function clampScore(rawScore: number, maxScore: number): number {
  if (!(maxScore > 0)) return 0;
  return round2(Math.min(Math.max(rawScore, 0), maxScore));
}