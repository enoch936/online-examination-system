import { SessionStatus, SubmissionReason } from '@prisma/client';

/**
 * Pure decision logic for freezing an exam attempt.
 *
 * This is deliberately separated from `SubmissionsService` so the rules that
 * were previously wrong — "is this submission on time?", "does this error mean
 * somebody else already finalised this session?" — can be unit tested without
 * standing up the Nest dependency graph.
 */

export interface SubmissionClassification {
  reason: SubmissionReason;
  autoSubmitted: boolean;
  sessionStatus: SessionStatus;
}

/** Reasons a staff/system action can impose, as opposed to a student's own submit. */
export const SYSTEM_SUBMISSION_REASONS: ReadonlySet<SubmissionReason> = new Set<SubmissionReason>([
  SubmissionReason.AUTO_TIME_EXPIRY,
  SubmissionReason.AUTO_FORCE_SUBMIT,
  SubmissionReason.AUTO_EXAM_ENDED,
  SubmissionReason.AUTO_INSTRUCTOR_END_SESSION,
  SubmissionReason.AUTO_ADMIN_FORCE_SUBMIT,
]);

/**
 * A session with no `expiresAt` has no deadline to enforce, so it is treated as
 * already past due: an unbounded session is never "on time".
 */
export function isPastExpiry(expiresAt: Date | null | undefined, now: Date): boolean {
  if (!expiresAt) return true;
  return now.getTime() > expiresAt.getTime();
}

/**
 * Decides how a submission must be recorded.
 *
 * The `expiresAt` comparison is the whole point: expiry is a server-side fact,
 * so it is derived here and any client-supplied claim is ignored. A student who
 * submits a moment after the deadline still gets their attempt graded, but it is
 * filed as automatic so it can never be reported as an on-time submission.
 */
export function classifySubmission(input: {
  expiresAt: Date | null | undefined;
  now: Date;
  requestedReason?: SubmissionReason;
}): SubmissionClassification {
  const { expiresAt, now, requestedReason } = input;

  if (requestedReason && SYSTEM_SUBMISSION_REASONS.has(requestedReason)) {
    return {
      reason: requestedReason,
      autoSubmitted: true,
      sessionStatus: SessionStatus.AUTO_SUBMITTED,
    };
  }

  if (isPastExpiry(expiresAt, now)) {
    return {
      reason: SubmissionReason.AUTO_TIME_EXPIRY,
      autoSubmitted: true,
      sessionStatus: SessionStatus.AUTO_SUBMITTED,
    };
  }

  return {
    reason: SubmissionReason.MANUAL_SUBMIT,
    autoSubmitted: false,
    sessionStatus: SessionStatus.SUBMITTED,
  };
}

/**
 * True when a failed write lost a race on a unique constraint — i.e. another
 * request already inserted the row we were trying to create.
 *
 * Checked structurally rather than with `instanceof Prisma.PrismaClientKnownRequestError`
 * so it keeps working across Prisma client instances and stays unit testable.
 */
export function isUniqueConstraintCollision(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && code === 'P2002';
}
