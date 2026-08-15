import { Injectable } from '@nestjs/common';
import { ExamEventType, RiskLevel } from '@prisma/client';

export interface RiskThresholds {
  low: number;
  medium: number;
  high: number;
  critical: number;
}

export const DEFAULT_WEIGHTS: Record<ExamEventType, number> = {
  EXAM_STARTED: 0,
  EXAM_RESUMED: 0,
  QUESTION_VIEWED: 0,
  QUESTION_ANSWERED: 0,
  QUESTION_FLAGGED: 0,
  TAB_SWITCHED: 10,
  WINDOW_BLURRED: 5,
  WINDOW_FOCUSED: 0,
  FULLSCREEN_EXITED: 10,
  FULLSCREEN_ENTERED: 0,
  COPY_ATTEMPT: 8,
  PASTE_ATTEMPT: 8,
  CUT_ATTEMPT: 8,
  PRINT_ATTEMPT: 15,
  CONTEXT_MENU_ATTEMPT: 5,
  SHORTCUT_ATTEMPT: 8,
  CAMERA_CONNECTED: 0,
  CAMERA_DISCONNECTED: 10,
  MIC_CONNECTED: 0,
  MIC_DISCONNECTED: 5,
  FACE_DETECTED: 0,
  FACE_NOT_DETECTED: 15,
  MULTIPLE_FACES_DETECTED: 15,
  MOTION_DETECTED: 10,
  AUDIO_ACTIVITY: 10,
  AI_SIGNAL: 5,
  MANUAL_FLAG: 20,
  CONNECTION_LOST: 5,
  CONNECTION_RESTORED: 0,
  EXAM_SUBMITTED: 0,
  PAUSED: 0,
  RESUMED: 0,
  TIME_EXTENDED: 0,
  FORCE_SUBMITTED: 0,
  SESSION_DISCONNECTED: 10,
  WARNING_SENT: 0,
  NOTE_ADDED: 0,
};

export const DEFAULT_THRESHOLDS: RiskThresholds = { low: 25, medium: 50, high: 75, critical: 100 };

@Injectable()
export class RiskEngine {
  weight(type: ExamEventType, weights?: Record<string, number>): number {
    return Math.max(0, Math.min(100, (weights?.[type] ?? DEFAULT_WEIGHTS[type] ?? 0)));
  }

  classify(score: number, thresholds?: Partial<RiskThresholds>): RiskLevel {
    const t = { ...DEFAULT_THRESHOLDS, ...thresholds };
    const s = Math.max(0, Math.min(100, score));
    if (s < t.low) return RiskLevel.LOW;
    if (s < t.medium) return RiskLevel.MEDIUM;
    if (s < t.high) return RiskLevel.HIGH;
    return RiskLevel.CRITICAL;
  }

  thresholds(config?: string | null): RiskThresholds {
    if (!config) return { ...DEFAULT_THRESHOLDS };
    try {
      return { ...DEFAULT_THRESHOLDS, ...JSON.parse(config) };
    } catch {
      return { ...DEFAULT_THRESHOLDS };
    }
  }

  weights(config?: string | null): Record<ExamEventType, number> {
    if (!config) return { ...DEFAULT_WEIGHTS };
    try {
      return { ...DEFAULT_WEIGHTS, ...JSON.parse(config) };
    } catch {
      return { ...DEFAULT_WEIGHTS };
    }
  }
}
