'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity, FileCheck, ShieldCheck, Users } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { dashboardService } from '@/services/dashboard.service';
import { cn } from '@/lib/utils';

const iconMap: Record<string, { icon: typeof Users; tint: string }> = {
  activeCandidates: { icon: Users, tint: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
  publishedExams: { icon: FileCheck, tint: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' },
  liveSessions: { icon: Activity, tint: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  pendingGrading: { icon: ShieldCheck, tint: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
};

const roleTone: Record<string, string> = {
  Student: 'border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400',
  Instructor: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  Admin: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
};

export function DashboardOverview({ role }: { role: 'Student' | 'Instructor' | 'Admin' }) {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: dashboardService.getStats,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <Badge variant="outline" className={cn('w-fit', roleTone[role])}>{role}</Badge>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">
          {role} dashboard
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Realtime exam operations, candidate progress, autosave health, results, and integrity signals.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="card-hover">
              <CardContent className="flex items-start justify-between p-5">
                <div className="space-y-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-16" />
                </div>
                <Skeleton className="h-10 w-10 rounded-xl" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : data?.metrics ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {data.metrics.map((metric) => {
            const meta = iconMap[metric.key] ?? { icon: ShieldCheck, tint: 'bg-primary/10 text-primary' };
            const Icon = meta.icon;
            return (
              <Card key={metric.key} className="card-hover">
                <CardContent className="flex items-start justify-between p-5">
                  <div>
                    <CardDescription>{metric.label}</CardDescription>
                    <p className="mt-2 text-3xl font-bold tracking-tight">{metric.value}</p>
                  </div>
                  <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', meta.tint)}>
                    <Icon className="h-5 w-5" />
                  </span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}

      {data?.chartData && data.chartData.length > 0 ? (
        <Card className="card-hover">
          <CardHeader>
            <CardTitle>Exam throughput</CardTitle>
            <CardDescription>Submissions for the current week.</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={data.chartData}>
                <defs>
                  <linearGradient id="submissions" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} width={32} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.75rem',
                    boxShadow: 'var(--shadow-card-hover)',
                    fontSize: '12px',
                  }}
                  cursor={{ stroke: 'hsl(var(--border))' }}
                />
                <Area type="monotone" dataKey="submissions" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#submissions)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ) : !isLoading ? (
        <Card>
          <CardHeader>
            <CardTitle>Exam throughput</CardTitle>
            <CardDescription>No submissions yet this week.</CardDescription>
          </CardHeader>
        </Card>
      ) : null}
    </div>
  );
}
