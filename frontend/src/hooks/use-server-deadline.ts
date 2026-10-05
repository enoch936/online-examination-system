'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { monitoringService } from '@/services/monitoring.service';

/**
 * Countdown derived from the server's deadline, not from a local number.
 *
 * `remainingSeconds` on a session is a snapshot the browser itself writes on
 * every autosave, and a countdown started from it drifts the moment the tab is
 * throttled or the device clock is changed. The authoritative source is the
 * persisted `expiresAt`, so:
 *
 *  - remaining time is always `expiresAt - now`;
 *  - the device clock is corrected with an offset measured against the server,
 *    so moving the system time cannot buy extra minutes;
 *  - a proctor's extension arrives over the socket and is applied immediately;
 *  - a periodic resync repairs any drift introduced by a sleeping laptop.
 *
 * The server remains the final authority on expiry — this only decides what the
 * student sees, and the backend re-checks `expiresAt` on every autosave and
 * submission regardless of what the browser believes.
 */
export function useServerDeadline(input: {
  sessionId?: string | null;
  /** ISO timestamp from the server. */
  expiresAt?: string | null;
  /**
   * Fallback used only before the first server value arrives, e.g. an exam whose
   * duration is known but whose session payload has not loaded yet.
   */
  fallbackSeconds?: number | null;
  onExpire?: () => void;
  /** How often to re-read the deadline from the server. */
  resyncMs?: number;
}) {
  const { sessionId, expiresAt, fallbackSeconds, onExpire, resyncMs = 60000 } = input;

  const [deadline, setDeadline] = useState<number | null>(
    expiresAt ? new Date(expiresAt).getTime() : null,
  );
  const [offsetMs, setOffsetMs] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  // Anchor for the pre-server fallback countdown; reset only when the exam
  // duration itself changes, so the display does not jump mid-exam.
  const [fallbackAnchor, setFallbackAnchor] = useState(() => Date.now());
  const lastFallbackRef = useRef(fallbackSeconds);
  useEffect(() => {
    if (fallbackSeconds !== lastFallbackRef.current) {
      lastFallbackRef.current = fallbackSeconds;
      setFallbackAnchor(Date.now());
    }
  }, [fallbackSeconds]);

  useEffect(() => {
    if (expiresAt) setDeadline(new Date(expiresAt).getTime());
  }, [expiresAt]);

  // Tick on the wall clock, corrected by the measured server offset.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, []);

  const resync = useCallback(async () => {
    if (!sessionId) return;
    try {
      const data = await monitoringService.deadline(sessionId);
      if (!data) return;
      if (data.expiresAt) {
        const serverDeadline = new Date(data.expiresAt).getTime();
        setDeadline(serverDeadline);
        // If the server still reports time left, the offset between this device's
        // clock and the server's is measurable; measuring it is what stops a
        // changed system clock from extending an exam locally.
        if (data.remainingSeconds != null) {
          const expected = Date.now() + data.remainingSeconds * 1000;
          const measured = serverDeadline - expected;
          if (Number.isFinite(measured) && Math.abs(measured) < 60 * 60_000) {
            setOffsetMs(measured);
          }
        }
      } else {
        setDeadline(null);
      }
      setNow(Date.now());
    } catch {
      /* keep the current deadline; the next tick or submit re-checks the server */
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    void resync();
    const timer = window.setInterval(() => void resync(), resyncMs);
    return () => window.clearInterval(timer);
  }, [resync, resyncMs, sessionId]);

  /**
   * Apply a deadline pushed over the socket by a proctor. No round trip is
   * needed because the payload carries the server's own `expiresAt`.
   */
  const applyRemoteDeadline = useCallback((remoteExpiresAt?: string | null, remainingSeconds?: number) => {
    if (remoteExpiresAt) {
      setDeadline(new Date(remoteExpiresAt).getTime());
    } else if (typeof remainingSeconds === 'number') {
      setDeadline(Date.now() + remainingSeconds * 1000);
    }
    setNow(Date.now());
    // A grant means time is on the clock again.
    expiredRef.current = false;
  }, []);

  const seconds = useMemo(() => {
    if (deadline != null) {
      return Math.max(0, Math.round((deadline - (now + offsetMs)) / 1000));
    }
    // Before the server deadline is known, count down from the duration the exam
    // advertises. This is display-only: the backend still computes the real
    // deadline from `expiresAt`, so nothing is decided by this number.
    if (fallbackSeconds == null) return 0;
    const elapsed = Math.floor((now - fallbackAnchor) / 1000);
    return Math.max(0, Math.round(fallbackSeconds - elapsed));
  }, [deadline, fallbackAnchor, fallbackSeconds, now, offsetMs]);

  useEffect(() => {
    if (deadline == null) return;
    if (seconds > 0) {
      expiredRef.current = false;
      return;
    }
    if (expiredRef.current) return;
    expiredRef.current = true;
    onExpireRef.current?.();
  }, [deadline, seconds]);

  return {
    /** Whole seconds left on the authoritative deadline. */
    seconds,
    /** The server's deadline as an ISO string, for display. */
    expiresAt: deadline != null ? new Date(deadline).toISOString() : null,
    /** Measured difference between this device's clock and the server's. */
    clockSkewMs: offsetMs,
    applyRemoteDeadline,
    resync,
  };
}