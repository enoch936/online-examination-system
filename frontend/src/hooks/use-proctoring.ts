'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSocket } from '@/services/socket.service';
import { getIceServers } from '@/services/webrtc';

type ProctoringStatus = 'idle' | 'starting' | 'active' | 'denied' | 'error';

function waitForSocketConnect(timeoutMs = 5000): Promise<void> {
  const socket = getSocket();
  if (socket.connected) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      socket.off('connect', onConnect);
      socket.off('connect_error', onError);
      reject(new Error('Socket connection timed out'));
    }, timeoutMs);
    const onConnect = () => {
      window.clearTimeout(timer);
      resolve();
    };
    const onError = (err: Error) => {
      window.clearTimeout(timer);
      socket.off('connect', onConnect);
      socket.off('connect_error', onError);
      reject(err);
    };
    socket.on('connect', onConnect);
    socket.on('connect_error', onError);
    socket.connect();
  });
}

export function useProctoring(input: {
  sessionId: string;
  examId: string;
  enabled: boolean;
  webcam?: boolean;
  mic?: boolean;
  ai?: boolean;
}) {
  const { sessionId, examId, enabled, webcam = false, mic = false, ai = false } = input;

  const [status, setStatus] = useState<ProctoringStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const peerSocketIdRef = useRef<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const lastFaceSignalRef = useRef<string>('unknown');
  const lastMotionRef = useRef<boolean>(false);
  const lastAudioRef = useRef<boolean>(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const report = useCallback(
    (type: string, metadata?: Record<string, unknown>) => {
      if (!sessionId) return;
      getSocket().emit('exam:event', { sessionId, type, metadata });
    },
    [sessionId],
  );

  const emitSignal = useCallback(
    (type: string, metadata?: Record<string, unknown>) => {
      const socket = getSocket();
      if (!socket.connected || !sessionId) return;
      socket.emit('exam:event', { sessionId, type, metadata });
    },
    [sessionId],
  );

  const stopAll = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    peerSocketIdRef.current = null;
    audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
    analyserRef.current = null;
    setStatus('idle');
  }, []);

  const setupWebRTC = useCallback(
    async (stream: MediaStream): Promise<(() => void) | undefined> => {
      try {
        await waitForSocketConnect();
      } catch {
        return undefined;
      }
      if (!streamRef.current) return undefined;
      const socket = getSocket();
      if (!socket.connected) return undefined;

      let lastCreateAt = Date.now();
      const createConnection = () => {
        lastCreateAt = Date.now();
        pcRef.current?.close();
        const pc = new RTCPeerConnection({ iceServers: getIceServers() });
        pcRef.current = pc;
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        pc.onicecandidate = (e) => {
          if (e.candidate && peerSocketIdRef.current) {
            socket.emit('proctoring:ice', {
              sessionId,
              candidate: e.candidate,
              peerSocketId: peerSocketIdRef.current,
            });
          }
        };

        pc.onconnectionstatechange = () => {
          if (pcRef.current?.connectionState === 'failed') {
            pcRef.current?.close();
            pcRef.current = null;
          }
        };

        void pc
          .createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            if (pcRef.current?.localDescription) {
              socket.emit('proctoring:offer', {
                sessionId,
                examId,
                offer: pcRef.current.localDescription,
              });
            }
          })
          .catch(() => undefined);
      };

      createConnection();

      const onAnswer = (payload: { sessionId: string; answer?: unknown; peerSocketId?: string }) => {
        if (payload.sessionId !== sessionId) return;
        if (payload.peerSocketId) peerSocketIdRef.current = payload.peerSocketId;
        if (payload.answer && pcRef.current) {
          void pcRef.current.setRemoteDescription(payload.answer as RTCSessionDescriptionInit);
        }
      };
      const onIce = (payload: { sessionId: string; candidate?: unknown }) => {
        if (payload.sessionId !== sessionId) return;
        if (payload.candidate && pcRef.current) {
          void pcRef.current.addIceCandidate(payload.candidate as RTCIceCandidateInit);
        }
      };

      socket.on('proctoring:answer', onAnswer);
      socket.on('proctoring:ice', onIce);

      // Keep the offer flowing until the peer answers, and self-heal failed or
      // stuck connections so a proctor joining late can still pick up the camera.
      const retry = window.setInterval(() => {
        const pcNow = pcRef.current;
        if (!pcNow) {
          createConnection();
          return;
        }
        const connected = pcNow.connectionState === 'connected';
        const stale =
          !connected &&
          Date.now() - lastCreateAt > 10000 &&
          pcNow.signalingState !== 'have-local-offer';
        if (pcNow.signalingState === 'have-local-offer' && pcNow.localDescription) {
          socket.emit('proctoring:offer', { sessionId, examId, offer: pcNow.localDescription });
        } else if (
          pcNow.connectionState === 'failed' ||
          pcNow.connectionState === 'closed' ||
          stale
        ) {
          createConnection();
        }
      }, 4000);

      return () => {
        window.clearInterval(retry);
        socket.off('proctoring:answer', onAnswer);
        socket.off('proctoring:ice', onIce);
      };
    },
    [examId, sessionId],
  );

  useEffect(() => {
    if (!enabled || !sessionId) {
      stopAll();
      return;
    }
    let cancelled = false;

    const start = async () => {
      setStatus('starting');
      const videoOk = webcam || ai;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoOk ? { width: 640, height: 480 } : false,
          audio: mic,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        setStatus('active');

        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.srcObject = stream;
        await video.play().catch(() => undefined);
        videoRef.current = video;

        if (webcam || ai) {
          const canvas = document.createElement('canvas');
          canvas.width = 320;
          canvas.height = 240;
          canvasRef.current = canvas;
        }

        if (mic) {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 2048;
          source.connect(analyser);
          audioCtxRef.current = ctx;
          analyserRef.current = analyser;
        }

        let wrtcCleanup: (() => void) | undefined;
        void setupWebRTC(stream)
          .then((cleanup) => {
            wrtcCleanup = cleanup;
          })
          .catch(() => undefined);

        const frameTimer = window.setInterval(async () => {
          if (!videoRef.current || !canvasRef.current) return;
          const v = videoRef.current;
          const c = canvasRef.current;
          if (v.videoWidth === 0 || v.videoHeight === 0) return;
          const ctx = c.getContext('2d');
          if (!ctx) return;
          ctx.drawImage(v, 0, 0, 320, 240);
          c.toBlob(async (blob) => {
            if (!blob) return;
            try {
              const fd = new FormData();
              fd.append('file', blob, 'frame.jpg');
              const res = await fetch(
                `${process.env.NEXT_PUBLIC_PROCTORING_URL ?? 'http://127.0.0.1:8000'}/analyze?session_id=${encodeURIComponent(sessionId)}`,
                { method: 'POST', body: fd },
              );
              if (!res.ok) return;
              const data = await res.json();
              if (!data) return;
              const faceSignal = data.multipleFaces
                ? 'multiple'
                : data.faceDetected
                  ? 'present'
                  : data.faceDetected === false
                    ? 'absent'
                    : lastFaceSignalRef.current;
              if (faceSignal !== lastFaceSignalRef.current) {
                lastFaceSignalRef.current = faceSignal;
                if (faceSignal === 'multiple') emitSignal('MULTIPLE_FACES_DETECTED', { confidence: data.confidence });
                else if (faceSignal === 'absent') emitSignal('FACE_NOT_DETECTED', { confidence: data.confidence });
                else if (faceSignal === 'present') emitSignal('FACE_DETECTED', {});
              }
              const motion = !!data.motionDetected;
              if (motion !== lastMotionRef.current) {
                lastMotionRef.current = motion;
                if (motion) emitSignal('MOTION_DETECTED', { motionScore: data.motionScore });
              }
            } catch {
              /* transient analyzer failures are ignored */
            }
          }, 'image/jpeg', 0.7);
        }, 5000);

        const audioTimer = window.setInterval(async () => {
          if (!analyserRef.current) return;
          const analyser = analyserRef.current;
          const data = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) sum += data[i];
          const rms = sum / data.length;
          try {
            const res = await fetch(
              `${process.env.NEXT_PUBLIC_PROCTORING_URL ?? 'http://127.0.0.1:8000'}/audio`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, rms }),
              },
            );
            if (!res.ok) return;
            const dataRes = await res.json();
            const active = !!dataRes.audioActivity;
            if (active !== lastAudioRef.current) {
              lastAudioRef.current = active;
              if (active) emitSignal('AUDIO_ACTIVITY', { rms });
            }
          } catch {
            /* ignore */
          }
        }, 5000);

        const onFocus = () => {
          if (document.visibilityState === 'visible') report('FOCUS_RESTORED', {});
        };
        document.addEventListener('visibilitychange', onFocus);

        return () => {
          cancelled = true;
          window.clearInterval(frameTimer);
          window.clearInterval(audioTimer);
          document.removeEventListener('visibilitychange', onFocus);
          wrtcCleanup?.();
          stopAll();
        };
      } catch (e: unknown) {
        if (cancelled) return;
        setStatus('denied');
        setError(e instanceof Error ? e.message : 'Proctoring capture unavailable');
        const notAllowed = e instanceof DOMException && e.name === 'NotAllowedError';
        emitSignal(notAllowed ? 'CAMERA_PERMISSION_DENIED' : 'CAMERA_UNAVAILABLE', {});
        if (videoOk || mic) {
          streamRef.current = null;
          setStatus('error');
        }
      }
    };

    void start().then((cleanup) => {
      if (typeof cleanup === 'function') cleanupRef.current = cleanup;
    });
    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [enabled, mic, webcam, ai, sessionId, emitSignal, report, setupWebRTC, stopAll]);

  return { status, error };
}
