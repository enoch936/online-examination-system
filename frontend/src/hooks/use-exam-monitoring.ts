'use client';

import { useCallback, useEffect, useRef } from 'react';
import { getSocket } from '@/services/socket.service';

export type ProctorControl =
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'extend'; minutes: number; remainingSeconds: number }
  | { type: 'force-submit' }
  | { type: 'disconnect' }
  | { type: 'warning'; title?: string; message: string }
  | { type: 'message'; title?: string; message: string };

export function useExamMonitoring(input: {
  examId: string;
  sessionId: string;
  remainingSeconds: number;
  onControl?: (control: ProctorControl) => void;
}) {
  const { examId, sessionId, remainingSeconds, onControl } = input;
  const onControlRef = useRef(onControl);
  onControlRef.current = onControl;
  const remainingRef = useRef(remainingSeconds);
  remainingRef.current = remainingSeconds;

  const reportViolation = useCallback(
    (type: string, severity = 1) => {
      if (!sessionId) return;
      getSocket().emit('exam:violation', { examId, sessionId, type, severity });
    },
    [examId, sessionId],
  );

  const reportEvent = useCallback(
    (type: string, metadata?: Record<string, unknown>) => {
      if (!sessionId) return;
      getSocket().emit('exam:event', { sessionId, type, metadata });
    },
    [sessionId],
  );

  useEffect(() => {
    if (!sessionId) return;
    const socket = getSocket();

    // Rejoin the session room on every (re)connect. Socket.IO rooms are
    // per-connection, so a reconnect silently loses room membership and
    // exam:control events would otherwise be dropped.
    const joinSession = () => {
      if (!socket.connected) return;
      socket.emit('exam:join', { sessionId });
    };
    socket.connect();
    socket.on('connect', joinSession);
    joinSession();

    const heartbeat = window.setInterval(() => {
      socket.emit('exam:heartbeat', { sessionId, remainingSeconds: remainingRef.current });
    }, 10000);

    const onControl = (control: ProctorControl) => onControlRef.current?.(control);
    socket.on('exam:control', onControl);

    const onBlur = () => reportViolation('WINDOW_BLUR', 1);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') reportViolation('TAB_SWITCH', 2);
    };
    const onFullscreen = () => {
      if (!document.fullscreenElement) reportViolation('FULLSCREEN_EXIT', 2);
    };
    const onCopy = (e: ClipboardEvent) => {
      reportEvent('COPY_ATTEMPT', { length: e.clipboardData?.getData('text/plain')?.length ?? 0 });
    };
    const onPaste = () => reportEvent('PASTE_ATTEMPT', {});
    const onCut = () => reportEvent('CUT_ATTEMPT', {});
    const onContextMenu = () => reportEvent('CONTEXT_MENU_ATTEMPT', {});
    const onBeforePrint = () => reportEvent('PRINT_ATTEMPT', {});
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen' || e.key === 'F12') {
        reportEvent('SHORTCUT_ATTEMPT', { key: e.key });
        return;
      }
      if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'p', 's', 'u', 'a'].includes(e.key.toLowerCase())) {
        reportEvent('SHORTCUT_ATTEMPT', { key: e.key.toLowerCase() });
      }
    };

    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('fullscreenchange', onFullscreen);
    document.addEventListener('copy', onCopy);
    document.addEventListener('paste', onPaste);
    document.addEventListener('cut', onCut);
    document.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('keydown', onKeyDown, true);

    return () => {
      window.clearInterval(heartbeat);
      socket.off('exam:control', onControl);
      socket.off('connect', joinSession);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('fullscreenchange', onFullscreen);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('cut', onCut);
      document.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [reportEvent, reportViolation, sessionId]);

  return { reportEvent, reportViolation };
}
