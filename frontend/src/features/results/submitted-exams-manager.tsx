'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { examsService } from '@/services/exams.service';
import { resultsService } from '@/services/results.service';
import { toast } from 'sonner';
import { Eye, FileQuestion, Loader2, Send, Trophy } from 'lucide-react';
import { SubmissionDetailSheet } from '@/features/results/submission-detail-sheet';

const GRADE_COLORS: Record<string, string> = {
  A: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  B: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  C: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  D: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  F: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

function GradeBadge({ grade }: { grade?: string | null }) {
  if (!grade) return <span className="text-sm text-muted-foreground">&mdash;</span>;
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
        GRADE_COLORS[grade] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300'
      }`}
    >
      {grade}
    </span>
  );
}

export function SubmittedExamsManager({ role }: { role: 'Instructor' | 'Admin' }) {
  const queryClient = useQueryClient();
  const [examFilter, setExamFilter] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data: exams } = useQuery({
    queryKey: ['exams'],
    queryFn: () => examsService.list(),
  });

  const { data: resultsData, isLoading, error } = useQuery({
    queryKey: ['results', examFilter],
    queryFn: () => resultsService.list(examFilter ? { examId: examFilter } : undefined),
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => resultsService.publish(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['results'] });
      queryClient.invalidateQueries({ queryKey: ['certificates'] });
      toast.success('Result published');
    },
    onError: (err: Error) => toast.error(err?.message || 'Failed to publish result'),
  });

  const results = resultsData?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Submitted exams</h1>
          <p className="text-sm text-muted-foreground">
            Review every submitted exam in detail, adjust grades, and issue certificates.
          </p>
        </div>
        <Badge variant="secondary">{role}</Badge>
      </div>

      <div className="flex gap-4">
        <select
          className="h-10 w-full max-w-xs rounded-md border bg-background px-3 text-sm"
          value={examFilter}
          onChange={(e) => setExamFilter(e.target.value)}
        >
          <option value="">All exams</option>
          {exams?.map((exam) => (
            <option key={exam.id} value={exam.id}>
              {exam.title}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="space-y-4 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <FileQuestion className="h-10 w-10 text-destructive" />
            <p className="text-sm font-medium text-destructive">Failed to load submitted exams</p>
            <p className="text-sm text-muted-foreground">Please try again later.</p>
          </CardContent>
        </Card>
      ) : results.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Trophy className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium">No submitted exams found</p>
            <p className="text-sm text-muted-foreground">Submitted attempts will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left text-sm font-medium">Student</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Exam</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Score</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Percentage</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Grade</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Certificate</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result) => {
                  const student = result.submission?.session?.student;
                  return (
                    <tr key={result.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="px-4 py-3 text-sm">
                        {student ? `${student.firstName} ${student.lastName}` : <span className="text-muted-foreground">Unknown</span>}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">{result.exam.title}</td>
                      <td className="px-4 py-3 text-sm">
                        {result.score}
                        <span className="text-muted-foreground"> / {result.maxScore}</span>
                      </td>
                      <td className="px-4 py-3 text-sm">{Number(result.percentage).toFixed(1)}%</td>
                      <td className="px-4 py-3">
                        <GradeBadge grade={result.grade} />
                      </td>
                      <td className="px-4 py-3">
                        {result.certificate ? (
                          <Badge variant="outline">Issued</Badge>
                        ) : result.passed ? (
                          <span className="text-xs text-muted-foreground">Not issued</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">&mdash;</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={result.passed ? 'success' : 'warning'}>
                          {result.passed ? 'Pass' : 'Fail'}
                        </Badge>
                        {!result.publishedAt && (
                          <span className="ml-2 text-[10px] text-muted-foreground">(unpublished)</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Open grading and certificate controls"
                            onClick={() => setDetailId(result.id)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {!result.publishedAt && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Publish"
                              onClick={() => publishMutation.mutate(result.id)}
                              disabled={publishMutation.isPending}
                            >
                              {publishMutation.isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Send className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {resultsData?.pagination && resultsData.pagination.totalPages > 1 && (
        <div className="text-center text-sm text-muted-foreground">
          Page {resultsData.pagination.page} of {resultsData.pagination.totalPages} ({resultsData.pagination.total} total)
        </div>
      )}

      <SubmissionDetailSheet
        resultId={detailId}
        open={Boolean(detailId)}
        onOpenChange={(next) => {
          if (!next) setDetailId(null);
        }}
      />
    </div>
  );
}
