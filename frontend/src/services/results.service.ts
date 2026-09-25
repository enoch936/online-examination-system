import { api, unwrap } from './api';
import type { Result, ResultDetail, PaginatedResponse } from '@/types/api';

export const resultsService = {
  async list(params?: {
    examId?: string;
    page?: number;
    limit?: number;
    passed?: boolean;
    certificateStatus?: 'issued' | 'none';
  }) {
    return unwrap<PaginatedResponse<Result>>(await api.get('/results', { params }));
  },
  async get(id: string) {
    return unwrap<ResultDetail>(await api.get(`/results/${id}`));
  },
  async publish(id: string) {
    return unwrap(await api.patch(`/results/${id}/publish`));
  },
  async grade(id: string, answers: Array<{ answerId: string; score: number; feedback?: string }>) {
    return unwrap(await api.post(`/results/${id}/grade`, { answers }));
  },
  async override(
    id: string,
    payload: { grade?: string | null; feedback?: string | null; recomputeGrade?: boolean },
  ) {
    return unwrap(await api.patch(`/results/${id}/override`, payload));
  },
};
