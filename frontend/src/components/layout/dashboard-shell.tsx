'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  ChevronLeft,
  FileCheck,
  GraduationCap,
  LayoutDashboard,
  Library,
  LockKeyhole,
  LogOut,
  Monitor,
  PanelLeft,
  Settings,
  Shield,
  UserCog,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/store/auth.store';
import type { RoleName } from '@/types/api';
import { ThemeToggle } from './theme-toggle';

type NavGroup = {
  label: string;
  roles: RoleName[];
  items: Array<{ href: string; label: string; icon: React.ComponentType<{ className?: string }> }>;
};

const nav: NavGroup[] = [
  {
    label: 'Student',
    roles: ['STUDENT'] as RoleName[],
    items: [
      { href: '/student/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/student/exams', label: 'Available Exams', icon: FileCheck },
      { href: '/student/results', label: 'Results', icon: BarChart3 },
      { href: '/student/certificates', label: 'Certificates', icon: Shield },
      { href: '/student/notifications', label: 'Notifications', icon: Bell },
      { href: '/student/settings', label: 'Settings', icon: Settings },
    ],
  },
  {
    label: 'Instructor',
    roles: ['INSTRUCTOR'] as RoleName[],
    items: [
      { href: '/instructor/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/instructor/question-bank', label: 'Question Bank', icon: Library },
      { href: '/instructor/exams/create', label: 'Create Exam', icon: BookOpen },
      { href: '/instructor/exams/monitor', label: 'Monitor Exam', icon: Monitor },
      { href: '/instructor/reports', label: 'Reports', icon: BarChart3 },
    ],
  },
  {
    label: 'Admin',
    roles: ['SUPER_ADMIN', 'ADMIN'] as RoleName[],
    items: [
      { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/admin/users', label: 'Users', icon: Users },
      { href: '/admin/roles', label: 'Roles', icon: UserCog },
      { href: '/admin/permissions', label: 'Permissions', icon: LockKeyhole },
      { href: '/admin/analytics', label: 'Analytics', icon: Activity },
      { href: '/admin/audit-logs', label: 'Audit Logs', icon: Shield },
    ],
  },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch {
      // ignore backend errors
    }
    useAuthStore.getState().clearSession();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 hidden border-r bg-background transition-[width] duration-200 lg:block',
          collapsed ? 'w-16' : 'w-72',
        )}
      >
        <div
          className={cn(
            'flex h-16 items-center border-b font-semibold',
            collapsed ? 'justify-center px-0' : 'gap-2 px-5',
          )}
        >
          <GraduationCap className="h-5 w-5 shrink-0 text-primary" />
          {!collapsed && <span className="truncate">Online Examination</span>}
        </div>
        <div className="group relative h-[calc(100vh-4rem)] overflow-y-auto px-3 py-4">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className={cn(
              'absolute right-0 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-opacity hover:bg-muted hover:text-foreground',
              collapsed && 'right-1/2 translate-x-1/2',
            )}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>

          {nav
            .filter((group) => user && group.roles.some((r) => user.roles.includes(r)))
            .map((group) => (
              <div key={group.label} className={cn('mb-5', collapsed && 'flex flex-col items-center')}>
                {!collapsed && (
                  <p className="px-3 pb-2 text-xs font-semibold uppercase text-muted-foreground">{group.label}</p>
                )}
                <div className={cn('space-y-1', collapsed && 'flex flex-col items-center')}>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          'flex h-10 items-center gap-3 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                          collapsed ? 'w-10 justify-center px-0' : 'px-3',
                          active &&
                            collapsed &&
                            'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
                          active &&
                            !collapsed &&
                            'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      </aside>
      <div className={cn('transition-[padding] duration-200', collapsed ? 'lg:pl-16' : 'lg:pl-72')}>
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/90 px-4 backdrop-blur lg:px-8">
          <div>
            <p className="text-sm font-semibold">Enterprise OES</p>
            <p className="text-xs text-muted-foreground">Secure exams, monitoring, analytics</p>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {user.firstName} {user.lastName}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
            <ThemeToggle />
          </div>
        </header>
        <main className="px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
