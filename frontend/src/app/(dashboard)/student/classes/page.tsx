'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { GraduationCap, Inbox, CalendarClock, Users, ClipboardList } from 'lucide-react';
import { classesService } from '@/services/classes.service';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function StudentClassesPage() {
  const { data: myClasses, isLoading, error } = useQuery({
    queryKey: ['classes', 'my'],
    queryFn: () => classesService.my(),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Badge variant="outline">Student</Badge>
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Failed to load classes</CardTitle>
            <CardDescription>{(error as Error).message}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const classes = myClasses ?? [];

  return (
    <div className="space-y-6">
      <div>
        <Badge variant="outline">Student</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal">My classes</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Classes you are enrolled in, along with the exams your instructors pushed to them.
        </p>
      </div>

      {classes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12">
            <Inbox className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">You are not enrolled in any classes yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {classes.map((cls) => (
            <Card key={cls.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2">
                      <GraduationCap className="h-5 w-5 text-primary" />
                      <span className="truncate">{cls.name}</span>
                    </CardTitle>
                    <CardDescription className="mt-1">
                      <span className="font-mono text-xs">{cls.code}</span>
                    </CardDescription>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Instructor: {cls.instructor?.firstName} {cls.instructor?.lastName}
                </div>
              </CardHeader>
              <CardContent>
                {cls.exams.length === 0 ? (
                  <p className="py-3 text-center text-sm text-muted-foreground">No exams pushed to this class yet.</p>
                ) : (
                  <div className="space-y-2">
                    {cls.exams.map((exam) => (
                      <div key={exam.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{exam.title}</p>
                          <p className="flex items-center gap-2 text-xs text-muted-foreground">
                            <ClipboardList className="h-3 w-3" />
                            <span>{exam.totalMarks} marks</span>
                            <span>·</span>
                            <CalendarClock className="h-3 w-3" />
                            <span>{exam.durationMinutes} min</span>
                            <span className="ml-1 rounded bg-muted px-1.5 py-0.5">{exam.status}</span>
                          </p>
                        </div>
                        <Button size="sm" variant={exam.status === 'LIVE' ? 'default' : 'outline'} asChild>
                          <Link href="/student/exams">View</Link>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}