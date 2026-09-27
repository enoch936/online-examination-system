import { clampScore, gradeQuestion, round2, ScorableOption } from '../submissions/scoring.util';
import { roundPercentage } from './grading.util';

/**
 * Single authoritative implementation of every result metric the platform
 * reports (raw score, clamped score, max score, percentage and pass/fail).
 *
 * Historically these numbers were recomputed inline in `SubmissionsService`
 * (auto-grading on submit) and again in `ResultsService.gradeManually`, with the
 * two copies drifting apart. Every caller now derives its values from here so a
 * fix can never be applied to one path and forgotten in the other.
 */

/** The minimum shape required to score one question of an attempt. */
export interface CalculableQuestion {
  questionId: string;
  type: string;
  /** Per-exam mark allocation (`ExamQuestion.points`), not the question's default. */
  points: number;
  options: ScorableOption[];
}

/** The minimum shape required to score one stored answer. */
export interface CalculableAnswer {
  answerId: string;
  questionId: string;
  selectedOptionIds?: string | null;
  answerText?: string | null;
}

export interface AttemptScoringConfig {
  /** `Exam.totalMarks` — the ceiling a raw total is clamped into. */
  totalMarks: number;
  /** `Exam.passingMarks` — the pass threshold compared against the clamped score. */
  passingMarks: number;
  /** `Exam.negativeMarkingRate` as a 0..1 fraction. */
  negativeMarkingRate: number;
}

export interface AttemptScoreBreakdown {
  totalQuestions: number;
  answeredQuestions: number;
  unansweredQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  /**
   * Sum of the per-question scores *before* the [0, maxScore] clamp. Negative
   * marking can legitimately make this negative, and the final score is the
   * clamped value, so callers must not treat this as the reported score.
   */
  rawTotal: number;
  /** True when at least one question requires a human grader. */
  needsManualGrading: boolean;
  /** Per-answer scores to persist alongside the submission. */
  answerScores: Array<{ answerId: string; score: number }>;
}

export interface ResultMetrics {
  /** Final reported score, clamped into [0, maxScore]. */
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Whether a stored answer counts as answered. Shared by the attempt scorer and
 * the progress counters so "answered" can never mean two different things.
 */
export function isAnswerPopulated(answer: { selectedOptionIds?: string | null; answerText?: string | null } | null | undefined): boolean {
  if (!answer) return false;
  try {
    const selected = JSON.parse(answer.selectedOptionIds ?? '[]');
    if (Array.isArray(selected) && selected.length > 0) return true;
  } catch {
    /* unparseable payload is treated as "no options selected" */
  }
  return Boolean(answer.answerText && answer.answerText.trim().length > 0);
}

/**
 * Score a whole attempt question-by-question.
 *
 * Unanswered questions earn 0 with no penalty. Incorrect answers earn
 * `-points * negativeMarkingRate`, so `rawTotal` can be negative and is only
 * clamped once at the end by {@link computeResultMetrics}.
 */
export function scoreAttempt(
  questions: readonly CalculableQuestion[],
  answers: readonly CalculableAnswer[],
  config: AttemptScoringConfig,
): AttemptScoreBreakdown {
  const answerByQuestion = new Map(answers.map((answer) => [answer.questionId, answer]));
  const negativeMarkingRate = Math.max(0, toNumber(config.negativeMarkingRate));

  const answerScores: AttemptScoreBreakdown['answerScores'] = [];
  let answeredQuestions = 0;
  let correctAnswers = 0;
  let incorrectAnswers = 0;
  let needsManualGrading = false;
  let rawTotal = 0;

  for (const question of questions) {
    const answer = answerByQuestion.get(question.questionId) ?? null;
    const graded = gradeQuestion({
      type: question.type,
      points: toNumber(question.points),
      options: question.options ?? [],
      answer,
      negativeMarkingRate,
    });

    if (graded.needsManualGrading) {
      // Neither correct nor incorrect: nobody has judged it yet.
      needsManualGrading = true;
    } else {
      const answered = isAnswerPopulated(answer);
      if (answered) {
        // Correct/incorrect is about the student's response, not the mark
        // awarded. Counting "score < 0" would have reported a wrong answer as
        // neither correct nor incorrect whenever negative marking was disabled.
        if (graded.score >= toNumber(question.points)) correctAnswers += 1;
        else incorrectAnswers += 1;
      }
    }

    if (isAnswerPopulated(answer)) answeredQuestions += 1;
    rawTotal += graded.score;
    if (answer) answerScores.push({ answerId: answer.answerId, score: graded.score });
  }

  return {
    totalQuestions: questions.length,
    answeredQuestions,
    unansweredQuestions: Math.max(0, questions.length - answeredQuestions),
    correctAnswers,
    incorrectAnswers,
    rawTotal: round2(rawTotal),
    needsManualGrading,
    answerScores,
  };
}

/**
 * Turn a raw (possibly negative) total into the reported result metrics. This
 * is the only place the clamp, the percentage and the pass/fail decision are
 * computed, for both automatic and manual grading.
 */
export function computeResultMetrics(rawTotal: number, config: Pick<AttemptScoringConfig, 'totalMarks' | 'passingMarks'>): ResultMetrics {
  const maxScore = toNumber(config.totalMarks);
  const score = clampScore(toNumber(rawTotal), maxScore);
  return {
    score,
    maxScore,
    percentage: roundPercentage(score, maxScore),
    passed: score >= toNumber(config.passingMarks),
  };
}

/**
 * Best attempt for a student on an exam — the one that determines reported
 * analytics and certificate eligibility.
 *
 * Ordering is deliberate and must stay stable:
 * 1. highest score (a retake that improves the score is the official one)
 * 2. longest time spent (proves real effort over an abandoned better score)
 * 3. earliest submission (a deterministic, non-arbitrary tie-break)
 */
export function selectBestAttempt<T extends { percentage: number; durationMinutes?: number | null; submittedAt: Date; attemptNumber: number }>(
  attempts: readonly T[],
): T | null {
  if (attempts.length === 0) return null;
  return [...attempts].sort((a, b) => {
    const byPercentage = toNumber(b.percentage) - toNumber(a.percentage);
    if (byPercentage !== 0) return byPercentage;
    const byEffort = toNumber(b.durationMinutes) - toNumber(a.durationMinutes);
    if (byEffort !== 0) return byEffort;
    const byDate = a.submittedAt.getTime() - b.submittedAt.getTime();
    if (byDate !== 0) return byDate;
    return a.attemptNumber - b.attemptNumber;
  })[0];
}
