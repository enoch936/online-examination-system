'use client';

import { useAuthStore } from '@/store/auth.store';

export function usePermissions(): string[] {
  const user = useAuthStore((state) => state.user);
  return user?.permissions ?? [];
}

export function useHasPermission() {
  const user = useAuthStore((state) => state.user);
  return (permission?: string): boolean => {
    if (!permission) return true;
    if (!user) return false;
    if (user.roles.includes('SUPER_ADMIN')) return true;
    return (user.permissions ?? []).includes(permission);
  };
}
