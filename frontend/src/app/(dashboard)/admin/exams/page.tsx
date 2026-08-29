'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Eye, Loader2, Send, Trash2, Filter, BookOpen, ListChecks, Users, Search, X, Play, UserCheck, UserX, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { examsService } from '@/services/exams.service';
import { usersService } from '@/services/users.service';
import { api } from '@/services/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';

const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'secondary' | 'outline'> = {
  DRAFT: 'default',
  SCHEDULED: 'outline',
  PUBLISHED: 'success',
  LIVE: 'warning',
  CLOSED: 'secondary',
  ARCHIVED: 'outline',
};

export default function AdminExamsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [sessionsExamId, setSessionsExamId] = useState<string | null>(null);

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

  const startMutation = useMutation({
    mutationFn: (examId: string) => api.patch(`/exams/${examId}/start`),
    onSuccess: () => {
      toast.success('Exam started');
      queryClient.invalidateQueries({ queryKey: ['admin', 'exams'] });
    },
    onError: () => toast.error('Failed to start exam'),
  });

  const deleteMutation = useMutation({
    mutationFn: (examId: string) => api.delete(`/exams/${examId}`),
    onSuccess: () => {
      toast.success('Exam deleted');
      queryClient.invalidateQueries({ queryKey: ['admin', 'exams'] });
    },
    onError: () => toast.error('Failed to delete exam'),
  });

  const restartMutation = useMutation({
    mutationFn: (examId: string) => examsService.restart(examId),
    onSuccess: () => {
      toast.success('Exam restarted');
      queryClient.invalidateQueries({ queryKey: ['admin', 'exams'] });
    },
    onError: () => toast.error('Failed to restart exam'),
  });

  const { data: students } = useQuery({
    queryKey: ['users', 'STUDENT'],
    queryFn: () => usersService.list('STUDENT'),
    enabled: !!assigningId,
  });

  const { data: assignedStudents, refetch: refetchAssigned } = useQuery({
    queryKey: ['exam-assignments', assigningId],
    queryFn: () => examsService.getAssignedStudents(assigningId!),
    enabled: !!assigningId,
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, studentIds }: { id: string; studentIds: string[] }) => examsService.assignStudents(id, studentIds),
    onSuccess: () => { refetchAssigned(); toast.success('Students assigned'); setSelectedStudents([]); },
    onError: () => toast.error('Failed to assign students'),
  });

  const unassignMutation = useMutation({
    mutationFn: ({ id, studentId }: { id: string; studentId: string }) => examsService.unassignStudent(id, studentId),
    onSuccess: () => { refetchAssigned(); toast.success('Student unassigned'); },
    onError: () => toast.error('Failed to unassign student'),
  });

  const { data: examSessions, refetch: refetchSessions } = useQuery({
    queryKey: ['admin', 'exam-sessions', sessionsExamId],
    queryFn: async () => {
      const { unwrap } = await import('@/services/api');
      return unwrap<Array<{
        id: string;
        examId: string;
        studentId: string;
        student: { id: string; firstName: string; lastName: string; email: string };
        attemptNumber: number;
        status: string;
        startedAt: string | null;
        submittedAt: string | null;
        retakePermitted: boolean;
      }>>(await api.get(`/exam-sessions?examId=${sessionsExamId}`));
    },
    enabled: !!sessionsExamId,
  });

  const permitRetakeMutation = useMutation({
    mutationFn: (sessionId: string) => examsService.permitRetake(sessionId),
    onSuccess: () => { refetchSessions(); toast.success('Retake permitted'); },
    onError: () => toast.error('Failed to permit retake'),
  });

  const revokeRetakeMutation = useMutation({
    mutationFn: (sessionId: string) => examsService.revokeRetake(sessionId),
    onSuccess: () => { refetchSessions(); toast.success('Retake revoked'); },
    onError: () => toast.error('Failed to revoke retake'),
  });

  const filteredStudents = (students ?? []).filter((s) => {
    const q = studentSearch.toLowerCase();
    return !q || s.firstName.toLowerCase().includes(q) || s.lastName.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
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
        <Badge variant="outline" className="border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">Admin</Badge>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Exams</h1>
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
            <option value="LIVE">Live</option>
            <option value="CLOSED">Closed</option>
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
                    <td className="p-3 text-muted-foreground">{(exam.courses?.map((ec) => ec.course.name).filter(Boolean).join(', ')) || exam.course?.name || '—'}</td>
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
                        <Button
                          variant="ghost"
                          size="icon"
                          title="View sessions"
                          onClick={() => setSessionsExamId(exam.id)}
                        >
                          <ListChecks className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Assign students"
                          onClick={() => { setAssigningId(exam.id); setSelectedStudents([]); setStudentSearch(''); }}
                        >
                          <Users className="h-4 w-4" />
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
                        {exam.status === 'PUBLISHED' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Start now"
                            disabled={startMutation.isPending}
                            onClick={() => startMutation.mutate(exam.id)}
                          >
                            {startMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        {exam.status === 'CLOSED' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Restart exam"
                            disabled={restartMutation.isPending}
                            onClick={() => {
                              if (window.confirm('Restart this exam? A new draft will be created.')) {
                                restartMutation.mutate(exam.id);
                              }
                            }}
                          >
                            {restartMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RotateCcw className="h-4 w-4" />
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

      <Sheet open={!!assigningId} onOpenChange={(o) => { if (!o) { setAssigningId(null); setSelectedStudents([]); setStudentSearch(''); } }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>Assign Students</SheetTitle><SheetDescription>Select students to assign to this exam. Exams with no assignments are open to all students.</SheetDescription></SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-1.5">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input className="flex-1 bg-transparent text-sm outline-none" placeholder="Search students..." value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} />
            </div>

            {assignedStudents && assignedStudents.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Assigned ({assignedStudents.length})</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {assignedStudents.map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
                      <span>{s.firstName} {s.lastName} <span className="text-muted-foreground">({s.email})</span></span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => unassignMutation.mutate({ id: assigningId!, studentId: s.id })}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-sm font-medium mb-2">All students</p>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {filteredStudents.map((s) => (
                  <label key={s.id} className={`flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer text-sm ${selectedStudents.includes(s.id) ? 'border-primary bg-primary/5' : ''}`}>
                    <input type="checkbox" className="h-4 w-4" checked={selectedStudents.includes(s.id)} onChange={() => setSelectedStudents((prev) => prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id])} />
                    <span>{s.firstName} {s.lastName} <span className="text-muted-foreground">({s.email})</span></span>
                  </label>
                ))}
                {filteredStudents.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No students found</p>}
              </div>
            </div>

            <Button
              className="w-full"
              disabled={selectedStudents.length === 0 || assignMutation.isPending}
              onClick={() => assignMutation.mutate({ id: assigningId!, studentIds: selectedStudents })}
            >
              {assignMutation.isPending ? 'Assigning...' : `Assign ${selectedStudents.length} student${selectedStudents.length !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={!!sessionsExamId} onOpenChange={(o) => { if (!o) setSessionsExamId(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Exam Sessions</SheetTitle>
            <SheetDescription>View student sessions and manage retake permissions.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {!examSessions ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : examSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No sessions yet.</p>
            ) : (
              <div className="space-y-2">
                {examSessions.map((session) => (
                  <div key={session.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{session.student.firstName} {session.student.lastName}</p>
                      <p className="text-xs text-muted-foreground">
                        Attempt {session.attemptNumber} · {session.status}
                        {session.submittedAt && ` · Submitted ${new Date(session.submittedAt).toLocaleString()}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {(session.status === 'SUBMITTED' || session.status === 'AUTO_SUBMITTED') && (
                        session.retakePermitted ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-amber-600 border-amber-300"
                            disabled={revokeRetakeMutation.isPending}
                            onClick={() => revokeRetakeMutation.mutate(session.id)}
                          >
                            <UserX className="h-3.5 w-3.5 mr-1" />
                            Revoke
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-emerald-600 border-emerald-300"
                            disabled={permitRetakeMutation.isPending}
                            onClick={() => permitRetakeMutation.mutate(session.id)}
                          >
                            <UserCheck className="h-3.5 w-3.5 mr-1" />
                            Permit retake
                          </Button>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
