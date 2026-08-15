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
  ChevronRight,
  ClipboardList,
  FileCheck,
  GraduationCap,
  LayoutDashboard,
  Library,
  LockKeyhole,
  LogOut,
  Mail,
  Menu,
  Monitor,
  Settings,
  Shield,
  UserCog,
  Users,
  UserRoundCog,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/store/auth.store';
import type { RoleName } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
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
      { href: '/instructor/exams/manage', label: 'Manage Exams', icon: ClipboardList },
      { href: '/instructor/exams/monitor', label: 'Monitor Exam', icon: Monitor },
      { href: '/instructor/messages', label: 'Messages', icon: Mail },
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
      { href: '/admin/subjects', label: 'Subjects', icon: BookOpen },
      { href: '/admin/courses', label: 'Courses', icon: GraduationCap },
      { href: '/admin/analytics', label: 'Analytics', icon: Activity },
      { href: '/admin/audit-logs', label: 'Audit Logs', icon: Shield },
      { href: '/admin/instructors', label: 'Instructors', icon: UserRoundCog },
    ],
  },
];

const roleLabel: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  INSTRUCTOR: 'Instructor',
  STUDENT: 'Student',
};

function pageTitle(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return 'Dashboard';
  const raw = segments[segments.length - 1];
  return raw
    .split('-')
    .map((s) => (s ? s[0].toUpperCase() + s.slice(1) : s))
    .join(' ');
}

function SidebarNav({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);

  const visibleGroups = nav.filter((group) => user && group.roles.some((r) => user.roles.includes(r)));

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      {visibleGroups.map((group) => (
        <div key={group.label} className={cn('mb-6', collapsed && 'flex flex-col items-center')}>
          {!collapsed && (
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              {group.label}
            </p>
          )}
          <div className={cn('space-y-1', collapsed && 'flex flex-col items-center')}>
            {group.items.map((item) => {
              const Icon = item.icon;
              const active =
                pathname === item.href ||
                (item.href !== '/student/dashboard' &&
                  item.href !== '/instructor/dashboard' &&
                  item.href !== '/admin/dashboard' &&
                  pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    'group relative flex h-10 items-center gap-3 rounded-lg text-sm font-medium transition-all duration-200',
                    collapsed ? 'w-10 justify-center px-0' : 'px-3',
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {active && !collapsed && (
                    <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-primary" />
                  )}
                  {active && collapsed && (
                    <span className="absolute left-1 top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-primary" />
                  )}
                  <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-primary' : 'group-hover:text-foreground')} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function Brand({ collapsed }: { collapsed: boolean }) {
  return (
    <div
      className={cn(
        'flex h-16 shrink-0 items-center border-b px-4',
        collapsed ? 'justify-center px-0' : 'gap-2.5',
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-indigo-500 text-primary-foreground shadow-md shadow-primary/25">
        <GraduationCap className="h-5 w-5" />
      </span>
      {!collapsed && (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight">OES Platform</p>
          <p className="truncate text-[11px] text-muted-foreground">Examination Suite</p>
        </div>
      )}
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch {
      // ignore backend errors
    }
    useAuthStore.getState().clearSession();
    router.push('/login');
  };

  const initials = user ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase() : '';
  const primaryRole = user?.roles[0] ?? '';

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden flex-col border-r bg-background/80 backdrop-blur-xl transition-[width] duration-300 lg:flex',
          collapsed ? 'w-[72px]' : 'w-64',
        )}
      >
        <Brand collapsed={collapsed} />
        <SidebarNav collapsed={collapsed} />

        <div className="shrink-0 border-t p-3">
          {!collapsed && user && (
            <div className="mb-2 flex items-center gap-3 rounded-lg bg-muted/60 px-3 py-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {initials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {user.firstName} {user.lastName}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">{roleLabel[primaryRole] ?? 'User'}</p>
              </div>
            </div>
          )}
          <div className={cn('flex items-center gap-1', collapsed && 'flex-col')}>
            <button
              onClick={handleLogout}
              title="Logout"
              className={cn(
                'flex h-9 items-center gap-2 rounded-lg text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive',
                collapsed ? 'w-9 justify-center' : 'flex-1 px-3',
              )}
            >
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>Log out</span>}
            </button>
            <button
              onClick={() => setCollapsed((c) => !c)}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                collapsed && 'mt-1',
              )}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="flex w-72 flex-col p-0">
          <Brand collapsed={false} />
          <div className="flex-1 overflow-hidden">
            <SidebarNav collapsed={false} />
          </div>
          <div className="border-t p-3">
            {user && (
              <div className="mb-2 flex items-center gap-3 rounded-lg bg-muted/60 px-3 py-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {initials}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">{roleLabel[primaryRole] ?? 'User'}</p>
                </div>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main column */}
      <div className={cn('flex min-h-screen flex-col transition-[padding] duration-300 lg:pl-64', collapsed && 'lg:pl-[72px]')}>
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-xl lg:px-8">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu className="h-5 w-5" />
          </Button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold tracking-tight">{pageTitle(pathname)}</h1>
          </div>

          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="icon" asChild aria-label="Notifications">
              <Link href={user?.roles.includes('STUDENT') ? '/student/notifications' : '/instructor/messages'}>
                <Bell className="h-4 w-4" />
              </Link>
            </Button>
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Logout">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-7xl animate-[fade-in_0.4s_ease-out_both]">{children}</div>
        </main>
      </div>
    </div>
  );
}
