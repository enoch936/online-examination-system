'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Search, UserRoundCog, GraduationCap, CheckCircle2, XCircle, BookOpen, Users, Library, SlidersHorizontal, ExternalLink } from 'lucide-react';
import { instructorsService } from '@/services/instructors.service';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

const statusVariant: Record<string, 'success' | 'warning' | 'default' | 'outline'> = {
  ACTIVE: 'success',
  SUSPENDED: 'warning',
  DEACTIVATED: 'outline',
  PENDING_VERIFICATION: 'outline',
};

export default function AdminInstructorsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data: instructors, isLoading, error } = useQuery({
    queryKey: ['admin', 'instructors', search, statusFilter],
    queryFn: () => instructorsService.list({ search: search || undefined, status: statusFilter || undefined }),
  });

  const stats = useMemo(() => {
    const all = instructors ?? [];
    return {
      total: all.length,
      active: all.filter((i) => i.status === 'ACTIVE').length,
      inactive: all.filter((i) => i.status !== 'ACTIVE').length,
    };
  }, [instructors]);

  return (
    <div className="space-y-6">
      <div>
        <Badge variant="outline" className="border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">Admin</Badge>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Instructor Management</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          View, monitor, and control every instructor on the platform. Manage courses, exams, question banks, access
          permissions, and audit activity.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UserRoundCog className="h-5 w-5" />
            </span>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Total instructors</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-2xl font-bold">{stats.active}</p>
              <p className="text-sm text-muted-foreground">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <XCircle className="h-5 w-5" />
            </span>
            <div>
              <p className="text-2xl font-bold">{stats.inactive}</p>
              <p className="text-sm text-muted-foreground">Inactive</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <select
            className="h-10 rounded-lg border bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="DEACTIVATED">Deactivated</option>
            <option value="PENDING_VERIFICATION">Pending verification</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-0">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-b p-4 last:border-0">
                <Skeleton className="h-4 w-48 flex-1" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Failed to load instructors</CardTitle>
            <CardDescription>{(error as Error).message}</CardDescription>
          </CardHeader>
        </Card>
      ) : !instructors || instructors.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No instructors found</CardTitle>
            <CardDescription>
              {statusFilter || search ? 'No instructors match your filters.' : 'No instructor accounts exist yet.'}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left font-medium">Instructor</th>
                  <th className="p-3 text-center font-medium"><GraduationCap className="mr-1 inline h-3 w-3" />Courses</th>
                  <th className="p-3 text-center font-medium"><BookOpen className="mr-1 inline h-3 w-3" />Exams</th>
                  <th className="p-3 text-center font-medium"><Library className="mr-1 inline h-3 w-3" />Question Banks</th>
                  <th className="p-3 text-center font-medium"><Users className="mr-1 inline h-3 w-3" />Students</th>
                  <th className="p-3 text-left font-medium">Status</th>
                  <th className="p-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {instructors.map((instructor) => (
                  <tr key={instructor.id} className="border-b transition-colors hover:bg-muted/50 last:border-0">
                    <td className="p-3">
                      <p className="font-medium">
                        {instructor.firstName} {instructor.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">{instructor.email}</p>
                    </td>
                    <td className="p-3 text-center">{instructor.courses}</td>
                    <td className="p-3 text-center">{instructor.exams}</td>
                    <td className="p-3 text-center">{instructor.questionBanks}</td>
                    <td className="p-3 text-center">{instructor.students}</td>
                    <td className="p-3">
                      <Badge variant={statusVariant[instructor.status] ?? 'default'}>{instructor.status}</Badge>
                    </td>
                    <td className="p-3 text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/instructors/${instructor.id}`}>
                          <ExternalLink className="mr-1 h-3.5 w-3.5" />Manage
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
