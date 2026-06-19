import { api, unwrap } from './api';
import type { Result, ResultDetail, PaginatedResponse } from '@/types/api';

export const resultsService = {
  async list(params?: { examId?: string; page?: number; limit?: number }) {
    return unwrap<PaginatedResponse<Result>>(await api.get('/results', { params }));
  },
  async get(id: string) {
    return unwrap<ResultDetail>(await api.get(`/results/${id}`));
  },
};
