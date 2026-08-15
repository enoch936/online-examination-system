import { api, unwrap } from './api';
import type { Question, QuestionBank, QuestionBankDetail } from '@/types/api';

export type CreateQuestionBankData = {
  courseId: string;
  categoryId: string;
  name: string;
  description?: string;
  difficulty?: string;
  status?: 'DRAFT' | 'PUBLISHED';
};

export type UpdateQuestionBankData = Partial<CreateQuestionBankData>;

export type BankQuestionFilters = {
  search?: string;
  type?: string;
  difficulty?: string;
  topic?: string;
};

export type BankImportQuestionData = {
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

export const questionBanksService = {
  async list(filters?: { search?: string; courseId?: string; categoryId?: string; status?: string; difficulty?: string }) {
    const params = new URLSearchParams();
    if (filters?.search) params.set('search', filters.search);
    if (filters?.courseId) params.set('courseId', filters.courseId);
    if (filters?.categoryId) params.set('categoryId', filters.categoryId);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.difficulty) params.set('difficulty', filters.difficulty);
    const qs = params.toString();
    return unwrap<QuestionBank[]>(await api.get(`/question-banks${qs ? `?${qs}` : ''}`));
  },

  async get(id: string) {
    return unwrap<QuestionBank>(await api.get(`/question-banks/${id}`));
  },

  async create(data: CreateQuestionBankData) {
    return unwrap<QuestionBank>(await api.post('/question-banks', data));
  },

  async update(id: string, data: UpdateQuestionBankData) {
    return unwrap<QuestionBank>(await api.patch(`/question-banks/${id}`, data));
  },

  async remove(id: string) {
    return unwrap(await api.delete(`/question-banks/${id}`));
  },

  async duplicate(id: string) {
    return unwrap<QuestionBank>(await api.post(`/question-banks/${id}/duplicate`));
  },

  async getQuestions(id: string, filters?: BankQuestionFilters) {
    const params = new URLSearchParams();
    if (filters?.search) params.set('search', filters.search);
    if (filters?.type) params.set('type', filters.type);
    if (filters?.difficulty) params.set('difficulty', filters.difficulty);
    if (filters?.topic) params.set('topic', filters.topic);
    const qs = params.toString();
    return unwrap<QuestionBankDetail>(await api.get(`/question-banks/${id}/questions${qs ? `?${qs}` : ''}`));
  },

  async duplicateQuestion(id: string, questionId: string) {
    return unwrap<Question>(await api.post(`/question-banks/${id}/questions/duplicate`, { ids: [questionId] }));
  },

  async bulkDeleteQuestions(id: string, questionIds: string[]) {
    return unwrap<{ deleted: number }>(await api.post(`/question-banks/${id}/questions/bulk-delete`, { ids: questionIds }));
  },

  async reorderQuestions(id: string, questionIds: string[]) {
    return unwrap(await api.post(`/question-banks/${id}/questions/reorder`, { questionIds }));
  },

  async importQuestions(id: string, questions: BankImportQuestionData[]) {
    return unwrap<{ count: number }>(await api.post(`/question-banks/${id}/import`, { questions }));
  },

  async exportQuestions(id: string) {
    return unwrap<{ bank: { id: string; name: string }; questions: BankImportQuestionData[] }>(
      await api.get(`/question-banks/${id}/export`),
    );
  },
};
