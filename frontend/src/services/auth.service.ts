import { api, unwrap } from './api';
import type { AuthUser } from '@/types/api';

type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

export const authService = {
  async login(payload: { email: string; password: string }) {
    return unwrap<AuthResponse>(await api.post('/auth/login', payload));
  },
  async register(payload: { email: string; firstName: string; lastName: string; password: string }) {
    return unwrap<AuthResponse>(await api.post('/auth/register', payload));
  },
  async logout() {
    return unwrap(await api.post('/auth/logout', {}));
  },
  async forgotPassword(payload: { email: string }) {
    return unwrap(await api.post('/auth/forgot-password', payload));
  },
  async resetPassword(payload: { token: string; password: string }) {
    return unwrap(await api.post('/auth/reset-password', payload));
  },
  async changePassword(payload: { currentPassword: string; newPassword: string }) {
    return unwrap(await api.post('/auth/change-password', payload));
  },
  async verifyEmail(payload: { token: string }) {
    return unwrap(await api.post('/auth/verify-email', payload));
  },
};
