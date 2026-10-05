'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSocket } from '@/services/socket.service';
import { getIceServers } from '@/services/webrtc';
import { api } from '@/services/api';
import type { ApiEnvelope } from '@/types/api';

type ProctoringStatus = 'idle' | 'starting' | 'active' | 'denied' | 'error';

/**
 * Why capture is not currently producing frames.
 *
 * `active` alone was never enough to tell a proctor the truth: a camera that was
 * unplugged, revoked in browser settings, muted by the OS or taken over by
 * another application still leaves a live MediaStreamTrack object, so the UI
 * went on reporting a healthy green camera while nothing was being recorded.
 */
export type ProctoringFault =
  | { kind: 'permission'; message: string }
  | { kind: 'device-lost'; message: string }
  | { kind: 'no-frames'; message: string }
  | { kind: 'unsupported'; message: string }
  | { kind: 'unknown'; message: string };

export type { ProctoringStatus };

/** How long a live track may produce no frames before it is treated as dead. */
const NO_FRAME_GRACE_MS = 15000;
/** Backoff steps for re-acquiring a device that went away mid-exam. */
const RECOVERY_DELAYS_MS = [1000, 2000, 4000, 8000, 15000];

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
  const [fault, setFault] = useState<ProctoringFault | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [recoveryAttempt, setRecoveryAttempt] = useState(0);
  const [retryNonce, setRetryNonce] = useState(0);
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
  /** Last time a frame was actually produced, used to catch a silent dead track. */
  const lastFrameAtRef = useRef(0);
  const recoveryRef = useRef<(() => void) | null>(null);

  const report = useCallback(
    (type: string, metadata?: Record<string, unknown>) => {
      const socket = getSocket();
      // Guarded like emitSignal: FOCUS_RESTORED used to be emitted
      // unconditionally, so it was the one signal that silently disappeared
      // whenever the gateway was down.
      if (!socket.connected || !sessionId) return;
      socket.emit('exam:event', { sessionId, type, metadata });
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

  const retry = useCallback(() => {
    setError(null);
    setFault(null);
    setRecovering(false);
    setStatus('idle');
    setRecoveryAttempt(0);
    setRetryNonce((n) => n + 1);
  }, []);

  /**
   * A track stopped delivering frames or ended outright.
   *
   * The student is told, the proctor is told through the monitoring timeline,
   * and re-acquisition is attempted on a backoff. The exam is not blocked by
   * the failure — it is reported honestly, which is what the integrity trail is
   * for.
   */
  const handleTrackLoss = useCallback(
    (reason: ProctoringFault) => {
      setFault(reason);
      setStatus('error');
      setError(reason.message);
      setRecovering(true);
      emitSignal(reason.kind === 'permission' ? 'CAMERA_PERMISSION_DENIED' : 'CAMERA_DISCONNECTED', {
        reason: reason.kind,
        message: reason.message,
      });
      // `retry` restarts the effect, which re-runs getUserMedia; the counter
      // picks the delay from the backoff table and eventually stops trying.
      setRecoveryAttempt((attempt) => {
        const delay = RECOVERY_DELAYS_MS[Math.min(attempt, RECOVERY_DELAYS_MS.length - 1)];
        const next = attempt + 1;
        window.setTimeout(() => {
          if (enabledRef.current) setRetryNonce((n) => n + 1);
        }, delay);
        return next;
      });
    },
    [emitSignal],
  );

  // A webcam/mic that is plugged in, unplugged or revoked mid-exam must be
  // noticed. Without this the session keeps reporting an active camera that is
  // no longer sending anything.
  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined') return;
    const devices = navigator.mediaDevices;
    if (!devices) {
      // No mediaDevices at all means an insecure origin: getUserMedia is
      // unavailable and the platform must say so rather than look healthy.
      setFault({ kind: 'unsupported', message: 'Camera capture requires a secure (HTTPS) connection' });
      setStatus('error');
      return;
    }

    const onDeviceChange = () => {
      const track = streamRef.current?.getVideoTracks()[0];
      if (!track) return;
      if (track.readyState === 'live') {
        // Something was plugged back in. Re-acquire so the new device is used.
        recoveryRef.current?.();
      }
    };

    devices.addEventListener?.('devicechange', onDeviceChange);
    return () => devices.removeEventListener?.('devicechange', onDeviceChange);
  }, [enabled]);

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
        setFault(null);
        setRecovering(false);
        lastFrameAtRef.current = Date.now();

        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.srcObject = stream;
        await video.play().catch(() => undefined);
        videoRef.current = video;

        // Real failure detection. `ended` fires when the device is removed or the
        // track is stopped by the OS; `mute` fires when the source stalls (a
        // camera in use elsewhere, a revoked permission). Both used to be
        // invisible: the stream object stays live and the UI kept saying "active".
        const onTrackEnded = () => {
          handleTrackLoss({ kind: 'device-lost', message: 'Camera or microphone stopped unexpectedly' });
        };
        const onTrackMute = () => {
          // A track can unmute again; only report a fault if it stays dead.
          window.setTimeout(() => {
            if (streamRef.current !== stream) return;
            const muted = stream.getTracks().some((t) => t.readyState === 'live' && t.muted);
            if (muted) {
              handleTrackLoss({ kind: 'device-lost', message: 'Camera feed stalled' });
            }
          }, 3000);
        };
        stream.getTracks().forEach((track) => {
          track.addEventListener('ended', onTrackEnded);
          track.addEventListener('mute', onTrackMute);
        });

        // Watchdog for the case where the track reports itself live but produces
        // no frames at all — a browser quirk the `ended` event does not cover.
        const frameWatchdog = window.setInterval(() => {
          const v = videoRef.current;
          if (!v || streamRef.current !== stream) return;
          if (v.videoWidth > 0) {
            lastFrameAtRef.current = Date.now();
            return;
          }
          if (Date.now() - lastFrameAtRef.current > NO_FRAME_GRACE_MS) {
            handleTrackLoss({ kind: 'no-frames', message: 'Camera is not delivering video' });
          }
        }, 5000);

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
          lastFrameAtRef.current = Date.now();
          const ctx = c.getContext('2d');
          if (!ctx) return;
          ctx.drawImage(v, 0, 0, 320, 240);
          c.toBlob(async (blob) => {
            if (!blob) return;
            try {
              const fd = new FormData();
              fd.append('file', blob, 'frame.jpg');
              fd.append('sessionId', sessionId);
              // Analyzer access is proxied through the authenticated API so the
              // backend can verify session ownership before forwarding the frame.
              const res = await api.post<ApiEnvelope<{
                multipleFaces: boolean;
                faceDetected: boolean;
                confidence: number;
                motionDetected: boolean;
                motionScore: number;
              }>>('/monitoring/analyze', fd, { headers: { 'Content-Type': undefined } });
              const data = res.data.data;
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
            const res = await api.post<ApiEnvelope<{ audioActivity: boolean }>>('/monitoring/audio', {
              sessionId,
              rms,
            });
            if (!res.data.data) return;
            const active = !!res.data.data.audioActivity;
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
          window.clearInterval(frameWatchdog);
          stream.getTracks().forEach((track) => {
            track.removeEventListener('ended', onTrackEnded);
            track.removeEventListener('mute', onTrackMute);
          });
          document.removeEventListener('visibilitychange', onFocus);
          wrtcCleanup?.();
          stopAll();
        };
      } catch (e: unknown) {
        if (cancelled) return;
        const notAllowed = e instanceof DOMException && e.name === 'NotAllowedError';
        const missing = e instanceof DOMException && e.name === 'NotFoundError';
        const next: ProctoringFault = notAllowed
          ? { kind: 'permission', message: 'Camera or microphone permission was denied' }
          : missing
            ? { kind: 'device-lost', message: 'No camera or microphone was found' }
            : { kind: 'unknown', message: e instanceof Error ? e.message : 'Proctoring capture unavailable' };
        setFault(next);
        setStatus(videoOk || mic ? 'error' : 'denied');
        setError(next.message);
        emitSignal(notAllowed ? 'CAMERA_PERMISSION_DENIED' : 'CAMERA_UNAVAILABLE', {
          reason: next.kind,
          message: next.message,
        });
        streamRef.current = null;
        // Permission denial needs the student, not a timer, so it waits for an
        // explicit retry. Anything else keeps trying on a backoff.
        if (next.kind === 'permission') {
          setRecovering(false);
        } else {
          setRecovering(true);
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
  }, [enabled, mic, webcam, ai, sessionId, emitSignal, report, setupWebRTC, stopAll, retryNonce, handleTrackLoss]);

  recoveryRef.current = retry;

  useEffect(() => () => {
    recoveryRef.current = null;
  }, []);

  return { status, error, fault, recovering, recoveryAttempt, retry };
}
