import { api, unwrap } from './api';
import type { Question } from '@/types/api';

export type QuestionFilters = {
  type?: string;
  difficulty?: string;
  subjectId?: string;
  search?: string;
};

export type CreateQuestionData = {
  subjectId: string;
  type: string;
  difficulty?: string;
  prompt: string;
  explanation?: string;
  points?: number;
  negativePoints?: number;
  tags?: string[];
  options?: { label: string; text: string; isCorrect: boolean; sortOrder?: number }[];
};

export type UpdateQuestionData = Partial<CreateQuestionData>;

export const questionsService = {
  async list(filters?: QuestionFilters) {
    const params = new URLSearchParams();
    if (filters?.type) params.set('type', filters.type);
    if (filters?.difficulty) params.set('difficulty', filters.difficulty);
    if (filters?.subjectId) params.set('subjectId', filters.subjectId);
    if (filters?.search) params.set('search', filters.search);
    const qs = params.toString();
    return unwrap<Question[]>(await api.get(`/questions${qs ? `?${qs}` : ''}`));
  },

  async get(id: string) {
    return unwrap<Question>(await api.get(`/questions/${id}`));
  },

  async create(data: CreateQuestionData) {
    return unwrap<Question>(await api.post('/questions', data));
  },

  async update(id: string, data: UpdateQuestionData) {
    return unwrap<Question>(await api.patch(`/questions/${id}`, data));
  },

  async remove(id: string) {
    return unwrap<Question>(await api.delete(`/questions/${id}`));
  },
};
