import { api, unwrap } from './api';
import type { Certificate } from '@/types/api';

export const certificatesService = {
  async list() {
    return unwrap<Certificate[]>(await api.get('/certificates'));
  },
};
