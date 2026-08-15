import { api } from './api';
import type { ApiEnvelope, AuthUser } from '@/types/api';

export const profileService = {
  async getProfile() {
    const res = await api.get<ApiEnvelope<AuthUser>>('/auth/me');
    return res.data.data;
  },
  async updateProfile(payload: { firstName?: string; lastName?: string; email?: string; phone?: string; avatarUrl?: string }) {
    const res = await api.patch<ApiEnvelope<AuthUser>>('/auth/me', payload);
    return res.data.data;
  },
  async listUsers() {
    const res = await api.get<ApiEnvelope<AuthUser[]>>('/users');
    return res.data.data;
  },
  async getUser(id: string) {
    const res = await api.get<ApiEnvelope<AuthUser>>(`/users/${id}`);
    return res.data.data;
  },
  async updateUser(id: string, payload: { firstName?: string; lastName?: string; email?: string; phone?: string }) {
    const res = await api.patch<ApiEnvelope<AuthUser>>(`/users/${id}`, payload);
    return res.data.data;
  },
  async assignRole(userId: string, role: string) {
    const res = await api.patch<ApiEnvelope<AuthUser>>(`/users/${userId}/roles`, { role });
    return res.data.data;
  },
};
