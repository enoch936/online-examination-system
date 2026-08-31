'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, PlayCircle, RotateCcw, Inbox, Clock, Users, Timer } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api, unwrap } from '@/services/api';
import type { ExamSummary } from '@/types/api';

type AvailableExam = ExamSummary & {
  session: { id: string; status: string; attemptNumber: number; retakePermitted?: boolean } | null;
};

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (days > 0) return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function Countdown({ target }: { target: number }) {
  const now = useNow();
  return <span className="font-mono">{formatCountdown(target - now)}</span>;
}

export function AvailableExams() {
  const router = useRouter();
  const now = useNow();

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
          <p className="mt-2 text-sm text-muted-foreground">Exams started by your instructor are available immediately, even outside their scheduled window.</p>
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
        <p className="mt-2 text-sm text-muted-foreground">Exams started by your instructor are available immediately, even outside their scheduled window.</p>
      </div>
      <div className="grid gap-4">
        {exams.map((exam) => {
          const startsAt = new Date(exam.startsAt).getTime();
          const endsAt = new Date(exam.endsAt).getTime();
          const inProgress = exam.session?.status === 'IN_PROGRESS';
          const isLive = exam.status === 'LIVE';
          const isPublished = exam.status === 'PUBLISHED';
          const hasSubmitted = exam.session?.status === 'SUBMITTED' || exam.session?.status === 'AUTO_SUBMITTED';
          const notStarted = now < startsAt;
          const inWindow = now >= startsAt && now <= endsAt;

          return (
            <Card key={exam.id}>
              <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>{exam.title}</CardTitle>
                  <CardDescription>
                    {(exam.courses?.map((ec) => `${ec.course.subject?.name ?? ''} / ${ec.course.name}`).filter(Boolean).join(', ')) ||
                      (exam.course?.subject ? `${exam.course.subject.name} / ${exam.course.name}` : '')}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {inProgress && <Badge variant="warning">In progress</Badge>}
                  {hasSubmitted && <Badge variant="secondary">Submitted</Badge>}
                  {isPublished && <Badge variant="outline">Waiting to start</Badge>}
                  {isLive && <Badge variant="success">Live</Badge>}
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><CalendarClock className="h-4 w-4" />{exam.durationMinutes} min</span>
                  <span className="flex items-center gap-1"><Users className="h-4 w-4" />{exam._count?.questions ?? 0} questions</span>
                  <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{exam.attemptsAllowed} attempt{exam.attemptsAllowed > 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-4">
                  {inProgress ? (
                    <span className="flex items-center gap-2 text-sm font-medium text-amber-600">
                      <Timer className="h-4 w-4" />In progress
                    </span>
                  ) : isPublished ? (
                    <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Timer className="h-4 w-4" />
                      {notStarted ? (
                        <>Starts in <Countdown target={startsAt} /></>
                      ) : (
                        <>Waiting for instructor to start</>
                      )}
                    </span>
                  ) : notStarted ? (
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Timer className="h-4 w-4" />Starts in <Countdown target={startsAt} />
                    </span>
                  ) : inWindow ? (
                    <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Timer className="h-4 w-4" />Ends in <Countdown target={endsAt} />
                    </span>
                  ) : null}
                  {inProgress ? (
                    <Button onClick={() => router.push(`/student/exams/${exam.session!.id}/resume`)}>
                      <RotateCcw className="h-4 w-4" />
                      Resume
                    </Button>
                  ) : hasSubmitted ? (
                    <Button disabled>
                      Already submitted
                    </Button>
                  ) : isPublished ? (
                    <Button disabled>
                      Not started yet
                    </Button>
                  ) : (
                    <Button disabled={!(inWindow || isLive)} onClick={() => router.push(`/student/exams/${exam.id}/take`)}>
                      <PlayCircle className="h-4 w-4" />
                      Start exam
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
