import { api, unwrap } from './api';
import type { Subject } from '@/types/api';

export const subjectsService = {
  async list() {
    return unwrap<Subject[]>(await api.get('/subjects'));
  },
  async create(data: { code: string; name: string; description?: string }) {
    return unwrap<Subject>(await api.post('/subjects', data));
  },
};
