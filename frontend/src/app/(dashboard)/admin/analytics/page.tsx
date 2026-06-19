'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity, FileCheck, ShieldCheck, Users, BarChart3 } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '@/services/api';
import { dashboardService } from '@/services/dashboard.service';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const iconMap: Record<string, typeof Users> = {
  activeCandidates: Users,
  publishedExams: FileCheck,
  liveSessions: Activity,
  pendingGrading: ShieldCheck,
};

export default function AdminAnalyticsPage() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['admin', 'analytics'],
    queryFn: dashboardService.getStats,
  });

  const { data: extraStats } = useQuery({
    queryKey: ['admin', 'analytics', 'extra'],
    queryFn: async () => {
      const [users, exams] = await Promise.all([
        api.get('/users').then((r) => r.data.data),
        api.get('/exams').then((r) => r.data.data),
      ]);
      const roleCounts: Record<string, number> = {};
      const statusCounts: Record<string, number> = {};
      if (Array.isArray(users)) {
        users.forEach((u: any) => {
          u.roles?.forEach((r: any) => {
            const name = r.role?.name || 'UNKNOWN';
            roleCounts[name] = (roleCounts[name] || 0) + 1;
          });
        });
      }
      if (Array.isArray(exams)) {
        exams.forEach((e: any) => {
          const s = e.status || 'UNKNOWN';
          statusCounts[s] = (statusCounts[s] || 0) + 1;
        });
      }
      return { roleCounts, statusCounts };
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <Badge variant="outline">Admin</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal">Analytics</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Monitor throughput, pass rates, subject performance, candidate risk, and platform health.
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
      ) : stats?.metrics ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.metrics.map((metric) => {
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

      {extraStats && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4" /> Users by role
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(extraStats.roleCounts).map(([role, count]) => (
                  <div key={role} className="flex items-center justify-between text-sm">
                    <span className="capitalize text-muted-foreground">{role.replace(/_/g, ' ').toLowerCase()}</span>
                    <span className="font-semibold">{count}</span>
                  </div>
                ))}
                {Object.keys(extraStats.roleCounts).length === 0 && (
                  <p className="text-sm text-muted-foreground">No data</p>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Exams by status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(extraStats.statusCounts).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between text-sm">
                    <span className="capitalize text-muted-foreground">{status.toLowerCase()}</span>
                    <Badge variant="outline">{count}</Badge>
                  </div>
                ))}
                {Object.keys(extraStats.statusCounts).length === 0 && (
                  <p className="text-sm text-muted-foreground">No data</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {stats?.chartData && stats.chartData.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Exam throughput</CardTitle>
            <CardDescription>Submissions over time.</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.chartData}>
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
            <CardDescription>No submissions yet.</CardDescription>
          </CardHeader>
        </Card>
      ) : null}
    </div>
  );
}
