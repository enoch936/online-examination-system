'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { resultsService } from '@/services/results.service';
import { examsService } from '@/services/exams.service';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Search, FileQuestion } from 'lucide-react';

const gradeColors: Record<string, string> = {
  A: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  B: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  C: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  D: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  F: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

function GradeBadge({ grade }: { grade?: string | null }) {
  if (!grade) return <span className="text-sm text-muted-foreground">—</span>;
  const color = gradeColors[grade] ?? 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${color}`}>
      {grade}
    </span>
  );
}

function SkeletonTable() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96 mt-2" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-10 w-60" />
      </div>
      <Card>
        <CardContent className="p-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b p-4 last:border-0">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-8 rounded-md" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
      <Trophy className="h-12 w-12 text-muted-foreground mb-3" />
      <p className="text-lg font-medium">No results found</p>
      <p className="text-sm text-muted-foreground mt-1">
        Results will appear once students complete exams.
      </p>
    </div>
  );
}

export default function InstructorResultsPage() {
  const [examFilter, setExamFilter] = useState('');

  const { data: exams } = useQuery({
    queryKey: ['exams'],
    queryFn: () => examsService.list(),
  });

  const { data: resultsData, isLoading, error } = useQuery({
    queryKey: ['results', examFilter],
    queryFn: () => resultsService.list(examFilter ? { examId: examFilter } : undefined),
  });

  const results = resultsData?.data ?? [];

  if (isLoading) return <SkeletonTable />;
  if (error)
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Results</h1>
            <p className="text-sm text-muted-foreground">
              Review auto-graded attempts, complete manual grading, and publish results.
            </p>
          </div>
          <Badge variant="secondary">Instructor</Badge>
        </div>
        <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/50 bg-destructive/5 py-12 text-center">
          <FileQuestion className="h-12 w-12 text-destructive mb-3" />
          <p className="text-lg font-medium text-destructive">Failed to load results</p>
          <p className="text-sm text-muted-foreground mt-1">Please try again later.</p>
        </div>
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Results</h1>
          <p className="text-sm text-muted-foreground">
            Review auto-graded attempts, complete manual grading, and publish results.
          </p>
        </div>
        <Badge variant="secondary">Instructor</Badge>
      </div>

      <div className="flex gap-4">
        <select
          className="h-10 w-full max-w-xs rounded-md border bg-background px-3 text-sm"
          value={examFilter}
          onChange={(e) => setExamFilter(e.target.value)}
        >
          <option value="">All exams</option>
          {exams?.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </select>
      </div>

      {results.length === 0 ? (
        <EmptyState />
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left text-sm font-medium">Student</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Exam</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Score</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Percentage</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Grade</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-muted/50 last:border-0">
                    <td className="px-4 py-3 text-sm">
                      <span className="text-muted-foreground">Student</span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">{r.exam.title}</td>
                    <td className="px-4 py-3 text-sm">
                      {r.score}
                      <span className="text-muted-foreground"> / {r.maxScore}</span>
                    </td>
                    <td className="px-4 py-3 text-sm">{r.percentage.toFixed(1)}%</td>
                    <td className="px-4 py-3">
                      <GradeBadge grade={r.grade} />
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={r.passed ? 'success' : 'warning'}>
                        {r.passed ? 'Pass' : 'Fail'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {resultsData?.pagination && resultsData.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          Page {resultsData.pagination.page} of {resultsData.pagination.totalPages}
          {' '}({resultsData.pagination.total} total)
        </div>
      )}
    </div>
  );
}
