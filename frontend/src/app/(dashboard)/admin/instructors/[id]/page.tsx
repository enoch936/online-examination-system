'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  ExternalLink,
  GraduationCap,
  Library,
  ListChecks,
  Loader2,
  Mail,
  Monitor,
  Play,
  Plus,
  Search,
  Send,
  Share2,
  ShieldAlert,
  Trash2,
  Users,
  UserRoundCog,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { instructorsService } from '@/services/instructors.service';
import { examsService, EXAM_PERMISSION_LEVELS, type ExamPermissionLevel } from '@/services/exams.service';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';

const statusVariant: Record<string, 'success' | 'warning' | 'default' | 'outline'> = {
  ACTIVE: 'success',
  SUSPENDED: 'warning',
  DEACTIVATED: 'outline',
  PENDING_VERIFICATION: 'outline',
};

const examStatusVariant: Record<string, 'default' | 'success' | 'warning' | 'secondary' | 'outline'> = {
  DRAFT: 'default',
  SCHEDULED: 'secondary',
  PUBLISHED: 'success',
  LIVE: 'warning',
  CLOSED: 'outline',
  ARCHIVED: 'outline',
};

function ShareSheet({ examId, open, onClose }: { examId: string | null; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [level, setLevel] = useState<ExamPermissionLevel>('VIEWER');

  const { data: access } = useQuery({
    queryKey: ['exam-access', examId],
    queryFn: () => examsService.getAccess(examId!),
    enabled: open && !!examId,
  });

  const { data: instructors } = useQuery({
    queryKey: ['exams', 'instructors'],
    queryFn: () => examsService.getInstructors(),
    enabled: open && !!examId,
  });

  const shareMutation = useMutation({
    mutationFn: () => examsService.share(examId!, selected, level),
    onSuccess: () => {
      toast.success('Access granted');
      setSelected([]);
      queryClient.invalidateQueries({ queryKey: ['exam-access', examId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'instructor'] });
    },
    onError: () => toast.error('Failed to grant access'),
  });

  const levelMutation = useMutation({
    mutationFn: ({ instructorId, permissionLevel }: { instructorId: string; permissionLevel: ExamPermissionLevel }) =>
      examsService.updateShareLevel(examId!, instructorId, permissionLevel),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exam-access', examId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'instructor'] });
    },
    onError: () => toast.error('Failed to update permission'),
  });

  const unshareMutation = useMutation({
    mutationFn: (instructorId: string) => examsService.unshare(examId!, instructorId),
    onSuccess: () => {
      toast.success('Access revoked');
      queryClient.invalidateQueries({ queryKey: ['exam-access', examId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'instructor'] });
    },
    onError: () => toast.error('Failed to revoke access'),
  });

  const ownerId = access?.owner.id;
  const candidates = (instructors ?? []).filter((i) => i.id !== ownerId && !(access?.shares ?? []).some((s) => s.id === i.id));

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) { onClose(); setSelected([]); } }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Exam sharing &amp; permissions</SheetTitle>
          <SheetDescription>
            Control which instructors can monitor or manage this exam. The owner retains full control; admins can
            override any permission.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div>
            <p className="mb-2 text-sm font-medium">Shared with</p>
            {(access?.shares ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Not shared with any instructor yet.</p>
            ) : (
              <div className="space-y-2">
                {(access?.shares ?? []).map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{s.firstName} {s.lastName}</p>
                      <p className="truncate text-xs text-muted-foreground">{s.email}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <select
                        className="h-9 rounded-lg border bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        value={s.permissionLevel}
                        disabled={levelMutation.isPending}
                        onChange={(e) => levelMutation.mutate({ instructorId: s.id, permissionLevel: e.target.value as ExamPermissionLevel })}
                      >
                        {EXAM_PERMISSION_LEVELS.map((l) => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                      </select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        disabled={unshareMutation.isPending}
                        onClick={() => unshareMutation.mutate(s.id)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Grant access to another instructor</p>
            <div className="mb-3 flex items-center gap-2">
              <select
                className="h-9 flex-1 rounded-lg border bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={level}
                onChange={(e) => setLevel(e.target.value as ExamPermissionLevel)}
              >
                {EXAM_PERMISSION_LEVELS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {candidates.map((i) => (
                <label
                  key={i.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm ${selected.includes(i.id) ? 'border-primary bg-primary/5' : ''}`}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={selected.includes(i.id)}
                    onChange={() => setSelected((prev) => (prev.includes(i.id) ? prev.filter((x) => x !== i.id) : [...prev, i.id]))}
                  />
                  <span>
                    {i.firstName} {i.lastName} <span className="text-muted-foreground">({i.email})</span>
                  </span>
                </label>
              ))}
              {candidates.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No other instructors available.</p>}
            </div>
            <Button
              className="mt-3 w-full"
              disabled={selected.length === 0 || shareMutation.isPending}
              onClick={() => shareMutation.mutate()}
            >
              {shareMutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
              Grant access ({selected.length})
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function AdminInstructorDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const queryClient = useQueryClient();
  const [sharingExamId, setSharingExamId] = useState<string | null>(null);
  const [auditFilters, setAuditFilters] = useState({ action: '', entity: '', from: '', to: '' });

  const { data: instructor, isLoading, error } = useQuery({
    queryKey: ['admin', 'instructor', id],
    queryFn: () => instructorsService.get(id),
  });

  const { data: auditLogs } = useQuery({
    queryKey: ['admin', 'instructor-audit', id, auditFilters],
    queryFn: () =>
      instructorsService.getAuditLogs(id, {
        action: auditFilters.action || undefined,
        entity: auditFilters.entity || undefined,
        from: auditFilters.from || undefined,
        to: auditFilters.to || undefined,
      }),
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: ({ status }: { status: string }) => instructorsService.updateStatus(id, status),
    onSuccess: (_data, variables) => {
      toast.success(`Instructor ${variables.status.toLowerCase()}`);
      queryClient.invalidateQueries({ queryKey: ['admin', 'instructor', id] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'instructors'] });
    },
    onError: () => toast.error('Failed to update instructor status'),
  });

  const publishMutation = useMutation({
    mutationFn: (examId: string) => examsService.publish(examId),
    onSuccess: () => {
      toast.success('Exam published');
      queryClient.invalidateQueries({ queryKey: ['admin', 'instructor', id] });
    },
    onError: () => toast.error('Failed to publish exam'),
  });

  const startMutation = useMutation({
    mutationFn: (examId: string) => examsService.startNow(examId),
    onSuccess: () => {
      toast.success('Exam started');
      queryClient.invalidateQueries({ queryKey: ['admin', 'instructor', id] });
    },
    onError: () => toast.error('Failed to start exam'),
  });

  const endMutation = useMutation({
    mutationFn: (examId: string) => examsService.endNow(examId),
    onSuccess: () => {
      toast.success('Exam ended — open sessions force-submitted');
      queryClient.invalidateQueries({ queryKey: ['admin', 'instructor', id] });
    },
    onError: () => toast.error('Failed to end exam'),
  });

  const deleteMutation = useMutation({
    mutationFn: (examId: string) => examsService.remove(examId),
    onSuccess: () => {
      toast.success('Exam closed');
      queryClient.invalidateQueries({ queryKey: ['admin', 'instructor', id] });
    },
    onError: () => toast.error('Failed to delete exam'),
  });

  const auditActions = useMemo(() => [...new Set((auditLogs ?? []).map((l) => l.action))].sort(), [auditLogs]);
  const auditEntities = useMemo(() => [...new Set((auditLogs ?? []).map((l) => l.entity))].sort(), [auditLogs]);

  const profile = instructor?.profile;
  const stats = instructor?.stats;

  const runStatus = (status: string, label: string) => {
    if (window.confirm(`Set this instructor to "${label}"?`)) {
      statusMutation.mutate({ status });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !instructor) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">Failed to load instructor</CardTitle>
          <CardDescription>{(error as Error)?.message ?? 'Instructor not found'}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!profile || !stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No data</CardTitle>
          <CardDescription>Instructor profile information is unavailable.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/instructors"><ArrowLeft className="mr-1 h-4 w-4" />Instructors</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UserRoundCog className="h-7 w-7" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-semibold">{profile.firstName} {profile.lastName}</h1>
                  <Badge variant={statusVariant[profile.status] ?? 'default'}>{profile.status}</Badge>
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />{profile.email}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  Last login: {profile.lastLoginAt ? new Date(profile.lastLoginAt).toLocaleString() : '—'}
                  <span className="mx-1">·</span>
                  Joined {new Date(profile.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {profile.status !== 'ACTIVE' && (
                <Button size="sm" onClick={() => runStatus('ACTIVE', 'Active')}>
                  <CheckCircle2 className="mr-1 h-4 w-4" />Activate
                </Button>
              )}
              {profile.status === 'ACTIVE' && (
                <Button size="sm" variant="outline" className="text-amber-600" onClick={() => runStatus('SUSPENDED', 'Suspended')}>
                  <ShieldAlert className="mr-1 h-4 w-4" />Suspend
                </Button>
              )}
              {profile.status !== 'DEACTIVATED' && profile.status !== 'ACTIVE' && (
                <Button size="sm" variant="outline" onClick={() => runStatus('ACTIVE', 'Active')}>
                  <CheckCircle2 className="mr-1 h-4 w-4" />Restore
                </Button>
              )}
              {profile.status === 'ACTIVE' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive"
                  onClick={() => runStatus('DEACTIVATED', 'Deactivated')}
                >
                  <X className="mr-1 h-4 w-4" />Deactivate
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {[
          { label: 'Assigned courses', value: stats.courses, icon: GraduationCap },
          { label: 'Question banks', value: stats.questionBanks, icon: Library },
          { label: 'Questions', value: stats.questions, icon: ListChecks },
          { label: 'Exams', value: stats.exams, icon: BookOpen },
          { label: 'Students', value: stats.students, icon: Users },
          { label: 'Live sessions', value: stats.liveSessions, icon: Monitor },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <s.icon className="h-4 w-4" />
              </span>
              <p className="mt-3 text-xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {instructor.liveSessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Monitor className="h-4 w-4" />Live monitoring</CardTitle>
            <CardDescription>Active sessions across this instructor's exams. Admin can override monitoring on any session.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {instructor.liveSessions.map((s) => (
                <div key={s.sessionId} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{s.studentName} <span className="text-muted-foreground">— {s.examTitle}</span></p>
                    <p className="text-xs text-muted-foreground">Risk: {s.riskLevel} · Last activity {s.lastActivityAt ? new Date(s.lastActivityAt).toLocaleTimeString() : '—'}</p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/instructor/exams/monitor"><Monitor className="mr-1 h-3.5 w-3.5" />Open monitor</Link>
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4" />Exams ({instructor.exams.length})
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Admin can view, monitor, edit, publish, end, and control every exam regardless of ownership.
            </p>
          </div>
        </CardHeader>
        {instructor.exams.length === 0 ? (
          <CardContent><p className="text-sm text-muted-foreground">This instructor has not created any exams.</p></CardContent>
        ) : (
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left font-medium">Title</th>
                    <th className="p-3 text-left font-medium">Course</th>
                    <th className="p-3 text-left font-medium">Status</th>
                    <th className="p-3 text-center font-medium">Sessions</th>
                    <th className="p-3 text-left font-medium">Shared with</th>
                    <th className="p-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {instructor.exams.map((exam) => (
                    <tr key={exam.id} className="border-b transition-colors hover:bg-muted/50 last:border-0">
                      <td className="p-3 font-medium">{exam.title}</td>
                      <td className="p-3 text-muted-foreground">{exam.course || '—'}</td>
                      <td className="p-3">
                        <Badge variant={examStatusVariant[exam.status] ?? 'default'}>{exam.status}</Badge>
                      </td>
                      <td className="p-3 text-center">{exam.sessions}</td>
                      <td className="p-3">
                        {exam.shares.length === 0 ? (
                          <span className="text-xs text-muted-foreground">Owner only</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {exam.shares.map((s) => (
                              <Badge key={s.id} variant="secondary" className="text-xs">
                                {s.firstName} · {s.permissionLevel}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" title="View exam" asChild>
                            <Link href={`/instructor/exams/${exam.id}`}><ExternalLink className="h-4 w-4" /></Link>
                          </Button>
                          {exam.isLive && (
                            <Button variant="ghost" size="icon" title="Monitor live" asChild>
                              <Link href="/instructor/exams/monitor"><Monitor className="h-4 w-4" /></Link>
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" title="Share / permissions" onClick={() => setSharingExamId(exam.id)}>
                            <Share2 className="h-4 w-4" />
                          </Button>
                          {exam.status === 'DRAFT' && (
                            <Button variant="ghost" size="icon" title="Publish" disabled={publishMutation.isPending} onClick={() => publishMutation.mutate(exam.id)}>
                              {publishMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            </Button>
                          )}
                          {exam.status === 'PUBLISHED' && (
                            <Button variant="ghost" size="icon" title="Start now" disabled={startMutation.isPending} onClick={() => startMutation.mutate(exam.id)}>
                              {startMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                            </Button>
                          )}
                          {exam.status === 'LIVE' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="End now"
                              className="text-destructive"
                              disabled={endMutation.isPending}
                              onClick={() => {
                                if (window.confirm(`End "${exam.title}" now? All open sessions will be force-submitted.`)) endMutation.mutate(exam.id);
                              }}
                            >
                              {endMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Close / delete"
                            className="text-destructive"
                            disabled={deleteMutation.isPending}
                            onClick={() => {
                              if (window.confirm(`Close "${exam.title}"?`)) deleteMutation.mutate(exam.id);
                            }}
                          >
                            {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Library className="h-4 w-4" />Question banks ({instructor.questionBanks.length})</CardTitle>
          </CardHeader>
          {instructor.questionBanks.length === 0 ? (
            <CardContent><p className="text-sm text-muted-foreground">No question banks created by this instructor.</p></CardContent>
          ) : (
            <CardContent className="space-y-2">
              {instructor.questionBanks.map((b) => (
                <div key={b.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{b.name}</p>
                    <p className="text-xs text-muted-foreground">{b.course ?? 'No course'} · {b.questions} questions</p>
                  </div>
                  <Badge variant={b.status === 'PUBLISHED' ? 'success' : 'default'}>{b.status}</Badge>
                </div>
              ))}
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><GraduationCap className="h-4 w-4" />Assigned courses ({instructor.courses.length})</CardTitle>
            <CardDescription>Courses this instructor's exams and question banks belong to.</CardDescription>
          </CardHeader>
          {instructor.courses.length === 0 ? (
            <CardContent><p className="text-sm text-muted-foreground">No courses linked to this instructor yet.</p></CardContent>
          ) : (
            <CardContent className="flex flex-wrap gap-2">
              {instructor.courses.map((c) => (
                <Badge key={c.id} variant="outline" className="gap-1 py-1">
                  <GraduationCap className="h-3 w-3" />{c.name} ({c.examCount})
                </Badge>
              ))}
            </CardContent>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" />Students ({instructor.students.length})</CardTitle>
          <CardDescription>Distinct students assigned to this instructor's exams.</CardDescription>
        </CardHeader>
        {instructor.students.length === 0 ? (
          <CardContent><p className="text-sm text-muted-foreground">No students assigned to this instructor's exams.</p></CardContent>
        ) : (
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {instructor.students.map((s) => (
                <span key={s.id} className="rounded-md bg-muted px-3 py-1.5 text-sm">
                  {s.firstName} {s.lastName} <span className="text-xs text-muted-foreground">({s.email})</span>
                </span>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Search className="h-4 w-4" />Audit log ({auditLogs?.length ?? 0})</CardTitle>
          <CardDescription>Filter activity performed by this instructor across the platform.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <select
              className="h-10 rounded-lg border bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={auditFilters.action}
              onChange={(e) => setAuditFilters((f) => ({ ...f, action: e.target.value }))}
            >
              <option value="">All actions</option>
              {auditActions.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <select
              className="h-10 rounded-lg border bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={auditFilters.entity}
              onChange={(e) => setAuditFilters((f) => ({ ...f, entity: e.target.value }))}
            >
              <option value="">All entities</option>
              {auditEntities.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
            <Input type="date" value={auditFilters.from} onChange={(e) => setAuditFilters((f) => ({ ...f, from: e.target.value }))} />
            <Input type="date" value={auditFilters.to} onChange={(e) => setAuditFilters((f) => ({ ...f, to: e.target.value }))} />
            <Button
              variant="outline"
              onClick={() => setAuditFilters({ action: '', entity: '', from: '', to: '' })}
            >
              Reset filters
            </Button>
          </div>

          {(auditLogs ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No audit events match your filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left font-medium">Timestamp</th>
                    <th className="p-3 text-left font-medium">Action</th>
                    <th className="p-3 text-left font-medium">Entity</th>
                    <th className="p-3 text-left font-medium">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs!.map((log) => (
                    <tr key={log.id} className="border-b transition-colors hover:bg-muted/50 last:border-0">
                      <td className="whitespace-nowrap p-3 text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="font-mono text-xs">{log.action}</Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {log.entity}
                        {log.entityId && <span className="ml-1 font-mono text-xs">#{log.entityId.slice(0, 8)}</span>}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {log.before || log.after ? (
                          <span className="font-mono">{log.before ?? '—'} → {log.after ?? '—'}</span>
                        ) : (
                          <span>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ShareSheet examId={sharingExamId} open={!!sharingExamId} onClose={() => setSharingExamId(null)} />
    </div>
  );
}
