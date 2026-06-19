'use client';

import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, Clock, Filter, SearchX } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { resultsService } from '@/services/results.service';
import type { Result } from '@/types/api';

type FilterMode = 'all' | 'passed' | 'failed';

function HistoryCard({ result }: { result: Result }) {
  return (
    <Card className="transition-colors hover:border-primary/50">
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle>{result.exam.title}</CardTitle>
          <CardDescription>
            {result.exam.course.subject.name} &middot; {result.exam.course.name}
          </CardDescription>
        </div>
        <Badge variant={result.passed ? 'success' : 'warning'}>
          {result.passed ? 'Passed' : 'Failed'}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <ClipboardCheck className="h-4 w-4" />
            <span>
              Score: {result.score}/{result.maxScore}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span>Grade: {result.grade ?? 'N/A'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span>Percentage: {result.percentage.toFixed(1)}%</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{new Date(result.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
        {result.feedback && (
          <p className="mt-3 text-sm text-muted-foreground">{result.feedback}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function ExamHistoryPage() {
  const [filter, setFilter] = useState<FilterMode>('all');
  const { data, isLoading, error } = useQuery({
    queryKey: ['student-history'],
    queryFn: () => resultsService.list(),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Badge variant="outline">Student</Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">Exam history</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Review submitted attempts, timestamps, grading status, and instructor feedback.
          </p>
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-72" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <Badge variant="outline">Student</Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">Exam history</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <SearchX className="h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium">Failed to load history</p>
            <p className="text-sm text-muted-foreground">Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const results = data?.data ?? [];
  const filtered = filter === 'all' ? results : results.filter((r) => (filter === 'passed' ? r.passed : !r.passed));

  return (
    <div className="space-y-6">
      <div>
        <Badge variant="outline">Student</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal">Exam history</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Review submitted attempts, timestamps, grading status, and instructor feedback.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {(['all', 'passed', 'failed'] as const).map((mode) => (
          <Button
            key={mode}
            variant={filter === mode ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(mode)}
          >
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <ClipboardCheck className="h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium">No history found</p>
            <p className="text-sm text-muted-foreground">
              {filter === 'all'
                ? 'You have not completed any exams yet.'
                : `No ${filter} exams in your history.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((result) => (
            <HistoryCard key={result.id} result={result} />
          ))}
        </div>
      )}
    </div>
  );
}
