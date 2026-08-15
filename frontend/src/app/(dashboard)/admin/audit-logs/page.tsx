'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Clock, User, Activity, Globe, Filter } from 'lucide-react';
import { auditLogsService } from '@/services/audit-logs.service';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminAuditLogsPage() {
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('');

  const { data: logs, isLoading, error } = useQuery({
    queryKey: ['admin', 'audit-logs'],
    queryFn: () => auditLogsService.list(),
  });

  const filtered = useMemo(() => {
    if (!logs) return [];
    return logs.filter((log) => {
      const matchesSearch =
        !search ||
        log.action.toLowerCase().includes(search.toLowerCase()) ||
        log.entity.toLowerCase().includes(search.toLowerCase()) ||
        log.actor?.email?.toLowerCase().includes(search.toLowerCase());
      const matchesAction = !filterAction || log.action === filterAction;
      return matchesSearch && matchesAction;
    });
  }, [logs, search, filterAction]);

  const actions = useMemo(() => {
    if (!logs) return [];
    return [...new Set(logs.map((l) => l.action))].sort();
  }, [logs]);

  return (
    <div className="space-y-6">
      <div>
        <Badge variant="outline" className="border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">Admin</Badge>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Audit logs</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Review immutable administrative, security, and exam integrity events.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by action, entity, or email…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
        >
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-0">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-b p-4 last:border-0">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-28 flex-1" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Failed to load audit logs</CardTitle>
            <CardDescription>{(error as Error).message}</CardDescription>
          </CardHeader>
        </Card>
      ) : !logs || logs.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No audit logs</CardTitle>
            <CardDescription>No events have been recorded yet.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left font-medium"><Clock className="mr-1 inline h-3 w-3" />Timestamp</th>
                  <th className="p-3 text-left font-medium"><User className="mr-1 inline h-3 w-3" />Actor</th>
                  <th className="p-3 text-left font-medium"><Activity className="mr-1 inline h-3 w-3" />Action</th>
                  <th className="p-3 text-left font-medium">Entity</th>
                  <th className="p-3 text-left font-medium"><Globe className="mr-1 inline h-3 w-3" />IP</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => (
                  <tr key={log.id} className="border-b transition-colors hover:bg-muted/50 last:border-0">
                    <td className="whitespace-nowrap p-3 text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="p-3">
                      {log.actor ? `${log.actor.firstName} ${log.actor.lastName}` : '—'}
                      <span className="ml-1 text-xs text-muted-foreground">
                        {log.actor?.email && `(${log.actor.email})`}
                      </span>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className="font-mono text-xs">{log.action}</Badge>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {log.entity}
                      {log.entityId && <span className="ml-1 font-mono text-xs">#{log.entityId.slice(0, 8)}</span>}
                    </td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{log.ipAddress || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No logs match your search.
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
