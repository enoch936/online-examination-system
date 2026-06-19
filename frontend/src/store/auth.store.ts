'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '@/types/api';

type AuthState = {
  accessToken?: string;
  user?: AuthUser;
  setSession: (accessToken: string, user: AuthUser) => void;
  clearSession: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      setSession: (accessToken, user) => set({ accessToken, user }),
      clearSession: () => set({ accessToken: undefined, user: undefined }),
    }),
    {
      name: 'oes-auth',
      partialize: (state) => ({ accessToken: state.accessToken, user: state.user }),
    },
  ),
);
