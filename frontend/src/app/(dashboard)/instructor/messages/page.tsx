'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { messagesService } from '@/services/messages.service';
import type { StudentMessage } from '@/types/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCheck, ClipboardList, Inbox, Loader2, Mail, MailOpen } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const statusStyles: Record<string, string> = {
  NEW: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  READ: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  RESOLVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

const statusLabel: Record<string, string> = {
  NEW: 'New',
  READ: 'Read',
  RESOLVED: 'Resolved',
};

const filters = [
  { key: '', label: 'All' },
  { key: 'NEW', label: 'New' },
  { key: 'READ', label: 'Read' },
  { key: 'RESOLVED', label: 'Resolved' },
];

function MessageSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="space-y-3 p-5">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function InstructorMessagesPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');

  const { data: messages, isLoading, error, refetch } = useQuery({
    queryKey: ['messages'],
    queryFn: () => messagesService.list(),
    refetchInterval: 15000,
  });

  const filtered = (messages ?? []).filter((m) => !status || m.status === status);
  const newCount = (messages ?? []).filter((m) => m.status === 'NEW').length;

  const statusMutation = useMutation({
    mutationFn: ({ id, source, next }: { id: string; source: 'CONTACT' | 'EXAM_REPORT'; next: string }) =>
      messagesService.updateStatus(id, source, next),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      toast.success('Message updated');
    },
    onError: () => toast.error('Failed to update message'),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Student Messages</h1>
          <p className="text-sm text-muted-foreground">
            Read the messages students send at any time and track their status.
          </p>
        </div>
        <Badge variant="secondary" className="gap-1">
          {newCount > 0 ? (
            <><Mail className="h-3.5 w-3.5" />{newCount} new</>
          ) : (
            <><MailOpen className="h-3.5 w-3.5" />All caught up</>
          )}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border bg-muted p-1 w-fit">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatus(f.key)}
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              status === f.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && <MessageSkeleton />}
      {error && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/50 bg-destructive/5 py-12 text-center">
          <Inbox className="h-12 w-12 text-destructive mb-3" />
          <p className="text-lg font-medium text-destructive">Failed to load messages</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
            <Loader2 className="mr-1 h-3.5 w-3.5" />Retry
          </Button>
        </div>
      )}
      {!isLoading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <Inbox className="h-12 w-12 text-muted-foreground mb-3" />
          <p className="text-lg font-medium">No messages</p>
          <p className="text-sm text-muted-foreground mt-1">No student messages in this view.</p>
        </div>
      )}

      {!isLoading && !error && filtered.length > 0 && (
        <div className="space-y-4">
          {filtered.map((m) => (
            <MessageCard
              key={m.id}
              message={m}
              busy={statusMutation.isPending}
              onStatus={(next) => statusMutation.mutate({ id: m.id, source: m.source, next })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MessageCard({ message, busy, onStatus }: { message: StudentMessage; busy: boolean; onStatus: (status: string) => void }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              {message.name.charAt(0).toUpperCase()}
            </span>
            <div>
              <p className="font-medium">{message.name}</p>
              <p className="text-xs text-muted-foreground">{message.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {message.source === 'EXAM_REPORT' && (
              <Badge variant="outline" className="gap-1">
                <ClipboardList className="h-3 w-3" />
                {message.examTitle ?? 'Exam report'}
              </Badge>
            )}
            <Badge className={statusStyles[message.status] ?? ''}>{statusLabel[message.status] ?? message.status}</Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(message.createdAt).toLocaleString()}
            </span>
          </div>
        </div>
        <p className="mt-3 whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm">{message.message}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {message.status !== 'READ' && (
            <Button variant="outline" size="sm" onClick={() => onStatus('READ')} disabled={busy}>
              <MailOpen className="mr-1 h-3.5 w-3.5" />Mark as read
            </Button>
          )}
          {message.status !== 'RESOLVED' && (
            <Button size="sm" onClick={() => onStatus('RESOLVED')} disabled={busy}>
              <CheckCheck className="mr-1 h-3.5 w-3.5" />Mark resolved
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
