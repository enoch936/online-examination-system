import { api, unwrap } from './api';
import type { Subject } from '@/types/api';

export type SubjectInput = { code: string; name: string; description?: string | null };

export const subjectsService = {
  async list() {
    return unwrap<Subject[]>(await api.get('/subjects'));
  },
  async create(data: SubjectInput) {
    return unwrap<Subject>(await api.post('/subjects', data));
  },
  async update(id: string, data: Partial<SubjectInput>) {
    return unwrap<Subject>(await api.patch(`/subjects/${id}`, data));
  },
  async remove(id: string) {
    return unwrap<{ id: string }>(await api.delete(`/subjects/${id}`));
  },
};
