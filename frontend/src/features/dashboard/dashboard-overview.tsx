'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity, FileCheck, ShieldCheck, Users } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { dashboardService } from '@/services/dashboard.service';

const iconMap: Record<string, typeof Users> = {
  activeCandidates: Users,
  publishedExams: FileCheck,
  liveSessions: Activity,
  pendingGrading: ShieldCheck,
};

export function DashboardOverview({ role }: { role: 'Student' | 'Instructor' | 'Admin' }) {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: dashboardService.getStats,
  });

  return (
    <div className="space-y-6">
      <div>
        <Badge variant="outline">{role}</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal">{role} dashboard</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Realtime exam operations, candidate progress, autosave health, results, and integrity signals.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : data?.metrics ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {data.metrics.map((metric) => {
            const Icon = iconMap[metric.key] ?? ShieldCheck;
            return (
              <Card key={metric.key}>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardDescription>{metric.label}</CardDescription>
                  <Icon className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold">{metric.value}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}

      {data?.chartData && data.chartData.length > 0 ? (
        <Card>
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
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip />
                <Area type="monotone" dataKey="submissions" stroke="hsl(var(--primary))" fill="url(#submissions)" />
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
