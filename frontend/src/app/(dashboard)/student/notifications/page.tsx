'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  BellDot,
  CheckCheck,
  FileCheck,
  Info,
  Megaphone,
  SearchX,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { notificationsService } from '@/services/notifications.service';
import type { Notification } from '@/types/api';

const typeIconMap: Record<string, typeof Bell> = {
  exam_reminder: Bell,
  result: FileCheck,
  proctoring: ShieldAlert,
  system: Info,
  announcement: Megaphone,
};

function NotificationCard({
  notification,
  onMarkRead,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
}) {
  const isUnread = !notification.readAt;
  const Icon = typeIconMap[notification.type] ?? Bell;

  return (
    <Card
      className={`transition-colors hover:border-primary/50 ${
        isUnread ? 'border-l-4 border-l-primary bg-muted/30' : ''
      }`}
    >
      <CardHeader className="flex-row items-start gap-3 space-y-0">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            isUnread ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm">{notification.title}</CardTitle>
              {isUnread && <BellDot className="h-3 w-3 text-primary" />}
            </div>
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              {new Date(notification.createdAt).toLocaleDateString()}
            </span>
          </div>
          <CardDescription className="text-sm">{notification.message}</CardDescription>
          {isUnread && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-8 gap-1.5 text-xs"
              onClick={() => onMarkRead(notification.id)}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark as read
            </Button>
          )}
        </div>
      </CardHeader>
    </Card>
  );
}

export default function StudentNotificationsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['student-notifications'],
    queryFn: notificationsService.list,
  });

  const markReadMutation = useMutation({
    mutationFn: notificationsService.markRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-notifications'] });
      toast.success('Notification marked as read');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Failed to mark as read');
    },
  });

  const handleMarkAllRead = () => {
    if (!notifications) return;
    const unread = notifications.filter((n) => !n.readAt);
    Promise.all(unread.map((n) => notificationsService.markRead(n.id)))
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['student-notifications'] });
        toast.success('All notifications marked as read');
      })
      .catch(() => toast.error('Failed to mark all as read'));
  };

  const notifications = Array.isArray(data) ? data : [];
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Badge variant="outline">Student</Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">Notifications</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Exam reminders, result announcements, proctoring notices, and system updates.
          </p>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex-row gap-3 space-y-0">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <Badge variant="outline">Student</Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">Notifications</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <SearchX className="h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium">Failed to load notifications</p>
            <p className="text-sm text-muted-foreground">Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Badge variant="outline">Student</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal">Notifications</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Exam reminders, result announcements, proctoring notices, and system updates.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {unreadCount > 0
            ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
            : 'All caught up'}
        </p>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAllRead} className="gap-1.5">
            <CheckCheck className="h-4 w-4" />
            Mark all as read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Bell className="h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium">No notifications</p>
            <p className="text-sm text-muted-foreground">
              You will see exam reminders, results, and system updates here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              onMarkRead={(id) => markReadMutation.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
