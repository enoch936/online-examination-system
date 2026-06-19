'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth.store';
import type { RoleName } from '@/types/api';

const roleRouteMap: Record<string, RoleName[]> = {
  admin: ['SUPER_ADMIN', 'ADMIN'],
  instructor: ['INSTRUCTOR'],
  student: ['STUDENT'],
};

function getDashboard(roles: RoleName[]) {
  const role = roles[0];
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') return '/admin/dashboard';
  if (role === 'INSTRUCTOR') return '/instructor/dashboard';
  return '/student/dashboard';
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (!accessToken) {
      router.push('/login');
      return;
    }

    const segment = pathname.split('/')[1];
    const allowed = roleRouteMap[segment];
    if (allowed && user && !user.roles.some((r) => allowed.includes(r))) {
      router.push(getDashboard(user.roles));
    }
  }, [accessToken, user, pathname, router]);

  if (!accessToken) {
    return null;
  }

  return <>{children}</>;
}