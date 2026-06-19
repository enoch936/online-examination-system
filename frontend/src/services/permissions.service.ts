import { api, unwrap } from './api';
import type { Permission } from '@/types/api';

export const permissionsService = {
  async list() {
    return unwrap<Permission[]>(await api.get('/permissions'));
  },
  async create(data: { key: string; label: string; module: string }) {
    return unwrap<Permission>(await api.post('/permissions', data));
  },
};
