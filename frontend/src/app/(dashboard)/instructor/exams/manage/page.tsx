'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { examsService, EXAM_PERMISSION_LEVELS, type ExamPermissionLevel } from '@/services/exams.service';
import { usersService } from '@/services/users.service';
import { coursesService } from '@/services/courses.service';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { toast } from 'sonner';
import {
  Eye, Send, ClipboardList, Users, Loader2, Calendar, Pencil, Trash2, Plus, Search, X, Play, RotateCcw, XCircle, Share2, ArrowLeftRight,
} from 'lucide-react';
import type { ExamSummary } from '@/types/api';

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  SCHEDULED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  PUBLISHED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  LIVE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  CLOSED: 'bg-gray-900 text-gray-100 dark:bg-gray-900 dark:text-gray-100',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${statusColors[status] ?? ''}`}>
      {status}
    </span>
  );
}

function examCoursesLabel(exam: ExamSummary): string {
  const names = exam.courses?.map((ec) => ec.course.name).filter(Boolean) ?? [];
  return names.length > 0 ? names.join(', ') : (exam.course?.name ?? 'No course');
}

function examBanksLabel(exam: ExamSummary): string {
  const names = exam.questionBanks?.map((qb) => qb.questionBank.name).filter(Boolean) ?? [];
  return names.join(', ');
}

function SkeletonGrid() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-96 mt-2" /></div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-10 w-60" />
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}><CardContent className="p-5 space-y-3">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
            <div className="flex gap-2"><Skeleton className="h-5 w-16 rounded-full" /><Skeleton className="h-5 w-16 rounded-full" /></div>
            <div className="flex gap-2 pt-2"><Skeleton className="h-9 flex-1" /><Skeleton className="h-9 flex-1" /></div>
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
      <ClipboardList className="h-12 w-12 text-muted-foreground mb-3" />
      <p className="text-lg font-medium">No exams found</p>
      <p className="text-sm text-muted-foreground mt-1">Create your first exam to get started.</p>
      <Button asChild className="mt-4"><Link href="/instructor/exams/create">Create exam</Link></Button>
    </div>
  );
}

function isEditable(status: string) {
  return status === 'DRAFT' || status === 'SCHEDULED' || status === 'PUBLISHED';
}

const canManage = (exam: ExamSummary) => exam.isOwner !== false || exam.myPermission === 'CO_OWNER';

export default function ManageExamPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [selectedSharing, setSelectedSharing] = useState<string[]>([]);
  const [shareLevel, setShareLevel] = useState<ExamPermissionLevel>('VIEWER');
  const [transferringId, setTransferringId] = useState<string | null>(null);
  const [transferTarget, setTransferTarget] = useState('');

  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    instructions: '',
    durationMinutes: '',
    totalMarks: '',
    passingMarks: '',
    attemptsAllowed: '1',
    startsAt: '',
    endsAt: '',
    randomizeQuestions: true,
    randomizeOptions: true,
    fullscreenRequired: true,
    showResultImmediately: false,
    negativeMarkingRate: '0',
  });

  const { data: exams, isLoading, error, refetch } = useQuery({
    queryKey: ['exams'],
    queryFn: () => examsService.list(),
  });

  const { data: courses } = useQuery({
    queryKey: ['courses'],
    queryFn: () => coursesService.list(),
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

  const filtered = (exams ?? []).filter((e) =>
    e.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredStudents = (students ?? []).filter((s) => {
    const q = studentSearch.toLowerCase();
    return !q || s.firstName.toLowerCase().includes(q) || s.lastName.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => examsService.publish(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['exams'] }); toast.success('Exam published'); },
    onError: () => toast.error('Failed to publish exam'),
  });

  const startMutation = useMutation({
    mutationFn: (id: string) => examsService.startNow(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['exams'] }); toast.success('Exam started'); },
    onError: () => toast.error('Failed to start exam'),
  });

  const restartMutation = useMutation({
    mutationFn: (id: string) => examsService.restart(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['exams'] }); toast.success('Exam restarted'); },
    onError: () => toast.error('Failed to restart exam'),
  });

  const endNowMutation = useMutation({
    mutationFn: (id: string) => examsService.endNow(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['exams'] }); toast.success('Exam ended — sessions were force-submitted'); },
    onError: () => toast.error('Failed to end exam'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => examsService.remove(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['exams'] }); toast.success('Exam closed'); setDeletingId(null); },
    onError: () => toast.error('Failed to close exam'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => examsService.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['exams'] }); toast.success('Exam updated'); setEditingId(null); },
    onError: () => toast.error('Failed to update exam'),
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

  const activeAccessId = sharingId ?? transferringId;

  const { data: sharingAccess, refetch: refetchAccess } = useQuery({
    queryKey: ['exam-access', activeAccessId],
    queryFn: () => examsService.getAccess(activeAccessId!),
    enabled: !!activeAccessId,
  });

  const { data: instructors } = useQuery({
    queryKey: ['exams-instructors'],
    queryFn: () => examsService.getInstructors(),
    enabled: !!sharingId,
  });

  const shareMutation = useMutation({
    mutationFn: ({ id, instructorIds, permissionLevel }: { id: string; instructorIds: string[]; permissionLevel: ExamPermissionLevel }) =>
      examsService.share(id, instructorIds, permissionLevel),
    onSuccess: () => {
      refetchAccess();
      void queryClient.invalidateQueries({ queryKey: ['exams'] });
      toast.success('Monitor access granted');
      setSelectedSharing([]);
    },
    onError: () => toast.error('Failed to grant access'),
  });

  const levelMutation = useMutation({
    mutationFn: ({ id, instructorId, permissionLevel }: { id: string; instructorId: string; permissionLevel: ExamPermissionLevel }) =>
      examsService.updateShareLevel(id, instructorId, permissionLevel),
    onSuccess: () => {
      refetchAccess();
      void queryClient.invalidateQueries({ queryKey: ['exams'] });
      toast.success('Permission level updated');
    },
    onError: () => toast.error('Failed to update permission level'),
  });

  const unshareMutation = useMutation({
    mutationFn: ({ id, instructorId }: { id: string; instructorId: string }) => examsService.unshare(id, instructorId),
    onSuccess: () => {
      refetchAccess();
      void queryClient.invalidateQueries({ queryKey: ['exams'] });
      toast.success('Monitor access revoked');
    },
    onError: () => toast.error('Failed to revoke access'),
  });

  const transferMutation = useMutation({
    mutationFn: ({ id, toInstructorId }: { id: string; toInstructorId: string }) => examsService.transferOwnership(id, toInstructorId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['exams'] });
      toast.success('Ownership transferred');
      setTransferringId(null);
      setTransferTarget('');
    },
    onError: () => toast.error('Failed to transfer ownership'),
  });

  const availableInstructors = (instructors ?? []).filter(
    (i) => i.id !== sharingAccess?.owner?.id && !(sharingAccess?.shares ?? []).some((s) => s.id === i.id),
  );

  const transferCandidates = (instructors ?? []).filter((i) => i.id !== sharingAccess?.owner?.id);

  function openEdit(exam: ExamSummary) {
    setEditForm({
      title: exam.title,
      description: exam.description ?? '',
      instructions: exam.instructions ?? '',
      durationMinutes: String(exam.durationMinutes),
      totalMarks: String(exam.totalMarks),
      passingMarks: String(exam.passingMarks),
      attemptsAllowed: String(exam.attemptsAllowed),
      startsAt: exam.startsAt ? exam.startsAt.slice(0, 16) : '',
      endsAt: exam.endsAt ? exam.endsAt.slice(0, 16) : '',
      randomizeQuestions: exam.randomizeQuestions,
      randomizeOptions: exam.randomizeOptions,
      fullscreenRequired: exam.fullscreenRequired,
      showResultImmediately: exam.showResultImmediately,
      negativeMarkingRate: String(exam.negativeMarkingRate),
    });
    setEditingId(exam.id);
  }

  function handleSaveEdit() {
    if (!editingId) return;
    const data: Record<string, unknown> = {};
    if (editForm.title.trim()) data.title = editForm.title.trim();
    if (editForm.description) data.description = editForm.description || undefined;
    if (editForm.instructions) data.instructions = editForm.instructions || undefined;
    const dur = Number(editForm.durationMinutes);
    if (dur > 0) data.durationMinutes = dur;
    const tm = Number(editForm.totalMarks);
    if (tm > 0) data.totalMarks = tm;
    const pm = Number(editForm.passingMarks);
    if (pm >= 0) data.passingMarks = pm;
    data.attemptsAllowed = Number(editForm.attemptsAllowed) || 1;
    if (editForm.startsAt) data.startsAt = new Date(editForm.startsAt).toISOString();
    if (editForm.endsAt) data.endsAt = new Date(editForm.endsAt).toISOString();
    data.randomizeQuestions = editForm.randomizeQuestions;
    data.randomizeOptions = editForm.randomizeOptions;
    data.fullscreenRequired = editForm.fullscreenRequired;
    data.showResultImmediately = editForm.showResultImmediately;
    data.negativeMarkingRate = Number(editForm.negativeMarkingRate) || 0;
    updateMutation.mutate({ id: editingId, data });
  }

  function toggleStudent(id: string) {
    setSelectedStudents((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  if (isLoading) return <SkeletonGrid />;
  if (error) return <SkeletonGrid />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Manage exams</h1>
          <p className="text-sm text-muted-foreground">
            Publish, close, edit, assign students, and inspect exam configurations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">Instructor</Badge>
          <Button asChild><Link href="/instructor/exams/create"><Plus className="mr-2 h-4 w-4" />Create exam</Link></Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 w-72">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input className="flex-1 bg-transparent text-sm outline-none" placeholder="Search exams..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      {!exams || exams.length === 0 ? (
        <EmptyState />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
          <Search className="h-8 w-8 mb-2" />
          <p>No exams match your search</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((exam) => (
            <Card key={exam.id} className="flex flex-col">
              <CardContent className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{exam.title}</h3>
                    {exam.isOwner === false && (
                      <p className="mt-0.5 text-xs text-muted-foreground">Shared with you for monitoring</p>
                    )}
                  </div>
                  <StatusBadge status={exam.status} />
                </div>
                <div className="mt-3 space-y-1.5 text-sm text-muted-foreground flex-1">
                  <p className="truncate">{examCoursesLabel(exam)}</p>
                  {examBanksLabel(exam) && <p className="truncate text-xs">Banks: {examBanksLabel(exam)}</p>}
                  <p className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{exam.durationMinutes} min</p>
                  <p className="text-xs text-muted-foreground">
                    {exam.passingMarks}/{exam.totalMarks} passing
                  </p>
                  <div className="flex gap-3 pt-1 flex-wrap">
                    <span className="flex items-center gap-1 text-xs"><ClipboardList className="h-3.5 w-3.5" />{exam._count?.questions ?? 0} Q</span>
                    <span className="flex items-center gap-1 text-xs"><Users className="h-3.5 w-3.5" />{exam._count?.sessions ?? 0} sessions</span>
                    <span className="flex items-center gap-1 text-xs"><Users className="h-3.5 w-3.5" />{exam._count?.assignments ?? 0} assigned</span>
                  </div>
                </div>
                <div className="mt-4 flex gap-2 pt-3 border-t flex-wrap">
                  <Button variant="outline" size="sm" className="flex-1" asChild>
                    <Link href={`/instructor/exams/${exam.id}`}><Eye className="mr-1 h-3.5 w-3.5" />View</Link>
                  </Button>
                  {canManage(exam) && (
                    <Button variant="outline" size="sm" onClick={() => { setSharingId(exam.id); setSelectedSharing([]); setShareLevel('VIEWER'); }}>
                      <Share2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {canManage(exam) && (
                    <Button variant="outline" size="sm" onClick={() => { setTransferringId(exam.id); setTransferTarget(''); }}>
                      <ArrowLeftRight className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {canManage(exam) && isEditable(exam.status) && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => openEdit(exam)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => { setAssigningId(exam.id); setSelectedStudents([]); }}>
                        <Users className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                  {canManage(exam) && (exam.status === 'DRAFT' || exam.status === 'SCHEDULED') && (
                    <Button size="sm" onClick={() => publishMutation.mutate(exam.id)} disabled={publishMutation.isPending}>
                      {publishMutation.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1 h-3.5 w-3.5" />}
                      Publish
                    </Button>
                  )}
                  {canManage(exam) && exam.status === 'PUBLISHED' && (
                    <Button size="sm" onClick={() => startMutation.mutate(exam.id)} disabled={startMutation.isPending}>
                      {startMutation.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1 h-3.5 w-3.5" />}
                      Start now
                    </Button>
                  )}
                  {canManage(exam) && exam.status === 'CLOSED' && (
                    <Button variant="outline" size="sm" onClick={() => restartMutation.mutate(exam.id)} disabled={restartMutation.isPending}>
                      {restartMutation.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="mr-1 h-3.5 w-3.5" />}
                      Restart
                    </Button>
                  )}
                  {canManage(exam) && exam.status === 'LIVE' && (
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={endNowMutation.isPending}
                      onClick={() => {
                        if (window.confirm(`End "${exam.title}" now? All open sessions will be force-submitted and the exam will be closed before the scheduled end time.`)) {
                          endNowMutation.mutate(exam.id);
                        }
                      }}
                    >
                      {endNowMutation.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <XCircle className="mr-1 h-3.5 w-3.5" />}
                      End now
                    </Button>
                  )}
                  {canManage(exam) && (isEditable(exam.status) || exam.status === 'LIVE') && (
                    <Button variant="destructive" size="sm" onClick={() => setDeletingId(exam.id)} disabled={deleteMutation.isPending}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={!!editingId} onOpenChange={(o) => { if (!o) setEditingId(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader><SheetTitle>Edit Exam</SheetTitle><SheetDescription>Update exam settings and schedule.</SheetDescription></SheetHeader>
          <div className="mt-6 space-y-5">
            <div><label className="mb-1 block text-sm font-medium">Title</label>
              <input className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} /></div>
            <div><label className="mb-1 block text-sm font-medium">Description</label>
              <textarea className="min-h-[60px] w-full rounded-md border bg-background px-3 py-2 text-sm" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} /></div>
            <div><label className="mb-1 block text-sm font-medium">Instructions</label>
              <textarea className="min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm" value={editForm.instructions} onChange={(e) => setEditForm({ ...editForm, instructions: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="mb-1 block text-sm font-medium">Duration (min)</label>
                <input type="number" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={editForm.durationMinutes} onChange={(e) => setEditForm({ ...editForm, durationMinutes: e.target.value })} /></div>
              <div><label className="mb-1 block text-sm font-medium">Total marks</label>
                <input type="number" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={editForm.totalMarks} onChange={(e) => setEditForm({ ...editForm, totalMarks: e.target.value })} /></div>
              <div><label className="mb-1 block text-sm font-medium">Passing marks</label>
                <input type="number" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={editForm.passingMarks} onChange={(e) => setEditForm({ ...editForm, passingMarks: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="mb-1 block text-sm font-medium">Attempts allowed</label>
                <input type="number" min={1} className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={editForm.attemptsAllowed} onChange={(e) => setEditForm({ ...editForm, attemptsAllowed: e.target.value })} /></div>
              <div><label className="mb-1 block text-sm font-medium">Negative marking rate</label>
                <input type="number" min={0} step={0.25} className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={editForm.negativeMarkingRate} onChange={(e) => setEditForm({ ...editForm, negativeMarkingRate: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="mb-1 block text-sm font-medium">Starts at</label>
                <input type="datetime-local" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={editForm.startsAt} onChange={(e) => setEditForm({ ...editForm, startsAt: e.target.value })} /></div>
              <div><label className="mb-1 block text-sm font-medium">Ends at</label>
                <input type="datetime-local" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={editForm.endsAt} onChange={(e) => setEditForm({ ...editForm, endsAt: e.target.value })} /></div>
            </div>
            <div className="space-y-3">
              <p className="text-sm font-medium">Settings</p>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={editForm.randomizeQuestions} onChange={(e) => setEditForm({ ...editForm, randomizeQuestions: e.target.checked })} /> Randomize questions</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={editForm.randomizeOptions} onChange={(e) => setEditForm({ ...editForm, randomizeOptions: e.target.checked })} /> Randomize options</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={editForm.fullscreenRequired} onChange={(e) => setEditForm({ ...editForm, fullscreenRequired: e.target.checked })} /> Fullscreen required</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={editForm.showResultImmediately} onChange={(e) => setEditForm({ ...editForm, showResultImmediately: e.target.checked })} /> Show result immediately</label>
            </div>
            <div className="flex gap-3 pt-4">
              <Button onClick={handleSaveEdit} disabled={updateMutation.isPending} className="flex-1">
                {updateMutation.isPending ? 'Saving...' : 'Save changes'}
              </Button>
              <Button variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={!!assigningId} onOpenChange={(o) => { if (!o) { setAssigningId(null); setSelectedStudents([]); } }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>Assign Students</SheetTitle><SheetDescription>Select students to assign to this exam.</SheetDescription></SheetHeader>
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
                    <input type="checkbox" className="h-4 w-4" checked={selectedStudents.includes(s.id)} onChange={() => toggleStudent(s.id)} />
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

      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDeletingId(null)}>
          <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">Close Exam</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Are you sure you want to close this exam? It will be marked as CLOSED and no further submissions will be accepted.
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeletingId(null)} disabled={deleteMutation.isPending}>Cancel</Button>
              <Button variant="destructive" onClick={() => deleteMutation.mutate(deletingId)} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? 'Closing...' : 'Close exam'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Sheet open={!!sharingId} onOpenChange={(o) => { if (!o) { setSharingId(null); setSelectedSharing([]); } }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Share monitor access</SheetTitle>
            <SheetDescription>
              Grant other instructors permission to monitor this exam. Permission levels control what they can do.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            {sharingAccess && sharingAccess.shares.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Instructors with access ({sharingAccess.shares.length})</p>
                <div className="space-y-1">
                  {sharingAccess.shares.map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate">{s.firstName} {s.lastName}</p>
                        <p className="truncate text-xs text-muted-foreground">{s.email}{s.grantedBy ? ` · shared by ${s.grantedBy}` : ''}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <select
                          className="h-8 rounded-md border bg-background px-2 text-xs"
                          value={s.permissionLevel}
                          disabled={levelMutation.isPending}
                          onChange={(e) => levelMutation.mutate({ id: sharingId!, instructorId: s.id, permissionLevel: e.target.value as ExamPermissionLevel })}
                        >
                          {EXAM_PERMISSION_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                        </select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive"
                          disabled={unshareMutation.isPending}
                          onClick={() => unshareMutation.mutate({ id: sharingId!, instructorId: s.id })}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-sm font-medium mb-2">Permission level for new grants</p>
              <div className="flex flex-wrap gap-1">
                {EXAM_PERMISSION_LEVELS.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setShareLevel(l)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium border ${shareLevel === l ? 'border-primary bg-primary/10 text-primary' : 'bg-background text-muted-foreground'}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                VIEWER: view only · MONITOR: + monitor students/events · PROCTOR: + warnings, pause, resume · CO_OWNER: + extend, force submit
              </p>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Grant access to</p>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {availableInstructors.map((s) => (
                  <label key={s.id} className={`flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer text-sm ${selectedSharing.includes(s.id) ? 'border-primary bg-primary/5' : ''}`}>
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={selectedSharing.includes(s.id)}
                      onChange={() => setSelectedSharing((prev) => prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id])}
                    />
                    <span>{s.firstName} {s.lastName} <span className="text-muted-foreground">({s.email})</span></span>
                  </label>
                ))}
                {availableInstructors.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">No other instructors available</p>
                )}
              </div>
            </div>

            <Button
              className="w-full"
              disabled={selectedSharing.length === 0 || shareMutation.isPending}
              onClick={() => shareMutation.mutate({ id: sharingId!, instructorIds: selectedSharing, permissionLevel: shareLevel })}
            >
              {shareMutation.isPending ? 'Granting...' : `Grant ${shareLevel} access to ${selectedSharing.length} instructor${selectedSharing.length !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={!!transferringId} onOpenChange={(o) => { if (!o) { setTransferringId(null); setTransferTarget(''); } }}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Transfer ownership</SheetTitle>
            <SheetDescription>
              The new instructor becomes the owner. You will keep access as Co-Owner, and all current permissions are preserved.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {sharingAccess?.owner && (
              <p className="text-sm text-muted-foreground">
                Current owner: <span className="font-medium text-foreground">{sharingAccess.owner.firstName} {sharingAccess.owner.lastName}</span>
              </p>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium">Transfer to</label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={transferTarget}
                onChange={(e) => setTransferTarget(e.target.value)}
              >
                <option value="">Select an instructor...</option>
                {transferCandidates.map((i) => (
                  <option key={i.id} value={i.id}>{i.firstName} {i.lastName} ({i.email})</option>
                ))}
              </select>
            </div>
            <Button
              className="w-full"
              disabled={!transferTarget || transferMutation.isPending}
              onClick={() => {
                if (window.confirm('Transfer exam ownership to this instructor? You will become a Co-Owner.')) {
                  transferMutation.mutate({ id: transferringId!, toInstructorId: transferTarget });
                }
              }}
            >
              {transferMutation.isPending ? 'Transferring...' : 'Transfer ownership'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
