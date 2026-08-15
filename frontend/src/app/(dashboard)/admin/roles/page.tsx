'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { rolesService } from '@/services/roles.service';
import { permissionsService } from '@/services/permissions.service';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

export default function AdminRolesPage() {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<{ roleId: string; permissionId: string } | null>(null);

  const { data: roles, isLoading: rolesLoading, error: rolesError } = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: () => rolesService.list(),
  });

  const { data: permissions } = useQuery({
    queryKey: ['admin', 'permissions'],
    queryFn: () => permissionsService.list(),
  });

  const assignMutation = useMutation({
    mutationFn: (data: { roleId: string; permissionId: string }) => rolesService.assignPermission(data),
    onSuccess: () => {
      toast.success('Permission assigned');
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
      setAssigning(null);
    },
    onError: () => toast.error('Failed to assign permission'),
  });

  return (
    <div className="space-y-6">
      <div>
        <Badge variant="outline" className="border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">Admin</Badge>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Roles</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Manage institutional roles and role assignments.
        </p>
      </div>

      {rolesLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : rolesError ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Failed to load roles</CardTitle>
            <CardDescription>{(rolesError as Error).message}</CardDescription>
          </CardHeader>
        </Card>
      ) : !roles || roles.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No roles found</CardTitle>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {roles.map((role) => {
            const isOpen = expanded === role.id;
            const permCount = role.rolePermissions?.length ?? 0;
            return (
              <Card key={role.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    <CardTitle>{role.name}</CardTitle>
                  </div>
                  <CardDescription>{role.description || 'No description'}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <p className="mb-3 text-sm text-muted-foreground">
                    {permCount} permission{permCount !== 1 ? 's' : ''}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExpanded(isOpen ? null : role.id)}
                  >
                    {isOpen ? <ChevronDown className="mr-1 h-4 w-4" /> : <ChevronRight className="mr-1 h-4 w-4" />}
                    {isOpen ? 'Hide' : 'Show'} permissions
                  </Button>

                  {isOpen && (
                    <div className="mt-3 space-y-2">
                      <Separator />
                      <div className="max-h-40 space-y-1 overflow-y-auto">
                        {role.rolePermissions.map((rp) => (
                          <div key={rp.permission.id} className="flex items-center gap-2 rounded bg-muted px-2 py-1 text-xs">
                            <span className="font-medium">{rp.permission.key}</span>
                            <span className="text-muted-foreground">— {rp.permission.label}</span>
                          </div>
                        ))}
                        {permCount === 0 && (
                          <p className="text-xs text-muted-foreground">No permissions assigned</p>
                        )}
                      </div>
                      <Separator />
                      <div className="flex items-center gap-2 pt-1">
                        <select
                          className="flex-1 rounded border px-2 py-1 text-xs"
                          value=""
                          onChange={(e) => {
                            if (e.target.value) {
                              setAssigning({ roleId: role.id, permissionId: e.target.value });
                              assignMutation.mutate({ roleId: role.id, permissionId: e.target.value });
                            }
                          }}
                        >
                          <option value="" disabled>Assign permission…</option>
                          {permissions?.filter(
                            (p) => !role.rolePermissions.some((rp) => rp.permission.id === p.id),
                          ).map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.key}
                            </option>
                          ))}
                        </select>
                        {assigning?.roleId === role.id && (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
