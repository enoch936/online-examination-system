'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Book, Plus, Loader2, Hash } from 'lucide-react';
import { toast } from 'sonner';
import { subjectsService } from '@/services/subjects.service';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminSubjectsPage() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', description: '' });

  const { data: subjects, isLoading, error } = useQuery({
    queryKey: ['admin', 'subjects'],
    queryFn: () => subjectsService.list(),
  });

  const createMutation = useMutation({
    mutationFn: () => subjectsService.create(form),
    onSuccess: () => {
      toast.success('Subject created');
      setShowAdd(false);
      setForm({ code: '', name: '', description: '' });
      queryClient.invalidateQueries({ queryKey: ['admin', 'subjects'] });
    },
    onError: () => toast.error('Failed to create subject'),
  });

  return (
    <div className="space-y-6">
      <div>
        <Badge variant="outline">Admin</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal">Subjects</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Maintain academic subjects and ownership.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Book className="h-4 w-4" />
          {subjects && <span>{subjects.length} total</span>}
        </div>
        <Button onClick={() => setShowAdd(!showAdd)}>
          <Plus className="mr-1 h-4 w-4" /> Add subject
        </Button>
      </div>

      {showAdd && (
        <Card>
          <CardHeader>
            <CardTitle>New subject</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="code">Code</Label>
                <Input id="code" placeholder="MATH101" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" placeholder="Mathematics" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <Label htmlFor="desc">Description</Label>
              <Textarea id="desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="mt-4 flex gap-2">
              <Button disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
                {createMutation.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                Create
              </Button>
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Card>
          <CardContent className="p-0">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-b p-4 last:border-0">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-32 flex-1" />
                <Skeleton className="h-4 w-48" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Failed to load subjects</CardTitle>
            <CardDescription>{(error as Error).message}</CardDescription>
          </CardHeader>
        </Card>
      ) : !subjects || subjects.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No subjects found</CardTitle>
            <CardDescription>Add the first subject to get started.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left font-medium"><Hash className="mr-1 inline h-3 w-3" />Code</th>
                  <th className="p-3 text-left font-medium">Name</th>
                  <th className="p-3 text-left font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((subject) => (
                  <tr key={subject.id} className="border-b transition-colors hover:bg-muted/50 last:border-0">
                    <td className="p-3 font-mono text-xs font-medium">{subject.code}</td>
                    <td className="p-3 font-medium">{subject.name}</td>
                    <td className="p-3 text-muted-foreground">{subject.description || '—'}</td>
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
