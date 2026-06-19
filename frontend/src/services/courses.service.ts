import { api, unwrap } from './api';
import type { Course } from '@/types/api';

export const coursesService = {
  async list() {
    return unwrap<Course[]>(await api.get('/courses'));
  },
};
