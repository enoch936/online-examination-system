import axios from 'axios';
import { useAuthStore } from '@/store/auth.store';
import type { ApiEnvelope, AuthUser } from '@/types/api';

// API calls go through the same-origin Next.js proxy (next.config.mjs rewrites
// /api/:path* -> backend). Same-origin is required so the backend's httpOnly
// access_token/refresh_token cookies work on this host.
const baseURL = '/api/v1';

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

/**
 * Restores a session at app boot by refreshing via the httpOnly refresh_token
 * cookie. Returns true when a valid session was re-established.
 */
export async function restoreSession(): Promise<boolean> {
  try {
    const refresh = await api.post<ApiEnvelope<{ accessToken: string; user: AuthUser }>>('/auth/refresh', {});
    const { accessToken, user } = refresh.data.data;
    useAuthStore.getState().setSession(accessToken, user);
    return true;
  } catch {
    useAuthStore.getState().clearSession();
    return false;
  }
}

async function doRefresh(): Promise<string | null> {
  return (await restoreSession()) ? useAuthStore.getState().accessToken ?? null : null;
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
