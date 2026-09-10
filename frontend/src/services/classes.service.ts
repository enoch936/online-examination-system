import { api, unwrap } from './api';
import type { Class, MyClass } from '@/types/api';

export type ClassInput = {
  courseId: string;
  instructorId: string;
  name: string;
  code: string;
  description?: string | null;
};

export type EnrollResult = {
  enrolled: number;
  alreadyEnrolled: number;
  invalid: number;
};

export const classesService = {
  async list(courseId?: string) {
    const params = courseId ? `?courseId=${courseId}` : '';
    return unwrap<Class[]>(await api.get(`/classes${params}`));
  },
  async my() {
    return unwrap<MyClass[]>(await api.get('/classes/my'));
  },
  async get(id: string) {
    return unwrap<Class>(await api.get(`/classes/${id}`));
  },
  async create(data: ClassInput) {
    return unwrap<Class>(await api.post('/classes', data));
  },
  async update(id: string, data: Partial<ClassInput>) {
    return unwrap<Class>(await api.patch(`/classes/${id}`, data));
  },
  async remove(id: string) {
    return unwrap<{ id: string }>(await api.delete(`/classes/${id}`));
  },
  async getStudents(id: string) {
    const cls = await this.get(id);
    return cls.students ?? [];
  },
  async enrollStudents(id: string, studentIds: string[]) {
    return unwrap<EnrollResult>(await api.post(`/classes/${id}/enroll`, { studentIds }));
  },
  async unenrollStudent(id: string, studentId: string) {
    return unwrap<{ success: boolean }>(await api.delete(`/classes/${id}/enroll/${studentId}`));
  },
};