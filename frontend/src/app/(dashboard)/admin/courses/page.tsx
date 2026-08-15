'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Hash, FolderOpen, Plus, Pencil, Trash2, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { coursesService } from '@/services/courses.service';
import { subjectsService } from '@/services/subjects.service';
import type { Course, Subject } from '@/types/api';
import { apiErrorMessage } from '@/lib/api-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';

type CourseForm = { subjectId: string; code: string; name: string; description: string };

const emptyForm: CourseForm = { subjectId: '', code: '', name: '', description: '' };

export default function AdminCoursesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [form, setForm] = useState<CourseForm>(emptyForm);

  const { data: courses, isLoading, error } = useQuery({
    queryKey: ['admin', 'courses'],
    queryFn: () => coursesService.list(),
  });

  const { data: subjects } = useQuery({
    queryKey: ['admin', 'subjects'],
    queryFn: () => subjectsService.list(),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (course: Course) => {
    setEditing(course);
    setForm({
      subjectId: course.subjectId,
      code: course.code,
      name: course.name,
      description: course.description ?? '',
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const saveMutation = useMutation({
    mutationFn: () => (editing ? coursesService.update(editing.id, form) : coursesService.create(form)),
    onSuccess: () => {
      toast.success(editing ? 'Course updated' : 'Course created');
      closeForm();
      queryClient.invalidateQueries({ queryKey: ['admin', 'courses'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, editing ? 'Failed to update course' : 'Failed to create course')),
  });

  const deleteMutation = useMutation({
    mutationFn: (courseId: string) => coursesService.remove(courseId),
    onSuccess: () => {
      toast.success('Course deleted');
      queryClient.invalidateQueries({ queryKey: ['admin', 'courses'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Failed to delete course')),
  });

  const subjectName = (subjectId: string) => subjects?.find((s) => s.id === subjectId)?.name;

  return (
    <div className="space-y-6">
      <div>
        <Badge variant="outline" className="border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">Admin</Badge>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Courses</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Manage courses linked to subjects and departments.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BookOpen className="h-4 w-4" />
          {courses && <span>{courses.length} total</span>}
        </div>
        <Button onClick={() => (showForm ? closeForm() : openCreate())}>
          {showForm ? <X className="mr-1 h-4 w-4" /> : <Plus className="mr-1 h-4 w-4" />}
          {showForm ? 'Cancel' : 'Add course'}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editing ? 'Edit course' : 'New course'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="subject">Subject</Label>
                <select
                  id="subject"
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  value={form.subjectId}
                  onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
                >
                  <option value="" disabled>Select a subject</option>
                  {(subjects ?? []).map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="code">Code</Label>
                <Input id="code" placeholder="MATH-101" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" placeholder="Calculus I" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <Label htmlFor="desc">Description</Label>
              <Textarea id="desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                disabled={saveMutation.isPending || !form.subjectId || !form.code.trim() || !form.name.trim()}
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
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-b p-4 last:border-0">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-40 flex-1" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Failed to load courses</CardTitle>
            <CardDescription>{(error as Error).message}</CardDescription>
          </CardHeader>
        </Card>
      ) : !courses || courses.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No courses found</CardTitle>
            <CardDescription>No courses have been created yet.</CardDescription>
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
                  <th className="p-3 text-left font-medium"><FolderOpen className="mr-1 inline h-3 w-3" />Subject</th>
                  <th className="p-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((course) => (
                  <tr key={course.id} className="border-b transition-colors hover:bg-muted/50 last:border-0">
                    <td className="p-3 font-mono text-xs font-medium">{course.code}</td>
                    <td className="p-3">{course.name}</td>
                    <td className="p-3 text-muted-foreground">
                      {course.subject?.name || subjectName(course.subjectId) || '—'}
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Edit" onClick={() => openEdit(course)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Delete"
                          className="text-destructive hover:text-destructive"
                          disabled={deleteMutation.isPending}
                          onClick={() => {
                            if (window.confirm(`Delete course "${course.name}"? This cannot be undone.`)) {
                              deleteMutation.mutate(course.id);
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
