/**
 * Session states in which extra time still means something. A session that has
 * already been submitted (manually or by the auto-submit sweep) is terminal:
 * extending it would rewrite history and emit a TIME_EXTENDED event for an
 * attempt that no longer has a running clock.
 */
export const EXTENDABLE_SESSION_STATUSES = ['IN_PROGRESS', 'PAUSED'] as const;

export const EXTEND_REQUIRES_ACTIVE_SESSION =
  'Time can only be extended while the session is in progress or paused';

export function isExtendableSession(session: {
  status: string;
  submittedAt: Date | null;
}): boolean {
  if (session.submittedAt) return false;
  return (EXTENDABLE_SESSION_STATUSES as readonly string[]).includes(session.status);
}

/**
 * Compute the new authoritative expiry for a time extension.
 *
 * `expiresAt` is the only trustworthy clock: `remainingSeconds` is written by
 * the client on every autosave (see ExamSessionsService.saveAnswer), so basing
 * the addition on it let a tampered value inflate the grant. When the stored
 * expiry has already lapsed — the session is still IN_PROGRESS because the
 * auto-submit sweep has not reached it yet, which is exactly the case a proctor
 * is rescuing — the grant is measured from `now` instead of from the stale
 * expiry, so the student receives the minutes that were granted rather than
 * time that is already in the past.
 */
export function computeTimeExtension(params: {
  expiresAt: Date | null;
  minutes: number;
  now?: Date;
}): { expiresAt: Date; remainingSeconds: number } {
  const { expiresAt, minutes, now = new Date() } = params;
  const baseMs = expiresAt && expiresAt.getTime() > now.getTime() ? expiresAt.getTime() : now.getTime();
  const addedMs = Math.round(minutes * 60_000);
  const nextMs = baseMs + addedMs;
  return {
    expiresAt: new Date(nextMs),
    remainingSeconds: Math.round((nextMs - now.getTime()) / 1000),
  };
}
