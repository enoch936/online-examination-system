'use client';

import { useCallback, useEffect } from 'react';
import { getSocket } from '@/services/socket.service';

export function useExamMonitoring(input: {
  examId: string;
  sessionId: string;
  remainingSeconds: number;
  onViolation: (type: string, severity?: number) => void;
}) {
  const { examId, sessionId, remainingSeconds, onViolation } = input;

  const reportViolation = useCallback(
    (type: string, severity = 1) => {
      onViolation(type, severity);
      getSocket().emit('exam:violation', { examId, sessionId, type, severity });
    },
    [examId, onViolation, sessionId],
  );

  useEffect(() => {
    const socket = getSocket();
    socket.connect();
    socket.emit('exam:join', { sessionId });

    const heartbeat = window.setInterval(() => {
      socket.emit('exam:heartbeat', { examId, sessionId, remainingSeconds });
    }, 10000);

    const onBlur = () => reportViolation('WINDOW_BLUR', 1);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        reportViolation('TAB_SWITCH', 2);
      }
    };
    const onFullscreen = () => {
      if (!document.fullscreenElement) {
        reportViolation('FULLSCREEN_EXIT', 2);
      }
    };

    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('fullscreenchange', onFullscreen);

    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('fullscreenchange', onFullscreen);
    };
  }, [examId, remainingSeconds, reportViolation, sessionId]);
}
