import { api, unwrap } from './api';
import type { ContactMessage } from '@/types/api';

export type ContactMessageStatus = 'NEW' | 'READ' | 'RESOLVED';

export type ContactMessagePage = {
  data: ContactMessage[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    counts: Record<ContactMessageStatus, number>;
  };
};

export const contactService = {
  async send(data: { name: string; email: string; message: string }): Promise<ContactMessage> {
    return unwrap<ContactMessage>(await api.post('/contact', data));
  },

  async list(params: { q?: string; status?: string; page?: number; limit?: number } = {}): Promise<ContactMessagePage> {
    const query = new URLSearchParams();
    if (params.q) query.set('q', params.q);
    if (params.status) query.set('status', params.status);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return unwrap<ContactMessagePage>(await api.get(`/contact${qs ? `?${qs}` : ''}`));
  },

  async updateStatus(id: string, status: ContactMessageStatus): Promise<ContactMessage> {
    return unwrap<ContactMessage>(await api.patch(`/contact/${id}/status`, { status }));
  },
};
