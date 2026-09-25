'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { resultsService } from '@/services/results.service';
import { examsService } from '@/services/exams.service';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Trophy, FileQuestion, Send, Loader2, Eye } from 'lucide-react';
import { SubmissionDetailSheet } from '@/features/results/submission-detail-sheet';

export default function AdminResultsPage() {
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
      toast.success('Result published');
    },
    onError: () => toast.error('Failed to publish result'),
  });

  const results = resultsData?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Submitted exams</h1>
          <p className="text-sm text-muted-foreground">
            Review every student&apos;s submitted exam in detail — answers, correct answers, and scores.
          </p>
        </div>
        <Badge variant="secondary">Admin</Badge>
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
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left text-sm font-medium">Student</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Exam</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Score</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Percentage</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => {
                  const s = r.submission?.session?.student;
                  return (
                    <tr key={r.id} className="border-b hover:bg-muted/50 last:border-0">
                      <td className="px-4 py-3 text-sm">
                        {s ? `${s.firstName} ${s.lastName}` : <span className="text-muted-foreground">Unknown</span>}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">{r.exam.title}</td>
                      <td className="px-4 py-3 text-sm">
                        {r.score}
                        <span className="text-muted-foreground"> / {r.maxScore}</span>
                      </td>
                      <td className="px-4 py-3 text-sm">{Number(r.percentage).toFixed(1)}%</td>
                      <td className="px-4 py-3">
                        <Badge variant={r.passed ? 'success' : 'warning'}>{r.passed ? 'Pass' : 'Fail'}</Badge>
                        {!r.publishedAt && <span className="ml-2 text-[10px] text-muted-foreground">(unpublished)</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="View submitted exam in detail"
                            onClick={() => setDetailId(r.id)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {!r.publishedAt && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Publish"
                              onClick={() => publishMutation.mutate(r.id)}
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
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          Page {resultsData.pagination.page} of {resultsData.pagination.totalPages} ({resultsData.pagination.total} total)
        </div>
      )}

      <SubmissionDetailSheet
        resultId={detailId}
        open={Boolean(detailId)}
        onOpenChange={(o) => { if (!o) setDetailId(null); }}
      />
    </div>
  );
}
