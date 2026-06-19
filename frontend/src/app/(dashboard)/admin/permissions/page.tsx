'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Plus, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { permissionsService } from '@/services/permissions.service';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

export default function AdminPermissionsPage() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ key: '', label: '', module: '' });

  const { data: permissions, isLoading, error } = useQuery({
    queryKey: ['admin', 'permissions'],
    queryFn: () => permissionsService.list(),
  });

  const createMutation = useMutation({
    mutationFn: () => permissionsService.create(form),
    onSuccess: () => {
      toast.success('Permission created');
      setShowAdd(false);
      setForm({ key: '', label: '', module: '' });
      queryClient.invalidateQueries({ queryKey: ['admin', 'permissions'] });
    },
    onError: () => toast.error('Failed to create permission'),
  });

  const grouped = permissions?.reduce<Record<string, typeof permissions>>((acc, p) => {
    const mod = p.module || 'Other';
    if (!acc[mod]) acc[mod] = [];
    acc[mod].push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <Badge variant="outline">Admin</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal">Permissions</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Control granular access to modules, reports, monitoring, and configuration.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Shield className="h-4 w-4" />
          {permissions && <span>{permissions.length} total</span>}
        </div>
        <Button onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? <X className="mr-1 h-4 w-4" /> : <Plus className="mr-1 h-4 w-4" />}
          {showAdd ? 'Cancel' : 'Add permission'}
        </Button>
      </div>

      {showAdd && (
        <Card>
          <CardHeader>
            <CardTitle>New permission</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="key">Key</Label>
                <Input id="key" placeholder="exam.create" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="label">Label</Label>
                <Input id="label" placeholder="Create exams" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="module">Module</Label>
                <Input id="module" placeholder="exams" value={form.module} onChange={(e) => setForm({ ...form, module: e.target.value })} />
              </div>
            </div>
            <div className="mt-4">
              <Button disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
                {createMutation.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                Create
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Card>
          <CardContent className="p-0">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-b p-4 last:border-0">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Failed to load permissions</CardTitle>
            <CardDescription>{(error as Error).message}</CardDescription>
          </CardHeader>
        </Card>
      ) : !permissions || permissions.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No permissions found</CardTitle>
            <CardDescription>Add the first permission to get started.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped && Object.entries(grouped).map(([module, perms]) => (
            <Card key={module}>
              <CardHeader>
                <CardTitle className="capitalize">{module}</CardTitle>
                <CardDescription>{perms.length} permission{perms.length !== 1 ? 's' : ''}</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left font-medium">Key</th>
                      <th className="p-3 text-left font-medium">Label</th>
                      <th className="p-3 text-left font-medium">Module</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perms.map((perm) => (
                      <tr key={perm.id} className="border-b transition-colors hover:bg-muted/50 last:border-0">
                        <td className="p-3 font-mono text-xs">{perm.key}</td>
                        <td className="p-3">{perm.label}</td>
                        <td className="p-3 capitalize text-muted-foreground">{perm.module}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
