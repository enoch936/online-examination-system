import { api, unwrap } from './api';
import type { Question } from '@/types/api';

export type QuestionFilters = {
  type?: string;
  difficulty?: string;
  subjectId?: string;
  questionBankId?: string;
  topic?: string;
  search?: string;
  skip?: number;
  take?: number;
};

export type PaginatedQuestions = {
  questions: Question[];
  total: number;
};

export type CreateQuestionData = {
  subjectId: string;
  questionBankId?: string;
  type: string;
  difficulty?: string;
  prompt: string;
  explanation?: string;
  topic?: string;
  imageUrl?: string;
  points?: number;
  negativePoints?: number;
  tags?: string[];
  options?: { label: string; text: string; isCorrect: boolean; sortOrder?: number }[];
};

export type UpdateQuestionData = Partial<CreateQuestionData> & { isActive?: boolean };

export const questionsService = {
  async list(filters?: QuestionFilters) {
    const params = new URLSearchParams();
    if (filters?.type) params.set('type', filters.type);
    if (filters?.difficulty) params.set('difficulty', filters.difficulty);
    if (filters?.subjectId) params.set('subjectId', filters.subjectId);
    if (filters?.questionBankId) params.set('questionBankId', filters.questionBankId);
    if (filters?.topic) params.set('topic', filters.topic);
    if (filters?.search) params.set('search', filters.search);
    if (filters?.skip !== undefined) params.set('skip', String(filters.skip));
    if (filters?.take !== undefined) params.set('take', String(filters.take));
    const qs = params.toString();
    return unwrap<PaginatedQuestions>(await api.get(`/questions${qs ? `?${qs}` : ''}`));
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
