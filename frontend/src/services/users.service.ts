import { api, unwrap } from './api';
import type { User } from '@/types/api';

export const usersService = {
  // Accepts either a bare role name (existing callers) or a filter object.
  async list(roleOrParams?: string | { role?: string; q?: string; status?: string }) {
    const params = typeof roleOrParams === 'string' ? { role: roleOrParams } : roleOrParams;
    const query = new URLSearchParams();
    if (params?.role) query.set('role', params.role);
    if (params?.q) query.set('q', params.q);
    if (params?.status) query.set('status', params.status);
    const qs = query.toString();
    return unwrap<User[]>(await api.get(`/users${qs ? `?${qs}` : ''}`));
  },
  async get(id: string) {
    return unwrap<User>(await api.get(`/users/${id}`));
  },
  async create(data: { email: string; firstName: string; lastName: string; password: string }) {
    return unwrap<User>(await api.post('/users', data));
  },
  async update(id: string, data: Partial<{ firstName: string; lastName: string; email: string; phone: string; status: string }>) {
    return unwrap<User>(await api.patch(`/users/${id}`, data));
  },
  async removeRole(userId: string, roleName: string) {
    return unwrap<User>(await api.delete(`/users/${userId}/roles/${roleName}`));
  },
  async resetPassword(userId: string, newPassword: string) {
    return unwrap<User>(await api.patch(`/users/${userId}/password`, { newPassword }));
  },
  async remove(id: string) {
    return unwrap<{ id: string; deleted: boolean }>(await api.delete(`/users/${id}`));
  },
};
