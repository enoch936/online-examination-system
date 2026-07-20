import { api, unwrap } from './api';
import type { ExamSession, ExamSummary, ExamDetail } from '@/types/api';

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
  questionIds: string[];
};

export type UpdateExamData = Partial<CreateExamData>;

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
