import { api, unwrap } from './api';
import type { StudentMessage } from '@/types/api';

export type MessageSource = 'CONTACT' | 'EXAM_REPORT';

export const messagesService = {
  async list(examId?: string) {
    const q = examId ? `?examId=${examId}` : '';
    return unwrap<StudentMessage[]>(await api.get(`/messages${q}`));
  },

  async updateStatus(id: string, source: MessageSource, status: string) {
    return unwrap(await api.patch(`/messages/${id}/status`, { source, status }));
  },
};
