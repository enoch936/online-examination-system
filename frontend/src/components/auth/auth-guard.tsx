'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { useHasPermission } from '@/hooks/use-permissions';
import type { RoleName } from '@/types/api';

const roleRouteMap: Record<string, RoleName[]> = {
  admin: ['SUPER_ADMIN', 'ADMIN'],
  instructor: ['INSTRUCTOR'],
  student: ['STUDENT'],
};

// Route prefix -> required permission (checked top to bottom, most specific first)
const routePermissionMap: Array<[RegExp, string]> = [
  [/^\/admin\/(roles|permissions)/, 'roles.manage'],
  [/^\/admin\/instructors/, 'users.read'],
  [/^\/admin\/users/, 'users.read'],
  [/^\/admin\/subjects/, 'subjects.manage'],
  [/^\/admin\/courses/, 'courses.manage'],
  [/^\/admin\/exams/, 'exams.manage'],
  [/^\/admin\/analytics/, 'reports.read'],
  [/^\/admin\/audit-logs/, 'audit.read'],
  [/^\/instructor\/question-bank/, 'questions.manage'],
  [/^\/instructor\/exams\/monitor/, 'sessions.monitor'],
  [/^\/instructor\/exams/, 'exams.manage'],
  [/^\/instructor\/courses/, 'courses.manage'],
  [/^\/instructor\/reports/, 'reports.read'],
];

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
  const hasPermission = useHasPermission();

  useEffect(() => {
    if (!accessToken) {
      router.push('/login');
      return;
    }

    const segment = pathname.split('/')[1];
    const allowed = roleRouteMap[segment];
    if (allowed && user && !user.roles.some((r) => allowed.includes(r))) {
      router.push(getDashboard(user.roles));
      return;
    }

    const required = routePermissionMap.find(([pattern]) => pattern.test(pathname))?.[1];
    if (required && user && !hasPermission(required)) {
      router.push(getDashboard(user.roles));
    }
  }, [accessToken, user, pathname, router, hasPermission]);

  if (!accessToken) {
    return null;
  }

  return <>{children}</>;
}
