import { api, unwrap } from './api';
import type { Certificate, PaginatedResponse } from '@/types/api';

export const certificatesService = {
  async list(params?: { examId?: string; page?: number; limit?: number }) {
    return unwrap<PaginatedResponse<Certificate>>(await api.get('/certificates', { params }));
  },
  async verify(verificationCode: string) {
    return unwrap<Certificate | null>(await api.get(`/certificates/verify/${verificationCode}`));
  },
  async issue(resultId: string) {
    return unwrap<Certificate>(await api.post(`/certificates/${resultId}/issue`));
  },
  async revoke(id: string) {
    return unwrap<{ id: string; revoked: true }>(await api.post(`/certificates/${id}/revoke`));
  },
  async reissue(id: string) {
    return unwrap<Certificate>(await api.post(`/certificates/${id}/reissue`));
  },
};
