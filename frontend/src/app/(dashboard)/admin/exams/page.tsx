'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Eye, Loader2, Send, Trash2, Filter, BookOpen, ListChecks, Users } from 'lucide-react';
import { toast } from 'sonner';
import { examsService } from '@/services/exams.service';
import { api } from '@/services/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'secondary' | 'outline'> = {
  DRAFT: 'default',
  PUBLISHED: 'success',
  IN_PROGRESS: 'warning',
  COMPLETED: 'secondary',
  ARCHIVED: 'outline',
};

export default function AdminExamsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');

  const { data: exams, isLoading, error } = useQuery({
    queryKey: ['admin', 'exams', statusFilter],
    queryFn: async () => {
      const all = await examsService.list();
      if (!statusFilter) return all;
      return all.filter((e) => e.status === statusFilter);
    },
  });

  const publishMutation = useMutation({
    mutationFn: (examId: string) => api.patch(`/exams/${examId}/publish`),
    onSuccess: () => {
      toast.success('Exam published');
      queryClient.invalidateQueries({ queryKey: ['admin', 'exams'] });
    },
    onError: () => toast.error('Failed to publish exam'),
  });

  const deleteMutation = useMutation({
    mutationFn: (examId: string) => api.delete(`/exams/${examId}`),
    onSuccess: () => {
      toast.success('Exam deleted');
      queryClient.invalidateQueries({ queryKey: ['admin', 'exams'] });
    },
    onError: () => toast.error('Failed to delete exam'),
  });

  const stats = exams?.reduce(
    (acc, e) => {
      acc.byStatus[e.status] = (acc.byStatus[e.status] || 0) + 1;
      return acc;
    },
    { byStatus: {} as Record<string, number> },
  );

  return (
    <div className="space-y-6">
      <div>
        <Badge variant="outline">Admin</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal">Exams</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Govern exam schedules, publication, and lifecycle controls.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BookOpen className="h-4 w-4" />
            {exams && <span>{exams.length} total</span>}
          </div>
          {stats && Object.entries(stats.byStatus).map(([s, c]) => (
            <Badge key={s} variant={statusVariant[s] ?? 'default'}>{s} ({c})</Badge>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            className="rounded-md border bg-background px-3 py-1.5 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-0">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-b p-4 last:border-0">
                <Skeleton className="h-4 w-40 flex-1" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Failed to load exams</CardTitle>
            <CardDescription>{(error as Error).message}</CardDescription>
          </CardHeader>
        </Card>
      ) : !exams || exams.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No exams found</CardTitle>
            <CardDescription>
              {statusFilter ? `No exams with status "${statusFilter}".` : 'No exams have been created yet.'}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left font-medium">Title</th>
                  <th className="p-3 text-left font-medium">Course</th>
                  <th className="p-3 text-left font-medium">Status</th>
                  <th className="p-3 text-center font-medium"><ListChecks className="mr-1 inline h-3 w-3" />Questions</th>
                  <th className="p-3 text-center font-medium"><Users className="mr-1 inline h-3 w-3" />Sessions</th>
                  <th className="p-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {exams.map((exam) => (
                  <tr key={exam.id} className="border-b transition-colors hover:bg-muted/50 last:border-0">
                    <td className="p-3 font-medium">{exam.title}</td>
                    <td className="p-3 text-muted-foreground">{exam.course?.name || '—'}</td>
                    <td className="p-3">
                      <Badge variant={statusVariant[exam.status] ?? 'default'}>{exam.status}</Badge>
                    </td>
                    <td className="p-3 text-center">{exam._count?.questions ?? 0}</td>
                    <td className="p-3 text-center">{exam._count?.sessions ?? 0}</td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" title="View">
                          <Eye className="h-4 w-4" />
                        </Button>
                        {exam.status === 'DRAFT' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Publish"
                            disabled={publishMutation.isPending}
                            onClick={() => publishMutation.mutate(exam.id)}
                          >
                            {publishMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Delete"
                          className="text-destructive hover:text-destructive"
                          disabled={deleteMutation.isPending}
                          onClick={() => {
                            if (window.confirm('Delete this exam?')) {
                              deleteMutation.mutate(exam.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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
