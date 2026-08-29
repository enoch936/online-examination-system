import { api, unwrap } from './api';
import type { User } from '@/types/api';

export const usersService = {
  async list(role?: string) {
    const params = role ? `?role=${role}` : '';
    return unwrap<User[]>(await api.get(`/users${params}`));
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
};
