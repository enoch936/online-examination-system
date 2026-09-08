import { api, unwrap } from './api';

export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';

export type RetakeRequest = {
  id: string;
  examId: string;
  sessionId: string | null;
  studentId: string;
  status: RequestStatus;
  reason?: string | null;
  requestedAt: string;
  decisionAt: string | null;
  reviewNote?: string | null;
  reviewedById?: string | null;
  student?: { id: string; firstName: string; lastName: string; email: string };
  exam?: { id: string; title: string };
  reviewedBy?: { id: string; firstName: string; lastName: string; email: string } | null;
  type?: 'retake' | 'resume';
};

export type ResumeRequest = RetakeRequest;

export type PendingRequests = {
  retake: RetakeRequest[];
  resume: ResumeRequest[];
};

export const requestsService = {
  requestRetake: async (body: { examId: string; reason?: string }): Promise<RetakeRequest> => {
    const response = await api.post('/requests/retake', body);
    return unwrap<RetakeRequest>(response);
  },

  requestResume: async (body: { sessionId: string; reason?: string }): Promise<ResumeRequest> => {
    const response = await api.post('/requests/resume', body);
    return unwrap<ResumeRequest>(response);
  },

  listPending: async (examId?: string): Promise<PendingRequests> => {
    const response = await api.get('/requests/pending', { params: examId ? { examId } : {} });
    return unwrap<PendingRequests>(response);
  },

  listForExam: async (examId: string): Promise<PendingRequests> => {
    const response = await api.get(`/requests/exam/${examId}`);
    return unwrap<PendingRequests>(response);
  },

  decide: async (requestId: string, action: 'approve' | 'reject'): Promise<RetakeRequest | ResumeRequest> => {
    const response = await api.post(`/requests/${requestId}/${action}`, {});
    return unwrap<RetakeRequest | ResumeRequest>(response);
  },
};