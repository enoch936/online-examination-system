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

let refreshPromise: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  try {
    const refresh = await api.post<ApiEnvelope<{ accessToken: string; user: AuthUser }>>('/auth/refresh', {});
    const { accessToken, user } = refresh.data.data;
    useAuthStore.getState().setSession(accessToken, user);
    return accessToken;
  } catch {
    useAuthStore.getState().clearSession();
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const isAuthCall = typeof original?.url === 'string' && original.url.includes('/auth/');

    // 401: session expired. 403: token predates a permission change —
    // refreshing re-issues tokens with up-to-date roles/permissions.
    if ((status === 401 || status === 403) && !original?._retry && !isAuthCall) {
      original._retry = true;

      if (!refreshPromise) {
        refreshPromise = doRefresh().finally(() => { refreshPromise = null; });
      }

      const newToken = await refreshPromise;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }

      if (status === 401) {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }
    return Promise.reject(error);
  },
);

export function unwrap<T>(response: { data: ApiEnvelope<T> }) {
  return response.data.data;
}
