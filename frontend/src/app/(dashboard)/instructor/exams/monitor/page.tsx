'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { examsService } from '@/services/exams.service';
import { api, unwrap } from '@/services/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, AlertTriangle, CheckCircle, Users, Eye, Clock, Monitor, ArrowLeft } from 'lucide-react';

interface SessionInfo {
  id: string;
  studentId: string;
  student?: { firstName: string; lastName: string; email: string };
  status: string;
  startedAt?: string;
  violationsCount?: number;
  submittedAt?: string;
}

function SkeletonGrid() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96 mt-2" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-5 space-y-3">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <div className="flex gap-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
      <Monitor className="h-12 w-12 text-muted-foreground mb-3" />
      <p className="text-lg font-medium">No active exams to monitor</p>
      <p className="text-sm text-muted-foreground mt-1">Published or live exams will appear here.</p>
    </div>
  );
}

function SessionTable({ sessions }: { sessions: SessionInfo[] }) {
  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Users className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">No active sessions for this exam</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-left text-sm font-medium">Student</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Started</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Violations</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Submitted</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id} className="border-b hover:bg-muted/50">
              <td className="px-4 py-3 text-sm">
                {s.student ? `${s.student.firstName} ${s.student.lastName}` : s.studentId}
              </td>
              <td className="px-4 py-3">
                <Badge
                  variant={s.status === 'ACTIVE' ? 'warning' : s.status === 'COMPLETED' ? 'success' : 'secondary'}
                >
                  {s.status}
                </Badge>
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">
                {s.startedAt ? new Date(s.startedAt).toLocaleString() : '—'}
              </td>
              <td className="px-4 py-3">
                {(s.violationsCount ?? 0) > 0 ? (
                  <span className="flex items-center gap-1 text-sm text-red-600">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {s.violationsCount}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-sm text-emerald-600">
                    <CheckCircle className="h-3.5 w-3.5" />
                    0
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">
                {s.submittedAt ? new Date(s.submittedAt).toLocaleString() : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MonitorExamPage() {
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);

  const { data: exams, isLoading } = useQuery({
    queryKey: ['exams'],
    queryFn: () => examsService.list(),
  });

  const activeExams = (exams ?? []).filter(
    (e) => e.status === 'LIVE' || e.status === 'PUBLISHED',
  );

  const {
    data: sessions,
    isLoading: sessionsLoading,
    error: sessionsError,
  } = useQuery({
    queryKey: ['exam-sessions', selectedExamId],
    queryFn: async () => {
      return unwrap<SessionInfo[]>(await api.get(`/exam-sessions`, {
        params: { examId: selectedExamId },
      }));
    },
    enabled: !!selectedExamId,
  });

  if (isLoading) return <SkeletonGrid />;

  if (selectedExamId) {
    const exam = exams?.find((e) => e.id === selectedExamId);
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setSelectedExamId(null)}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <h1 className="text-2xl font-bold">{exam?.title ?? 'Exam details'}</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Monitoring active sessions for this exam
            </p>
          </div>
          <Badge variant="secondary">Instructor</Badge>
        </div>

        {sessionsLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : sessionsError ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/50 bg-destructive/5 py-12 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mb-3" />
            <p className="text-lg font-medium text-destructive">Failed to load sessions</p>
          </div>
        ) : (
          <SessionTable sessions={sessions ?? []} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Monitor exam</h1>
          <p className="text-sm text-muted-foreground">
            Track active candidates, timers, autosave state, focus events, and integrity violations.
          </p>
        </div>
        <Badge variant="secondary">Instructor</Badge>
      </div>

      {activeExams.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activeExams.map((exam) => (
            <Card
              key={exam.id}
              className="cursor-pointer transition-colors hover:border-primary"
              onClick={() => setSelectedExamId(exam.id)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold truncate">{exam.title}</h3>
                  <Badge variant={exam.status === 'LIVE' ? 'warning' : 'success'}>
                    {exam.status}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground truncate">
                  {exam.course?.name ?? 'No course'}
                </p>
                <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-lg font-bold">{exam._count?.sessions ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Sessions</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-amber-600">—</p>
                    <p className="text-xs text-muted-foreground">Violations</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-emerald-600">—</p>
                    <p className="text-xs text-muted-foreground">Submissions</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-center">
                  <Button variant="ghost" size="sm" className="gap-1 text-xs">
                    <Eye className="h-3.5 w-3.5" />
                    View details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
