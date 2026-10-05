import { api, unwrap } from './api';
import type {
  InstructorAction,
  LiveStats,
  MonitorConfig,
  MonitoringEvent,
  SessionDeadline,
  SessionSnapshot,
  StudentRequirements,
  TimeExtensionRecord,
} from '@/types/monitoring';

/** Result of a one/many/all time grant, exactly as the backend reports it. */
export type ExtendTimeOutcome = {
  extended: number;
  skipped: Array<{ sessionId: string; reason: string }>;
  notifications: number;
};

export const monitoringService = {
  async stats(examId: string) {
    return unwrap<LiveStats>(await api.get(`/monitoring/exams/${examId}/stats`));
  },

  async listSessions(examId: string) {
    return unwrap<SessionSnapshot[]>(await api.get(`/monitoring/exams/${examId}/sessions`));
  },

  async config(examId: string) {
    return unwrap<MonitorConfig>(await api.get(`/monitoring/exams/${examId}/config`));
  },

  async saveConfig(examId: string, payload: Partial<MonitorConfig>) {
    return unwrap<MonitorConfig>(await api.put(`/monitoring/exams/${examId}/config`, payload));
  },

  async requirements(examId: string) {
    return unwrap<StudentRequirements>(await api.get(`/monitoring/exams/${examId}/requirements`));
  },

  async events(sessionId: string) {
    return unwrap<MonitoringEvent[]>(await api.get(`/monitoring/sessions/${sessionId}/events`));
  },

  async acknowledge(sessionId: string, eventId: string, note?: string) {
    return unwrap<MonitoringEvent>(
      await api.post(`/monitoring/sessions/${sessionId}/events/${eventId}/ack`, { note }),
    );
  },

  async recordEvent(sessionId: string, payload: { type: string; metadata?: Record<string, unknown>; riskScore?: number }) {
    return unwrap(await api.post(`/monitoring/sessions/${sessionId}/events`, payload));
  },

  async action(sessionId: string, payload: { action: InstructorAction; message?: string; minutes?: number }) {
    return unwrap<SessionSnapshot | null>(await api.post(`/monitoring/sessions/${sessionId}/actions`, payload));
  },

  async questionActivity(examId: string, questionId: string) {
    return unwrap<{ answered: number; unanswered: number; flagged: number; activeSessions: number }>(
      await api.get(`/monitoring/exams/${examId}/questions/${questionId}/activity`),
    );
  },

  /**
   * Grant time to one student, a chosen set, or — when both `studentIds` and
   * `classId` are omitted — every active session on the exam. The backend
   * recomputes each deadline from the stored `expiresAt`, journals a
   * `time_extensions` row per session, and pushes the new deadline to any
   * student currently connected.
   */
  async extendTime(
    examId: string,
    payload: { minutes: number; studentIds?: string[]; classId?: string; reason?: string },
  ) {
    return unwrap<ExtendTimeOutcome>(
      await api.post(`/monitoring/exams/${examId}/extend-time`, payload),
    );
  },

  /** Audit trail of every time grant on this exam, newest first. */
  async extensionHistory(examId: string) {
    return unwrap<TimeExtensionRecord[]>(await api.get(`/monitoring/exams/${examId}/extend-time`));
  },

  /** Audit trail for one session. */
  async sessionExtensions(sessionId: string) {
    return unwrap<TimeExtensionRecord[]>(await api.get(`/monitoring/sessions/${sessionId}/extend-time`));
  },

  /**
   * The server's own view of a session's deadline.
   *
   * The countdown is derived from the persisted `expiresAt`, so a student cannot
   * gain time by changing the device clock or replaying a stale local value.
   */
  async deadline(sessionId: string) {
    return unwrap<SessionDeadline>(await api.get(`/monitoring/sessions/${sessionId}/deadline`));
  },
};
