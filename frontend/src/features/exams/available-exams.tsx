'use client';

import { useQuery } from '@tanstack/react-query';
import { CalendarClock, PlayCircle, RotateCcw, Inbox, Clock, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api, unwrap } from '@/services/api';
import type { ExamSummary } from '@/types/api';

type AvailableExam = ExamSummary & {
  session: { id: string; status: string; attemptNumber: number } | null;
};

export function AvailableExams() {
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ['exams', 'available'],
    queryFn: async () => unwrap<AvailableExam[]>(await api.get('/exams/available')),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    );
  }

  const exams = data ?? [];

  if (exams.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <Badge variant="outline">Student</Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">Available exams</h1>
          <p className="mt-2 text-sm text-muted-foreground">Start or resume exams within their configured windows.</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12">
            <Inbox className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No exams available right now.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Badge variant="outline">Student</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal">Available exams</h1>
        <p className="mt-2 text-sm text-muted-foreground">Start or resume exams within their configured windows.</p>
      </div>
      <div className="grid gap-4">
        {exams.map((exam) => {
          const inProgress = exam.session?.status === 'IN_PROGRESS';
          return (
            <Card key={exam.id}>
              <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>{exam.title}</CardTitle>
                  <CardDescription>{exam.course?.subject?.name} / {exam.course?.name}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {inProgress && <Badge variant="warning">In progress</Badge>}
                  {exam.session?.status === 'SUBMITTED' && <Badge variant="secondary">Submitted</Badge>}
                  <Badge variant={exam.status === 'PUBLISHED' ? 'success' : 'secondary'}>{exam.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><CalendarClock className="h-4 w-4" />{exam.durationMinutes} min</span>
                  <span className="flex items-center gap-1"><Users className="h-4 w-4" />{exam._count?.questions ?? 0} questions</span>
                  <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{exam.attemptsAllowed} attempt{exam.attemptsAllowed > 1 ? 's' : ''}</span>
                </div>
                {inProgress ? (
                  <Button onClick={() => router.push(`/student/exams/${exam.session!.id}/resume`)}>
                    <RotateCcw className="h-4 w-4" />
                    Resume
                  </Button>
                ) : (
                  <Button onClick={() => router.push(`/student/exams/${exam.id}/take`)}>
                    <PlayCircle className="h-4 w-4" />
                    Start exam
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
