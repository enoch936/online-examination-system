'use client';

import { useCallback, useEffect, useRef } from 'react';
import { getSocket } from '@/services/socket.service';

export type ProctorControl =
  | { type: 'pause'; approval?: boolean; reason?: string; message?: string }
  | { type: 'resume' }
  | { type: 'extend'; minutes: number; remainingSeconds: number }
  | { type: 'force-submit' }
  | { type: 'disconnect' }
  | { type: 'warning'; title?: string; message: string }
  | { type: 'message'; title?: string; message: string };

export function useExamMonitoring(input: {
  examId: string;
  sessionId: string;
  remainingSeconds?: number;
  onControl?: (control: ProctorControl) => void;
  restrictions?: {
    disableCopy?: boolean;
    disablePaste?: boolean;
    trackTabSwitches?: boolean;
    trackWindowBlur?: boolean;
    fullscreenPolicy?: string;
    strictness?: string;
    detectShortcuts?: boolean;
  } | null;
}) {
  const { examId, sessionId, onControl, restrictions } = input;
  const onControlRef = useRef(onControl);
  onControlRef.current = onControl;
  const restrictionsRef = useRef(restrictions);
  restrictionsRef.current = restrictions;

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
      // remainingSeconds is intentionally not sent: the server derives it
      // authoritatively from expiresAt/duration.
      socket.emit('exam:heartbeat', { sessionId });
    }, 10000);

    const onControl = (control: ProctorControl) => onControlRef.current?.(control);
    socket.on('exam:control', onControl);

    const onBlur = () => {
      reportViolation('WINDOW_BLUR', 1);
      reportEvent('WINDOW_BLURRED', {});
    };
    const onFocus = () => {
      reportEvent('WINDOW_FOCUSED', {});
      reportEvent('FOCUS_RESTORED', {});
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        reportViolation('TAB_SWITCH', 2);
        reportEvent('TAB_SWITCHED', {});
      }
    };
    const onFullscreen = () => {
      if (!document.fullscreenElement) {
        reportViolation('FULLSCREEN_EXIT', 2);
        reportEvent('FULLSCREEN_EXITED', {});
      } else {
        reportEvent('FULLSCREEN_ENTERED', {});
      }
    };
    const onCopy = (e: ClipboardEvent) => {
      if (restrictionsRef.current?.disableCopy ?? true) e.preventDefault();
      reportEvent('COPY_ATTEMPT', { length: e.clipboardData?.getData('text/plain')?.length ?? 0 });
    };
    const onCut = (e: ClipboardEvent) => {
      if (restrictionsRef.current?.disableCopy ?? true) e.preventDefault();
      reportEvent('CUT_ATTEMPT', {});
    };
    const onPaste = (e: ClipboardEvent) => {
      if (restrictionsRef.current?.disablePaste ?? true) e.preventDefault();
      reportEvent('PASTE_ATTEMPT', {});
    };
    const onContextMenu = (e: MouseEvent) => {
      if (restrictionsRef.current?.disableCopy ?? true) {
        e.preventDefault();
      }
      reportEvent('CONTEXT_MENU_ATTEMPT', {});
    };
    const onBeforePrint = (e: Event) => {
      e.preventDefault();
      reportEvent('PRINT_ATTEMPT', {});
    };
    const onMouseLeave = () => {
      reportEvent('WINDOW_BLURRED', { reason: 'mouseleave' });
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const ctrlOrMeta = e.ctrlKey || e.metaKey;
      const isDevTools =
        e.key === 'F12' ||
        (ctrlOrMeta && e.shiftKey && ['i', 'j', 'c'].includes(key)) ||
        (ctrlOrMeta && key === 'u');
      const isForbiddenShortcut =
        e.key === 'PrintScreen' ||
        isDevTools ||
        (ctrlOrMeta && ['p', 's'].includes(key));

      if (isForbiddenShortcut) {
        e.preventDefault();
        reportEvent('SHORTCUT_ATTEMPT', { key: e.key, combination: `${ctrlOrMeta ? 'Ctrl+' : ''}${e.key}` });
        return;
      }

      if (ctrlOrMeta && ['c', 'v', 'x', 'a'].includes(key)) {
        const disableCopy = restrictionsRef.current?.disableCopy ?? true;
        const disablePaste = restrictionsRef.current?.disablePaste ?? true;
        const blocked =
          (key === 'v' && disablePaste) ||
          ((key === 'c' || key === 'x' || key === 'a') && disableCopy);
        if (blocked) e.preventDefault();
        reportEvent('SHORTCUT_ATTEMPT', { key: e.key });
      }
    };

    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('fullscreenchange', onFullscreen);
    document.addEventListener('copy', onCopy);
    document.addEventListener('paste', onPaste);
    document.addEventListener('cut', onCut);
    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('mouseleave', onMouseLeave);
    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('keydown', onKeyDown, true);

    return () => {
      window.clearInterval(heartbeat);
      socket.off('exam:control', onControl);
      socket.off('connect', joinSession);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('fullscreenchange', onFullscreen);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('cut', onCut);
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [reportEvent, reportViolation, sessionId]);

  return { reportEvent, reportViolation };
}

