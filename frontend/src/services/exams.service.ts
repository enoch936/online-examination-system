import { api, unwrap } from './api';
import type { ExamSession, ExamSummary, ExamDetail, ExamQuestionPool } from '@/types/api';

// exam data type for creating an examination
export type CreateExamData = {
  courseId: string;
  title: string;
  description?: string;
  instructions?: string;
  durationMinutes: number;
  totalMarks: number;
  passingMarks: number;
  attemptsAllowed?: number;
  randomizeQuestions?: boolean;
  randomizeOptions?: boolean;
  fullscreenRequired?: boolean;
  showResultImmediately?: boolean;
  negativeMarkingRate?: number;
  startsAt: string;
  endsAt: string;
  questionBankId?: string;
  questionBankIds?: string[];
  questionCount?: number;
  questionIds?: string[];
  courseIds?: string[];
};

export type UpdateExamData = Partial<CreateExamData>;

export type ExamPermissionLevel = 'VIEWER' | 'MONITOR' | 'PROCTOR' | 'CO_OWNER';

export const EXAM_PERMISSION_LEVELS: ExamPermissionLevel[] = ['VIEWER', 'MONITOR', 'PROCTOR', 'CO_OWNER'];

export type ExamShareInstructor = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  permissionLevel: ExamPermissionLevel;
  grantedBy?: string;
};

export type ExamAuditLog = {
  id: string;
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  before?: string | null;
  after?: string | null;
  createdAt: string;
  actor?: { id: string; firstName: string; lastName: string; email: string } | null;
};

export const examsService = {
  async list() {
    return unwrap<ExamSummary[]>(await api.get('/exams'));
  },

  async get(id: string) {
    return unwrap<ExamDetail>(await api.get(`/exams/${id}`));
  },

  async create(data: CreateExamData) {
    return unwrap<ExamSummary>(await api.post('/exams', data));
  },

  async update(id: string, data: UpdateExamData) {
    return unwrap<ExamDetail>(await api.patch(`/exams/${id}`, data));
  },

  async remove(id: string) {
    return unwrap(await api.delete(`/exams/${id}`));
  },

  async publish(id: string) {
    return unwrap(await api.patch(`/exams/${id}/publish`));
  },

  async startNow(id: string) {
    return unwrap(await api.patch(`/exams/${id}/start`));
  },

  async restart(id: string) {
    return unwrap(await api.patch(`/exams/${id}/restart`));
  },

  async endNow(id: string) {
    return unwrap(await api.patch(`/exams/${id}/end`));
  },

  async assignStudents(id: string, studentIds: string[]) {
    return unwrap(await api.post(`/exams/${id}/assign`, { studentIds }));
  },

  async unassignStudent(id: string, studentId: string) {
    return unwrap(await api.delete(`/exams/${id}/assign/${studentId}`));
  },

  async getAssignedStudents(id: string) {
    return unwrap<Array<{ id: string; firstName: string; lastName: string; email: string; status: string }>>(
      await api.get(`/exams/${id}/assignments`),
    );
  },

  async getInstructors() {
    return unwrap<Array<{ id: string; firstName: string; lastName: string; email: string; status: string }>>(
      await api.get('/exams/instructors'),
    );
  },

  async getAccess(id: string) {
    return unwrap<{ owner: { id: string; firstName: string; lastName: string; email: string }; shares: ExamShareInstructor[] }>(
      await api.get(`/exams/${id}/access`),
    );
  },

  async share(id: string, instructorIds: string[], permissionLevel: ExamPermissionLevel = 'VIEWER') {
    return unwrap(await api.post(`/exams/${id}/share`, { instructorIds, permissionLevel }));
  },

  async updateShareLevel(id: string, instructorId: string, permissionLevel: ExamPermissionLevel) {
    return unwrap(await api.patch(`/exams/${id}/share/${instructorId}`, { permissionLevel }));
  },

  async unshare(id: string, instructorId: string) {
    return unwrap(await api.delete(`/exams/${id}/share/${instructorId}`));
  },

  async transferOwnership(id: string, toInstructorId: string) {
    return unwrap(await api.post(`/exams/${id}/transfer`, { toInstructorId }));
  },

  async openMonitor(examId: string) {
    return unwrap(await api.post(`/monitoring/exams/${examId}/monitor/open`, {}));
  },

  async getAuditLogs(id: string) {
    return unwrap<ExamAuditLog[]>(await api.get(`/exams/${id}/audit-logs`));
  },

  async questionPool(courseIds: string[]) {
    return unwrap<ExamQuestionPool>(await api.get(`/exams/question-pool?courseIds=${courseIds.join(',')}`));
  },

  async start(examId: string) {
    return unwrap<ExamSession>(await api.post(`/exam-sessions/${examId}/start`, {}));
  },

  async resume(sessionId: string) {
    return unwrap<ExamSession>(await api.get(`/exam-sessions/${sessionId}/resume`));
  },

  async saveAnswer(sessionId: string, payload: unknown) {
    return unwrap(await api.patch(`/exam-sessions/${sessionId}/answers`, payload));
  },

  async logViolation(sessionId: string, payload: unknown) {
    return unwrap(await api.post(`/exam-sessions/${sessionId}/violations`, payload));
  },

  async submit(sessionId: string, autoSubmitted = false) {
    return unwrap(await api.post('/submissions', { sessionId, autoSubmitted }));
  },
};
