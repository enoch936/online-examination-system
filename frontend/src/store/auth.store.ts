'use client';

import { create } from 'zustand';
import type { AuthUser } from '@/types/api';

// Access/refresh tokens live ONLY in memory + httpOnly cookies set by the
// backend. No localStorage persistence, so a stolen XSS session can't survive
// a refresh (and never syncs across tabs).

type AuthState = {
  accessToken?: string;
  user?: AuthUser;
  setSession: (accessToken: string, user: AuthUser) => void;
  clearSession: () => void;
};

export const useAuthStore = create<AuthState>()((set) => ({
  setSession: (accessToken, user) => set({ accessToken, user }),
  clearSession: () => set({ accessToken: undefined, user: undefined }),
}));