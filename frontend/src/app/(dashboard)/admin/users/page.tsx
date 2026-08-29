'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Loader2, Mail, Shield, Clock, Calendar, X } from 'lucide-react';
import { toast } from 'sonner';
import { usersService } from '@/services/users.service';
import { api } from '@/services/api';
import { useHasPermission } from '@/hooks/use-permissions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import type { User } from '@/types/api';

const statusVariant: Record<string, 'success' | 'warning' | 'default' | 'outline'> = {
  ACTIVE: 'success',
  SUSPENDED: 'warning',
  INACTIVE: 'default',
  PENDING_VERIFICATION: 'outline',
};

const ALL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR', 'STUDENT'] as const;

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  INSTRUCTOR: 'Instructor',
  STUDENT: 'Student',
};

function UserRow({ user, onRoleChange, onRoleRemove }: { user: User; onRoleChange: (userId: string, role: string) => void; onRoleRemove: (userId: string, roleName: string) => void }) {
  const [assigning, setAssigning] = useState(false);
  const canWrite = useHasPermission()('users.write');
  const assignedRoles = user.roles.map((r) => r.role.name);

  const handleAssign = async (role: string) => {
    setAssigning(true);
    try {
      await onRoleChange(user.id, role);
      toast.success(`Role assigned to ${user.email}`);
    } catch {
      toast.error('Failed to assign role');
    } finally {
      setAssigning(false);
    }
  };

  const handleRemove = async (roleName: string) => {
    try {
      await onRoleRemove(user.id, roleName);
      toast.success(`Role removed from ${user.email}`);
    } catch {
      toast.error('Failed to remove role');
    }
  };

  const availableRoles = ALL_ROLES.filter((r) => !assignedRoles.includes(r));

  return (
    <tr className="border-b transition-colors hover:bg-muted/50">
      <td className="p-3 font-medium">{user.firstName} {user.lastName}</td>
      <td className="p-3 text-muted-foreground">{user.email}</td>
      <td className="p-3">
        <Badge variant={statusVariant[user.status] ?? 'default'}>{user.status}</Badge>
      </td>
      <td className="p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {assignedRoles.map((roleName) => (
            <Badge key={roleName} variant="secondary" className="gap-1 pr-1">
              {ROLE_LABELS[roleName] ?? roleName}
              {canWrite && assignedRoles.length > 1 && (
                <button
                  type="button"
                  className="ml-0.5 rounded-full p-0.5 hover:bg-muted/80"
                  onClick={() => handleRemove(roleName)}
                  title={`Remove ${ROLE_LABELS[roleName] ?? roleName} role`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
          {availableRoles.length > 0 && canWrite && (
            <select
              className="h-7 rounded-lg border bg-background px-2 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={assigning}
              onChange={(e) => { if (e.target.value) handleAssign(e.target.value); e.target.value = ''; }}
              defaultValue=""
            >
              <option value="" disabled>+ Role</option>
              {availableRoles.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
              ))}
            </select>
          )}
        </div>
      </td>
      <td className="p-3 text-sm text-muted-foreground">
        {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : '—'}
      </td>
      <td className="p-3 text-sm text-muted-foreground">{new Date(user.createdAt).toLocaleDateString()}</td>
    </tr>
  );
}

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const canWrite = useHasPermission()('users.write');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '', password: '' });

  const { data: users, isLoading, error } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => usersService.list(),
  });

  const assignRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      api.patch(`/users/${userId}/roles`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  const removeRoleMutation = useMutation({
    mutationFn: ({ userId, roleName }: { userId: string; roleName: string }) =>
      usersService.removeRole(userId, roleName),
    onError: (err: Error) => toast.error(err.message || 'Failed to remove role'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  const createMutation = useMutation({
    mutationFn: () => usersService.create(form),
    onSuccess: () => {
      toast.success('User created');
      setShowAdd(false);
      setForm({ email: '', firstName: '', lastName: '', password: '' });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: () => toast.error('Failed to create user'),
  });

  return (
    <div className="space-y-6">
      <div>
        <Badge variant="outline" className="border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">Admin</Badge>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Users</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Create, activate, suspend, deactivate, and assign roles to platform users.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          {users && <span>{users.length} total</span>}
        </div>
        {canWrite && (
          <Button onClick={() => setShowAdd(!showAdd)}>
            <Plus className="mr-1 h-4 w-4" /> Add user
          </Button>
        )}
      </div>

      {showAdd && (
        <Card>
          <CardHeader>
            <CardTitle>New user</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="fn">First name</Label>
                <Input id="fn" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="ln">Last name</Label>
                <Input id="ln" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="em">Email</Label>
                <Input id="em" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="pw">Password</Label>
                <Input id="pw" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
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
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-b p-4 last:border-0">
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Failed to load users</CardTitle>
            <CardDescription>{(error as Error).message}</CardDescription>
          </CardHeader>
        </Card>
      ) : !users || users.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No users found</CardTitle>
            <CardDescription>Get started by creating the first user.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left font-medium">Name</th>
                  <th className="p-3 text-left font-medium">Email</th>
                  <th className="p-3 text-left font-medium">Status</th>
                  <th className="p-3 text-left font-medium">Roles</th>
                  <th className="p-3 text-left font-medium">Last login</th>
                  <th className="p-3 text-left font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    onRoleChange={(userId, role) => assignRoleMutation.mutate({ userId, role })}
                    onRoleRemove={(userId, roleName) => removeRoleMutation.mutate({ userId, roleName })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
