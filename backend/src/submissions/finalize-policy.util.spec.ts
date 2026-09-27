import { SessionStatus, SubmissionReason } from '@prisma/client';
import {
  classifySubmission,
  isPastExpiry,
  isUniqueConstraintCollision,
  SYSTEM_SUBMISSION_REASONS,
} from './finalize-policy.util';

/**
 * Scenario matrix for attempt finalisation (rows A-D and F-K of the
 * submission/expiry test plan). These are the rules that decide whether an
 * attempt counts as on time, and they are the ones that were previously derived
 * from client input.
 */

const NOW = new Date('2026-03-01T12:00:00.000Z');
const at = (iso: string) => new Date(iso);
const before = (ms: number) => new Date(NOW.getTime() - ms);
const after = (ms: number) => new Date(NOW.getTime() + ms);

describe('isPastExpiry', () => {
  it('is false while time remains', () => {
    expect(isPastExpiry(after(1000), NOW)).toBe(false);
  });

  it('is true once the deadline has passed', () => {
    expect(isPastExpiry(before(1000), NOW)).toBe(true);
  });

  it('is false exactly at the deadline (inclusive)', () => {
    expect(isPastExpiry(NOW, NOW)).toBe(false);
  });

  it('treats a missing deadline as past due rather than open-ended', () => {
    expect(isPastExpiry(null, NOW)).toBe(true);
    expect(isPastExpiry(undefined, NOW)).toBe(true);
  });
});

describe('classifySubmission', () => {
  it('A: records a student submit inside the window as an on-time manual submission', () => {
    expect(classifySubmission({ expiresAt: after(60_000), now: NOW })).toEqual({
      reason: SubmissionReason.MANUAL_SUBMIT,
      autoSubmitted: false,
      sessionStatus: SessionStatus.SUBMITTED,
    });
  });

  it('B: records a student submit after the deadline as an automatic submission', () => {
    expect(classifySubmission({ expiresAt: before(1), now: NOW })).toEqual({
      reason: SubmissionReason.AUTO_TIME_EXPIRY,
      autoSubmitted: true,
      sessionStatus: SessionStatus.AUTO_SUBMITTED,
    });
  });

  it('C: a staff force-submit is recorded as automatic even inside the window', () => {
    expect(
      classifySubmission({
        expiresAt: after(60_000),
        now: NOW,
        requestedReason: SubmissionReason.AUTO_FORCE_SUBMIT,
      }),
    ).toEqual({
      reason: SubmissionReason.AUTO_FORCE_SUBMIT,
      autoSubmitted: true,
      sessionStatus: SessionStatus.AUTO_SUBMITTED,
    });
  });

  it('D: preserves each distinct staff/system reason', () => {
    const reasons = [
      SubmissionReason.AUTO_EXAM_ENDED,
      SubmissionReason.AUTO_INSTRUCTOR_END_SESSION,
      SubmissionReason.AUTO_ADMIN_FORCE_SUBMIT,
      SubmissionReason.AUTO_TIME_EXPIRY,
    ];
    for (const reason of reasons) {
      const out = classifySubmission({ expiresAt: after(60_000), now: NOW, requestedReason: reason });
      expect(out.reason).toBe(reason);
      expect(out.autoSubmitted).toBe(true);
    }
  });

  it('never downgrades a system reason to MANUAL_SUBMIT', () => {
    expect(SYSTEM_SUBMISSION_REASONS.has(SubmissionReason.MANUAL_SUBMIT)).toBe(false);
    for (const reason of SYSTEM_SUBMISSION_REASONS) {
      expect(classifySubmission({ expiresAt: after(1), now: NOW, requestedReason: reason }).autoSubmitted).toBe(true);
    }
  });

  it('an explicit MANUAL_SUBMIT request is still subject to the expiry check', () => {
    expect(
      classifySubmission({
        expiresAt: before(1),
        now: NOW,
        requestedReason: SubmissionReason.MANUAL_SUBMIT,
      }).reason,
    ).toBe(SubmissionReason.AUTO_TIME_EXPIRY);
  });

  it('grades an expired attempt rather than rejecting it', () => {
    // The classification only decides *how it is recorded*; the attempt is still
    // scored. Rejecting here would lose the student's work entirely.
    const out = classifySubmission({ expiresAt: at('2020-01-01T00:00:00.000Z'), now: NOW });
    expect(out.sessionStatus).toBe(SessionStatus.AUTO_SUBMITTED);
  });
});

describe('isUniqueConstraintCollision', () => {
  it('detects a Prisma P2002', () => {
    expect(isUniqueConstraintCollision({ code: 'P2002' })).toBe(true);
  });

  it('rejects other Prisma error codes', () => {
    expect(isUniqueConstraintCollision({ code: 'P2025' })).toBe(false);
    expect(isUniqueConstraintCollision({ code: 'P2003' })).toBe(false);
  });

  it('rejects non-errors and null-prototype values', () => {
    expect(isUniqueConstraintCollision(null)).toBe(false);
    expect(isUniqueConstraintCollision(undefined)).toBe(false);
    expect(isUniqueConstraintCollision('P2002')).toBe(false);
    expect(isUniqueConstraintCollision(new Error('Unique constraint failed'))).toBe(false);
  });

  it('rejects an object whose code is not a string', () => {
    expect(isUniqueConstraintCollision({ code: 2002 })).toBe(false);
  });
});
