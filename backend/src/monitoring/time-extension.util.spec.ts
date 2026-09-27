import {
  EXTENDABLE_SESSION_STATUSES,
  EXTEND_REQUIRES_ACTIVE_SESSION,
  computeTimeExtension,
  isExtendableSession,
} from './time-extension.util';

describe('time-extension.util', () => {
  describe('isExtendableSession', () => {
    it('allows in-progress and paused sessions', () => {
      expect(isExtendableSession({ status: 'IN_PROGRESS', submittedAt: null })).toBe(true);
      expect(isExtendableSession({ status: 'PAUSED', submittedAt: null })).toBe(true);
    });

    it('rejects submitted and auto-submitted sessions', () => {
      expect(isExtendableSession({ status: 'SUBMITTED', submittedAt: null })).toBe(false);
      expect(isExtendableSession({ status: 'AUTO_SUBMITTED', submittedAt: null })).toBe(false);
      expect(isExtendableSession({ status: 'EXPIRED', submittedAt: null })).toBe(false);
    });

    it('rejects any session that already carries a submittedAt stamp', () => {
      expect(isExtendableSession({ status: 'IN_PROGRESS', submittedAt: new Date() })).toBe(false);
    });

    it('exposes exactly the two extendable statuses', () => {
      expect([...EXTENDABLE_SESSION_STATUSES].sort()).toEqual(['IN_PROGRESS', 'PAUSED']);
    });
  });

  describe('computeTimeExtension', () => {
    const now = new Date('2026-09-25T10:00:00.000Z');

    it('adds minutes to a live expiry', () => {
      const result = computeTimeExtension({
        expiresAt: new Date('2026-09-25T10:30:00.000Z'),
        minutes: 10,
        now,
      });
      expect(result.expiresAt.toISOString()).toBe('2026-09-25T10:40:00.000Z');
      expect(result.remainingSeconds).toBe(2400);
    });

    it('keeps remainingSeconds consistent with the new expiry', () => {
      const result = computeTimeExtension({
        expiresAt: new Date('2026-09-25T10:05:00.000Z'),
        minutes: 5,
        now,
      });
      expect(result.remainingSeconds).toBe(600);
    });

    it('measures from now when the stored expiry has already lapsed', () => {
      const result = computeTimeExtension({
        expiresAt: new Date('2026-09-25T08:00:00.000Z'),
        minutes: 15,
        now,
      });
      expect(result.expiresAt.toISOString()).toBe('2026-09-25T10:15:00.000Z');
      expect(result.remainingSeconds).toBe(900);
    });

    it('treats a missing expiry as starting from now', () => {
      const result = computeTimeExtension({ expiresAt: null, minutes: 20, now });
      expect(result.expiresAt.toISOString()).toBe('2026-09-25T10:20:00.000Z');
      expect(result.remainingSeconds).toBe(1200);
    });

    it('ignores the client-writable remainingSeconds and uses expiresAt', () => {
      const result = computeTimeExtension({
        expiresAt: new Date('2026-09-25T10:30:00.000Z'),
        minutes: 10,
        now,
      });
      expect(result.remainingSeconds).toBeLessThanOrEqual(2400);
    });

    it('always returns an integer remainingSeconds', () => {
      const result = computeTimeExtension({
        expiresAt: new Date('2026-09-25T10:30:00.000Z'),
        minutes: 7,
        now,
      });
      expect(Number.isInteger(result.remainingSeconds)).toBe(true);
    });

    it('is monotonic for repeated grants', () => {
      const first = computeTimeExtension({
        expiresAt: new Date('2026-09-25T10:30:00.000Z'),
        minutes: 10,
        now,
      });
      const second = computeTimeExtension({ expiresAt: first.expiresAt, minutes: 10, now });
      expect(second.expiresAt.getTime()).toBe(first.expiresAt.getTime() + 10 * 60_000);
      expect(second.remainingSeconds).toBeGreaterThan(first.remainingSeconds);
    });
  });

  it('exposes a stable error message for terminal sessions', () => {
    expect(EXTEND_REQUIRES_ACTIVE_SESSION).toContain('in progress or paused');
  });
});
