'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Loader2, Mail, Shield, Clock, Calendar, X, KeyRound, Pencil, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { usersService } from '@/services/users.service';
import { api } from '@/services/api';
import { apiErrorMessage } from '@/lib/api-error';
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
  DEACTIVATED: 'default',
  PENDING_VERIFICATION: 'outline',
};

const ALL_STATUSES = ['ACTIVE', 'PENDING_VERIFICATION', 'SUSPENDED', 'DEACTIVATED'] as const;

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  PENDING_VERIFICATION: 'Pending verification',
  SUSPENDED: 'Suspended',
  DEACTIVATED: 'Deactivated',
};

const ALL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR', 'STUDENT'] as const;

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  INSTRUCTOR: 'Instructor',
  STUDENT: 'Student',
};

type Panel = 'edit' | 'reset' | 'delete' | null;

function UserRow({ user, onRoleChange, onRoleRemove, onResetPassword, onUpdate, onDelete }: { user: User; onRoleChange: (userId: string, role: string) => void; onRoleRemove: (userId: string, roleName: string) => void; onResetPassword: (userId: string, newPassword: string) => void; onUpdate: (userId: string, data: { firstName: string; lastName: string; phone: string; status: string }) => void; onDelete: (userId: string) => void }) {
const [assigning, setAssigning] = useState(false);
    const canWrite = useHasPermission()('users.write');
    // Role changes are gated by `roles.manage`, NOT `users.write`. An ADMIN
    // holds users.write but not roles.manage, so keying this off canWrite made
    // the UI offer a control that could only ever be refused — the exact
    // "no authority, yet it acts like it has it" behaviour.
    const canManageRoles = useHasPermission()('roles.manage');
    const roleDeniedReason = canManageRoles
      ? undefined
      : 'Your role does not have the roles.manage permission, so it cannot assign or remove roles.';
  const assignedRoles = user.roles.map((r) => r.role.name);
  const [panel, setPanel] = useState<Panel>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [edit, setEdit] = useState({
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone ?? '',
    status: user.status,
  });

  const openPanel = (next: Exclude<Panel, null>) => setPanel((cur) => (cur === next ? null : next));

  const handleReset = async () => {
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    await onResetPassword(user.id, newPassword);
    setPanel(null);
    setNewPassword('');
    setConfirmPassword('');
  };

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
    <>
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
                  title={
                    canManageRoles
                      ? `Remove ${ROLE_LABELS[roleName] ?? roleName} role`
                      : roleDeniedReason
                  }
                  disabled={!canManageRoles}
                  aria-disabled={!canManageRoles}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
          {availableRoles.length > 0 && canWrite && (
            <select
              className="h-7 rounded-lg border bg-background px-2 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
              disabled={assigning || !canManageRoles}
              onChange={(e) => { if (e.target.value) handleAssign(e.target.value); e.target.value = ''; }}
              // When the actor lacks the permission the control stays visible
              // but disabled and explains itself, instead of silently doing
              // nothing when used.
              title={roleDeniedReason}
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
        {canWrite && (
          <td className="p-3">
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openPanel('edit')}
                title={`Edit ${user.email}`}
              >
                <Pencil className="h-4 w-4" />
                <span className="sr-only">Edit user</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openPanel('reset')}
                title={`Reset password for ${user.email}`}
              >
                <KeyRound className="h-4 w-4" />
                <span className="sr-only">Reset password</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => openPanel('delete')}
                title={`Delete ${user.email}`}
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Delete user</span>
              </Button>
            </div>
          </td>
        )}
      </tr>
      {panel === 'edit' && canWrite && (
        <tr className="border-b bg-muted/30">
          <td colSpan={7} className="p-4">
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Edit <span className="font-medium text-foreground">{user.email}</span>. Email is the login identity and cannot be changed here.
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`fn-${user.id}`}>First name</Label>
                  <Input id={`fn-${user.id}`} value={edit.firstName} onChange={(e) => setEdit({ ...edit, firstName: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`ln-${user.id}`}>Last name</Label>
                  <Input id={`ln-${user.id}`} value={edit.lastName} onChange={(e) => setEdit({ ...edit, lastName: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`ph-${user.id}`}>Phone</Label>
                  <Input id={`ph-${user.id}`} value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`st-${user.id}`}>Status</Label>
                  <select
                    id={`st-${user.id}`}
                    className="h-9 rounded-lg border bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={edit.status}
                    onChange={(e) => setEdit({ ...edit, status: e.target.value })}
                  >
                    {ALL_STATUSES.map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => { onUpdate(user.id, edit); setPanel(null); }}>Save changes</Button>
                <Button size="sm" variant="outline" onClick={() => setPanel(null)}>Cancel</Button>
              </div>
            </div>
          </td>
        </tr>
      )}
      {panel === 'reset' && canWrite && (
        <tr className="border-b bg-muted/30">
          <td colSpan={7} className="p-4">
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Set a new password for <span className="font-medium text-foreground">{user.email}</span>.
                Share it with them securely — the user is signed out of all sessions.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`np-${user.id}`}>New password</Label>
                  <Input
                    id={`np-${user.id}`}
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`cp-${user.id}`}>Confirm password</Label>
                  <Input
                    id={`cp-${user.id}`}
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleReset}>Reset password</Button>
                <Button size="sm" variant="outline" onClick={() => setPanel(null)}>Cancel</Button>
              </div>
            </div>
          </td>
        </tr>
      )}
      {panel === 'delete' && canWrite && (
        <tr className="border-b bg-destructive/10">
          <td colSpan={7} className="p-4">
            <div className="flex flex-col gap-3">
              <p className="text-sm">
                Permanently delete <span className="font-medium">{user.email}</span>? This cannot be undone.
                Accounts with exam, class or audit records cannot be deleted — set the status to Deactivated instead.
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" onClick={() => { onDelete(user.id); setPanel(null); }}>
                  Delete user
                </Button>
                <Button size="sm" variant="outline" onClick={() => setPanel(null)}>Cancel</Button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const canWrite = useHasPermission()('users.write');
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '', password: '' });

  const { data: users, isLoading, error } = useQuery({
    queryKey: ['admin', 'users', search, statusFilter],
    queryFn: () => usersService.list({ q: search || undefined, status: statusFilter || undefined }),
  });

  const assignRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      api.patch(`/users/${userId}/roles`, { role }),
    // Without this the guard's 403 was swallowed and the row simply kept its
    // old role, so an unauthorised attempt looked like it had half-worked.
    // Surface the server's own wording so the actor learns their role cannot
    // do this rather than guessing.
    onError: (err: unknown) => toast.error(apiErrorMessage(err, 'Could not assign that role')),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  const removeRoleMutation = useMutation({
    mutationFn: ({ userId, roleName }: { userId: string; roleName: string }) =>
      usersService.removeRole(userId, roleName),
    onError: (err: unknown) => toast.error(apiErrorMessage(err, 'Could not remove role')),
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
    onError: (err: unknown) => toast.error(apiErrorMessage(err, 'Failed to create user')),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ userId, newPassword }: { userId: string; newPassword: string }) =>
      usersService.resetPassword(userId, newPassword),
    onSuccess: (_data, { userId }) => {
      const target = users?.find((u) => u.id === userId);
      toast.success(`Password reset for ${target?.email ?? 'user'}`);
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, 'Failed to reset password')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: { firstName: string; lastName: string; phone: string; status: string } }) =>
      usersService.update(userId, data),
    onSuccess: () => {
      toast.success('User updated');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, 'Failed to update user')),
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => usersService.remove(userId),
    onSuccess: (_data, userId) => {
      const target = users?.find((u) => u.id === userId);
      toast.success(`${target?.email ?? 'User'} deleted`);
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, 'Failed to delete user')),
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="h-9 rounded-lg border bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
          ))}
        </select>
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
                  {canWrite && <th className="p-3 text-left font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    onRoleChange={(userId, role) => assignRoleMutation.mutate({ userId, role })}
                    onRoleRemove={(userId, roleName) => removeRoleMutation.mutate({ userId, roleName })}
                    onResetPassword={(userId, newPassword) => resetPasswordMutation.mutate({ userId, newPassword })}
                    onUpdate={(userId, data) => updateMutation.mutate({ userId, data })}
                    onDelete={(userId) => deleteMutation.mutate(userId)}
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
