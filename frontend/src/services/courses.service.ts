import { api, unwrap } from './api';
import type { Course } from '@/types/api';

export type CourseInput = { subjectId: string; code: string; name: string; description?: string | null };

export const coursesService = {
  async list() {
    return unwrap<Course[]>(await api.get('/courses'));
  },
  async create(data: CourseInput) {
    return unwrap<Course>(await api.post('/courses', data));
  },
  async update(id: string, data: Partial<CourseInput>) {
    return unwrap<Course>(await api.patch(`/courses/${id}`, data));
  },
  async remove(id: string) {
    return unwrap<{ id: string }>(await api.delete(`/courses/${id}`));
  },
};
