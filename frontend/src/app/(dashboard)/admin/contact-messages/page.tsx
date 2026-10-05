'use client';

import { Fragment, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Inbox, Loader2, Mail, RefreshCw, RotateCcw, Search, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useHasPermission } from '@/hooks/use-permissions';
import { CONTACT_MESSAGES_QUERY_KEY, useInboxLive } from '@/hooks/use-inbox';
import { apiErrorMessage } from '@/lib/api-error';
import { contactService, type ContactMessageStatus } from '@/services/contact.service';
import type { ContactMessage } from '@/types/api';

const LIMIT = 20;

const STATUSES: ContactMessageStatus[] = ['NEW', 'READ', 'RESOLVED'];

type BadgeVariant = 'default' | 'warning' | 'success' | 'outline';

const STATUS_META: Record<ContactMessageStatus, { label: string; variant: BadgeVariant }> = {
  NEW: { label: 'New', variant: 'default' },
  READ: { label: 'Read', variant: 'warning' },
  RESOLVED: { label: 'Resolved', variant: 'success' },
};

function statusOf(message: ContactMessage): ContactMessageStatus {
  return STATUSES.includes(message.status as ContactMessageStatus)
    ? (message.status as ContactMessageStatus)
    : 'NEW';
}

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function ContactMessagesPage() {
  const hasPermission = useHasPermission();
  const canRead = hasPermission('contact.read');
  const canManage = hasPermission('contact.manage');
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | ContactMessageStatus>('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  // Staff room subscription: a message submitted on /contact lands here live.
  useInboxLive();

  const { data, isLoading, error, isFetching, refetch } = useQuery({
    queryKey: [...CONTACT_MESSAGES_QUERY_KEY, search, status, page],
    queryFn: () =>
      contactService.list({
        q: search.trim() || undefined,
        status: status || undefined,
        page,
        limit: LIMIT,
      }),
    enabled: canRead,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, next }: { id: string; next: ContactMessageStatus }) =>
      contactService.updateStatus(id, next),
    onSuccess: (updated) => {
      const meta = STATUS_META[statusOf(updated)];
      toast.success(`Message marked ${meta.label.toLowerCase()}`);
      queryClient.invalidateQueries({ queryKey: CONTACT_MESSAGES_QUERY_KEY });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Failed to update message')),
  });

  const messages = data?.data ?? [];
  const { total = 0, totalPages = 0, counts } = data?.pagination ?? { total: 0, totalPages: 0, counts: undefined };
  const waiting = counts?.NEW ?? 0;

  function applyFilter(fn: () => void) {
    fn();
    setPage(1);
  }

  function toggleOpen(message: ContactMessage) {
    if (openId === message.id) {
      setOpenId(null);
      return;
    }
    setOpenId(message.id);
    // Opening a message is the acknowledgement — retire it from the New queue.
    if (statusOf(message) === 'NEW' && canManage) {
      statusMutation.mutate({ id: message.id, next: 'READ' });
    }
  }

  if (!canRead) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              No access to contact messages
            </CardTitle>
            <CardDescription>
              This inbox needs the <code className="font-mono">contact.read</code> permission. Ask a super
              admin to grant it under Permissions.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const statCards: Array<{ key: '' | ContactMessageStatus; label: string; value: number }> = [
    { key: '', label: 'All messages', value: total },
    { key: 'NEW', label: 'Awaiting reply', value: counts?.NEW ?? 0 },
    { key: 'READ', label: 'Read', value: counts?.READ ?? 0 },
    { key: 'RESOLVED', label: 'Resolved', value: counts?.RESOLVED ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Badge
          variant="outline"
          className="border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
        >
          Admin
        </Badge>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Contact Messages</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Every message sent from the public contact page lands here. Open a message to mark it read,
          then resolve it once the enquiry has been answered.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => {
          const active = status === card.key;
          return (
            <button
              key={card.label}
              type="button"
              onClick={() => applyFilter(() => setStatus(card.key))}
              className={`rounded-xl border bg-card p-4 text-left transition-colors hover:bg-accent/50 ${
                active ? 'border-primary ring-2 ring-primary/30' : ''
              }`}
            >
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{card.label}</p>
              <p className="mt-2 text-2xl font-bold tabular-nums">{card.value}</p>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search by name, email or message…"
            value={search}
            onChange={(e) => applyFilter(() => setSearch(e.target.value))}
          />
        </div>
        <select
          className="h-10 rounded-lg border bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          value={status}
          onChange={(e) => applyFilter(() => setStatus(e.target.value as '' | ContactMessageStatus))}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].label}
            </option>
          ))}
        </select>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="space-y-3 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Failed to load messages</CardTitle>
            <CardDescription>{apiErrorMessage(error, 'Please try again.')}</CardDescription>
          </CardHeader>
        </Card>
      ) : messages.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5" />
              No messages found
            </CardTitle>
            <CardDescription>
              {search || status
                ? 'No message matches the current search or filter.'
                : 'Messages sent from the contact page will appear here.'}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left font-medium">From</th>
                  <th className="p-3 text-left font-medium">Message</th>
                  <th className="p-3 text-left font-medium">Status</th>
                  <th className="p-3 text-left font-medium">Received</th>
                  <th className="p-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((message) => {
                  const current = statusOf(message);
                  const meta = STATUS_META[current];
                  const open = openId === message.id;
                  return (
                    <Fragment key={message.id}>
                      <tr className="border-b transition-colors last:border-0 hover:bg-muted/50">
                        <td className="p-3 align-top">
                          <p className="font-medium">{message.name}</p>
                          <a
                            href={`mailto:${message.email}`}
                            className="text-xs text-muted-foreground hover:text-primary hover:underline"
                          >
                            {message.email}
                          </a>
                        </td>
                        <td className="max-w-md p-3 align-top">
                          <p className={open ? 'whitespace-pre-wrap' : 'truncate'}>{message.message}</p>
                        </td>
                        <td className="p-3 align-top">
                          <Badge variant={meta.variant}>{meta.label}</Badge>
                        </td>
                        <td className="whitespace-nowrap p-3 align-top text-xs text-muted-foreground">
                          {formatWhen(message.createdAt)}
                        </td>
                        <td className="p-3 text-right align-top">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleOpen(message)}
                              aria-expanded={open}
                            >
                              {open ? 'Close' : 'Open'}
                            </Button>
                            {canManage && current !== 'RESOLVED' && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={statusMutation.isPending}
                                onClick={() => statusMutation.mutate({ id: message.id, next: 'RESOLVED' })}
                              >
                                <CheckCircle2 className="mr-1 h-4 w-4" />
                                Resolve
                              </Button>
                            )}
                            {canManage && current === 'RESOLVED' && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={statusMutation.isPending}
                                onClick={() => statusMutation.mutate({ id: message.id, next: 'NEW' })}
                              >
                                <RotateCcw className="mr-1 h-4 w-4" />
                                Reopen
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {open && (
                        <tr className="border-b bg-muted/30 last:border-0">
                          <td colSpan={5} className="p-4">
                            <p className="whitespace-pre-wrap text-sm leading-6">{message.message}</p>
                            <div className="mt-4 flex flex-wrap items-center gap-2">
                              <Button asChild size="sm">
                                <a
                                  href={`mailto:${message.email}?subject=${encodeURIComponent(
                                    `Re: your enquiry to OES`,
                                  )}`}
                                >
                                  <Mail className="mr-2 h-4 w-4" />
                                  Reply by email
                                </a>
                              </Button>
                              {canManage && current !== 'RESOLVED' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={statusMutation.isPending}
                                  onClick={() => statusMutation.mutate({ id: message.id, next: 'RESOLVED' })}
                                >
                                  <CheckCircle2 className="mr-1 h-4 w-4" />
                                  Mark resolved
                                </Button>
                              )}
                              {statusMutation.isPending && (
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!isLoading && !error && messages.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {data?.pagination.page ?? page} of {Math.max(totalPages, 1)} ({total} total
            {waiting > 0 ? `, ${waiting} awaiting reply` : ''})
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
