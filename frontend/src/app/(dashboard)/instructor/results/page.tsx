'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { resultsService } from '@/services/results.service';
import { examsService } from '@/services/exams.service';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { Trophy, Search, FileQuestion, Send, CheckCircle2, Loader2 } from 'lucide-react';

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
  const queryClient = useQueryClient();
  const [examFilter, setExamFilter] = useState('');
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [gradeForm, setGradeForm] = useState<Record<string, { score: string; feedback: string }>>({});

  const { data: exams } = useQuery({
    queryKey: ['exams'],
    queryFn: () => examsService.list(),
  });

  const { data: resultsData, isLoading, error } = useQuery({
    queryKey: ['results', examFilter],
    queryFn: () => resultsService.list(examFilter ? { examId: examFilter } : undefined),
  });

  const { data: gradingDetail } = useQuery({
    queryKey: ['result-detail', gradingId],
    queryFn: () => resultsService.get(gradingId!),
    enabled: !!gradingId,
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => resultsService.publish(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['results'] });
      toast.success('Result published');
    },
    onError: () => toast.error('Failed to publish result'),
  });

  const gradeMutation = useMutation({
    mutationFn: ({ id, answers }: { id: string; answers: Array<{ answerId: string; score: number; feedback?: string }> }) =>
      resultsService.grade(id, answers),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['results'] });
      toast.success('Grades saved');
      setGradingId(null);
    },
    onError: () => toast.error('Failed to save grades'),
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
                      <td className="px-4 py-3 text-sm">{r.percentage.toFixed(1)}%</td>
                      <td className="px-4 py-3">
                        <GradeBadge grade={r.grade} />
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={r.passed ? 'success' : 'warning'}>
                          {r.passed ? 'Pass' : 'Fail'}
                        </Badge>
                        {!r.publishedAt && (
                          <span className="ml-2 text-[10px] text-muted-foreground">(unpublished)</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {!r.publishedAt && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Publish"
                              onClick={() => publishMutation.mutate(r.id)}
                              disabled={publishMutation.isPending}
                            >
                              {publishMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                            </Button>
                          )}
                          {gradingDetail?.submission?.session?.answers?.some(
                            (a) => a.question.type === 'ESSAY' || a.question.type === 'MATCHING'
                          ) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Manual grading"
                              onClick={() => {
                                setGradingId(r.id);
                                void resultsService.get(r.id).then((d) => {
                                  const form: Record<string, { score: string; feedback: string }> = {};
                                  for (const a of d.submission?.session?.answers ?? []) {
                                    form[a.id] = { score: String(a.score ?? ''), feedback: a.feedback ?? '' };
                                  }
                                  setGradeForm(form);
                                });
                              }}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
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
          Page {resultsData.pagination.page} of {resultsData.pagination.totalPages}
          {' '}({resultsData.pagination.total} total)
        </div>
      )}

      <Sheet open={!!gradingId} onOpenChange={(o) => { if (!o) setGradingId(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Manual grading</SheetTitle>
            <SheetDescription>Review and score essay / matching answers.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            {gradingDetail?.submission?.session?.answers
              ?.filter((a) => a.question.type === 'ESSAY' || a.question.type === 'MATCHING')
              .map((answer) => {
                const f = gradeForm[answer.id] ?? { score: '', feedback: '' };
                return (
                  <Card key={answer.id}>
                    <CardHeader>
                      <CardTitle className="text-sm leading-6">{answer.question.prompt}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">
                        {answer.answerText || <span className="text-muted-foreground italic">No answer given</span>}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium">Score</label>
                          <input
                            type="number"
                            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                            value={f.score}
                            onChange={(e) => setGradeForm({ ...gradeForm, [answer.id]: { ...f, score: e.target.value } })}
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium">Max</label>
                          <p className="h-9 flex items-center text-sm text-muted-foreground">{Number(answer.question.points)} pts</p>
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium">Feedback</label>
                        <textarea
                          className="min-h-[60px] w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                          value={f.feedback}
                          onChange={(e) => setGradeForm({ ...gradeForm, [answer.id]: { ...f, feedback: e.target.value } })}
                          placeholder="Optional feedback..."
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            <Button
              className="w-full"
              onClick={() => {
                if (!gradingId) return;
                const answers = Object.entries(gradeForm).map(([answerId, f]) => ({
                  answerId,
                  score: Number(f.score) || 0,
                  feedback: f.feedback || undefined,
                }));
                gradeMutation.mutate({ id: gradingId, answers });
              }}
              disabled={gradeMutation.isPending}
            >
              {gradeMutation.isPending ? 'Saving...' : 'Save grades'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
