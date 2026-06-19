import axios from 'axios';
import { useAuthStore } from '@/store/auth.store';
import type { ApiEnvelope, AuthUser } from '@/types/api';

const baseURL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original?._retry) {
      original._retry = true;
      try {
        const refresh = await api.post<ApiEnvelope<{ accessToken: string; user: AuthUser }>>('/auth/refresh', {});
        useAuthStore.getState().setSession(refresh.data.data.accessToken, refresh.data.data.user);
        original.headers.Authorization = `Bearer ${refresh.data.data.accessToken}`;
        return api(original);
      } catch {
        useAuthStore.getState().clearSession();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export function unwrap<T>(response: { data: ApiEnvelope<T> }) {
  return response.data.data;
}
