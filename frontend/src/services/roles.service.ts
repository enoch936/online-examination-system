import { api, unwrap } from './api';
import type { Role, RoleName } from '@/types/api';

export const rolesService = {
  async list() {
    return unwrap<Role[]>(await api.get('/roles'));
  },
  async assignPermission(data: { role: RoleName; permission: string }) {
    return unwrap(await api.post('/roles/permissions', data));
  },
  async revokePermission(data: { role: RoleName; permission: string }) {
    return unwrap(await api.delete('/roles/permissions', { data }));
  },
};
