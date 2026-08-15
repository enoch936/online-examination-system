import { api, unwrap } from './api';
import type { Role } from '@/types/api';

export const rolesService = {
  async list() {
    return unwrap<Role[]>(await api.get('/roles'));
  },
  async assignPermission(data: { roleId: string; permissionId: string }) {
    return unwrap(await api.post('/roles/permissions', data));
  },
};
