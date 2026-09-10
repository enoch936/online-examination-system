'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Hash, Users, Plus, Pencil, Trash2, Loader2, X, Search, UserPlus, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';
import { classesService } from '@/services/classes.service';
import { usersService } from '@/services/users.service';
import { apiErrorMessage } from '@/lib/api-error';
import type { Class } from '@/types/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';

type ClassForm = { instructorId: string; name: string; code: string; description: string };

const emptyForm: ClassForm = { instructorId: '', name: '', code: '', description: '' };

export function ClassesManager({
  badge,
  lockedInstructor,
}: {
  badge: string;
  lockedInstructor?: { id: string; firstName: string; lastName: string } | null;
}) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Class | null>(null);
  const [form, setForm] = useState<ClassForm>(emptyForm);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState('');

  const { data: classes, isLoading, error } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classesService.list(),
  });

  const { data: instructors } = useQuery({
    queryKey: ['classes-instructors'],
    queryFn: () => usersService.list('INSTRUCTOR'),
    enabled: !lockedInstructor,
  });

  const { data: classDetail, refetch: refetchDetail } = useQuery({
    queryKey: ['class-detail', enrollingId],
    queryFn: () => classesService.get(enrollingId!),
    enabled: !!enrollingId,
  });

  const { data: allStudents } = useQuery({
    queryKey: ['users', 'STUDENT'],
    queryFn: () => usersService.list('STUDENT'),
    enabled: !!enrollingId,
  });

  const openCreate = () => {
    setEditing(null);
    setForm(lockedInstructor ? { ...emptyForm, instructorId: lockedInstructor.id } : emptyForm);
    setShowForm(true);
  };

  const openEdit = (cls: Class) => {
    setEditing(cls);
    setForm({
      instructorId: cls.instructorId,
      name: cls.name,
      code: cls.code,
      description: cls.description ?? '',
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const saveMutation = useMutation({
    mutationFn: () => (editing ? classesService.update(editing.id, form) : classesService.create(form)),
    onSuccess: () => {
      toast.success(editing ? 'Class updated' : 'Class created');
      closeForm();
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, editing ? 'Failed to update class' : 'Failed to create class')),
  });

  const deleteMutation = useMutation({
    mutationFn: (classId: string) => classesService.remove(classId),
    onSuccess: () => {
      toast.success('Class deleted');
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Failed to delete class')),
  });

  const enrollMutation = useMutation({
    mutationFn: () => classesService.enrollStudents(enrollingId!, selectedStudents),
    onSuccess: (res) => {
      refetchDetail();
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast.success(`${res.enrolled} student${res.enrolled !== 1 ? 's' : ''} enrolled`);
      setSelectedStudents([]);
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Failed to enroll students')),
  });

  const unenrollMutation = useMutation({
    mutationFn: ({ classId, studentId }: { classId: string; studentId: string }) =>
      classesService.unenrollStudent(classId, studentId),
    onSuccess: () => {
      refetchDetail();
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast.success('Student removed from class');
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Failed to remove student')),
  });

  const instructorOptions = instructors ?? [];
  const instructorName = (id: string) => {
    const i = instructorOptions.find((x) => x.id === id);
    return i ? `${i.firstName} ${i.lastName}` : '—';
  };

  const enrolledIds = new Set((classDetail?.students ?? []).map((s) => s.id));
  const filteredStudents = (allStudents ?? [])
    .filter((s) => !enrolledIds.has(s.id))
    .filter((s) => {
      const q = studentSearch.toLowerCase();
      return !q || s.firstName.toLowerCase().includes(q) || s.lastName.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
    });

  return (
    <div className="space-y-6">
      <div>
        <Badge variant="outline" className="border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">{badge}</Badge>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Classes</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Group students into classes, then push exams to whole classes at once.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <GraduationCap className="h-4 w-4" />
          {classes && <span>{classes.length} total</span>}
        </div>
        <Button onClick={() => (showForm ? closeForm() : openCreate())}>
          {showForm ? <X className="mr-1 h-4 w-4" /> : <Plus className="mr-1 h-4 w-4" />}
          {showForm ? 'Cancel' : 'Add class'}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editing ? 'Edit class' : 'New class'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="code">Code</Label>
                <Input id="code" placeholder="CS101-A" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" placeholder="CS101 - Section A" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <Label htmlFor="instructor">Class instructor</Label>
              {lockedInstructor ? (
                <Input id="instructor" value={`${lockedInstructor.firstName} ${lockedInstructor.lastName}`} disabled />
              ) : (
                <select
                  id="instructor"
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  value={form.instructorId}
                  onChange={(e) => setForm({ ...form, instructorId: e.target.value })}
                >
                  <option value="" disabled>Select an instructor</option>
                  {instructorOptions.map((i) => (
                    <option key={i.id} value={i.id}>{i.firstName} {i.lastName}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <Label htmlFor="desc">Description</Label>
              <textarea
                id="desc"
                className="min-h-[60px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                disabled={saveMutation.isPending || !form.instructorId || !form.code.trim() || !form.name.trim()}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                {editing ? 'Save changes' : 'Create'}
              </Button>
              <Button variant="outline" onClick={closeForm}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Card>
          <CardContent className="p-0">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-b p-4 last:border-0">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-44 flex-1" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Failed to load classes</CardTitle>
            <CardDescription>{(error as Error).message}</CardDescription>
          </CardHeader>
        </Card>
      ) : !classes || classes.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No classes found</CardTitle>
            <CardDescription>Create a class to start grouping students.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left font-medium"><Hash className="mr-1 inline h-3 w-3" />Code</th>
                  <th className="p-3 text-left font-medium"><BookOpen className="mr-1 inline h-3 w-3" />Name</th>
                  <th className="p-3 text-left font-medium"><GraduationCap className="mr-1 inline h-3 w-3" />Instructor</th>
                  <th className="p-3 text-center font-medium"><Users className="mr-1 inline h-3 w-3" />Students</th>
                  <th className="p-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((cls) => (
                  <tr key={cls.id} className="border-b transition-colors hover:bg-muted/50 last:border-0">
                    <td className="p-3 font-mono text-xs font-medium">{cls.code}</td>
                    <td className="p-3">{cls.name}</td>
                    <td className="p-3 text-muted-foreground">
                      {cls.instructor ? `${cls.instructor.firstName} ${cls.instructor.lastName}` : instructorName(cls.instructorId)}
                    </td>
                    <td className="p-3 text-center font-medium">{cls.studentCount ?? 0}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Enroll students" onClick={() => { setEnrollingId(cls.id); setSelectedStudents([]); setStudentSearch(''); }}>
                          <UserPlus className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Edit" onClick={() => openEdit(cls)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Delete"
                          className="text-destructive hover:text-destructive"
                          disabled={deleteMutation.isPending}
                          onClick={() => {
                            if (window.confirm(`Delete class "${cls.name}"? This cannot be undone.`)) {
                              deleteMutation.mutate(cls.id);
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

      <Sheet open={!!enrollingId} onOpenChange={(o) => { if (!o) setEnrollingId(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Enroll students</SheetTitle>
            <SheetDescription>Add or remove students from this class.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {classDetail && (
              <div className="rounded-md border p-3 text-sm">
                <p className="font-medium">{classDetail.name}</p>
                <p className="text-xs text-muted-foreground">{classDetail.code}</p>
              </div>
            )}

            {classDetail?.students && classDetail.students.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium">Enrolled ({classDetail.students.length})</p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {classDetail.students.map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
                      <span>{s.firstName} {s.lastName} <span className="text-muted-foreground">({s.email})</span></span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        disabled={unenrollMutation.isPending}
                        onClick={() => unenrollMutation.mutate({ classId: enrollingId!, studentId: s.id })}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-1.5">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input className="flex-1 bg-transparent text-sm outline-none" placeholder="Search students..." value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} />
              </div>
              <div className="mt-2 max-h-64 overflow-y-auto space-y-1">
                {filteredStudents.map((s) => (
                  <label key={s.id} className={`flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer text-sm ${selectedStudents.includes(s.id) ? 'border-primary bg-primary/5' : ''}`}>
                    <input type="checkbox" className="h-4 w-4" checked={selectedStudents.includes(s.id)} onChange={() => setSelectedStudents((prev) => prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id])} />
                    <span>{s.firstName} {s.lastName} <span className="text-muted-foreground">({s.email})</span></span>
                  </label>
                ))}
                {filteredStudents.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No available students</p>}
              </div>
            </div>

            <Button
              className="w-full"
              disabled={selectedStudents.length === 0 || enrollMutation.isPending}
              onClick={() => enrollMutation.mutate()}
            >
              {enrollMutation.isPending ? 'Enrolling...' : `Enroll ${selectedStudents.length} student${selectedStudents.length !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}