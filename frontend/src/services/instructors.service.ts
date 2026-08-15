import { api, unwrap } from './api';
import type { ExamPermissionLevel } from './exams.service';

export type InstructorSummary = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  avatarUrl?: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
  courses: number;
  exams: number;
  questionBanks: number;
  students: number;
};

export type InstructorShare = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  permissionLevel: ExamPermissionLevel;
};

export type InstructorDetail = {
  profile: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
    avatarUrl?: string | null;
    status: string;
    lastLoginAt?: string | null;
    createdAt: string;
    roles: string[];
  };
  stats: {
    exams: number;
    questionBanks: number;
    questions: number;
    courses: number;
    students: number;
    liveSessions: number;
  };
  courses: Array<{ id: string; name: string; examCount: number }>;
  exams: Array<{
    id: string;
    title: string;
    status: string;
    course: string;
    sessions: number;
    assignments: number;
    isLive: boolean;
    shares: InstructorShare[];
  }>;
  questionBanks: Array<{ id: string; name: string; status: string; course: string | null; questions: number }>;
  students: Array<{ id: string; firstName: string; lastName: string; email: string }>;
  sharedExams: Array<{
    examId: string;
    title: string;
    status: string;
    owner: { id: string; firstName: string; lastName: string; email: string };
    permissionLevel: ExamPermissionLevel;
  }>;
  liveSessions: Array<{
    sessionId: string;
    examId: string;
    examTitle: string;
    studentId: string;
    studentName: string;
    status: string;
    riskLevel: string;
    lastActivityAt?: string | null;
  }>;
};

export type InstructorAuditLog = {
  id: string;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: string | null;
  after?: string | null;
  ipAddress?: string | null;
  createdAt: string;
  actor?: { id: string; email: string; firstName: string; lastName: string } | null;
};

export type InstructorAuditFilters = {
  action?: string;
  entity?: string;
  from?: string;
  to?: string;
  examId?: string;
  questionBankId?: string;
  courseId?: string;
  categoryId?: string;
};

export const instructorsService = {
  async list(filters: { search?: string; status?: string } = {}) {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.status) params.set('status', filters.status);
    const qs = params.toString();
    return unwrap<InstructorSummary[]>(await api.get(`/instructors${qs ? `?${qs}` : ''}`));
  },

  async get(id: string) {
    return unwrap<InstructorDetail>(await api.get(`/instructors/${id}`));
  },

  async updateStatus(id: string, status: string) {
    return unwrap<{ id: string; status: string }>(await api.patch(`/instructors/${id}/status`, { status }));
  },

  async getAuditLogs(id: string, filters: InstructorAuditFilters = {}) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }
    const qs = params.toString();
    return unwrap<InstructorAuditLog[]>(await api.get(`/instructors/${id}/audit-logs${qs ? `?${qs}` : ''}`));
  },

  async getSessions(id: string) {
    return unwrap<Array<{ id: string; exam: { id: string; title: string }; student: { firstName: string; lastName: string; email: string }; status: string; riskLevel: string }>>(
      await api.get(`/instructors/${id}/sessions`),
    );
  },
};
