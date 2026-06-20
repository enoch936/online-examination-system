'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '@/types/api';

const AUTH_COOKIE = 'oes-auth-token';

function setTokenCookie(token: string | undefined) {
  if (typeof document === 'undefined') return;
  if (token) {
    document.cookie = `${AUTH_COOKIE}=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
  } else {
    document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0`;
  }
}

type AuthState = {
  accessToken?: string;
  user?: AuthUser;
  setSession: (accessToken: string, user: AuthUser) => void;
  clearSession: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      setSession: (accessToken, user) => {
        set({ accessToken, user });
        setTokenCookie(accessToken);
      },
      clearSession: () => {
        set({ accessToken: undefined, user: undefined });
        setTokenCookie(undefined);
      },
    }),
    {
      name: 'oes-auth',
      partialize: (state) => ({ accessToken: state.accessToken, user: state.user }),
      onRehydrateStorage: () => (state) => {
        setTokenCookie(state?.accessToken);
      },
    },
  ),
);
