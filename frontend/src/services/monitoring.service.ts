import { api, unwrap } from './api';
import type {
  InstructorAction,
  LiveStats,
  MonitorConfig,
  MonitoringEvent,
  SessionSnapshot,
  StudentRequirements,
} from '@/types/monitoring';

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
};
