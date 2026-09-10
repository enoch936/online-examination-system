'use client';

import { Bell, CheckCheck, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getNotificationLink, useNotifications } from '@/hooks/use-notifications';
import { NotificationCard } from './notification-card';
import { PushPreferences } from './push-preferences';

export function NotificationsPage() {
  const { notifications, unreadCount, isLoading, error, markRead, markAllRead } = useNotifications();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Exam reminders, result announcements, proctoring notices, and system updates.
          </p>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex-row gap-3 space-y-0 p-6">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </CardContent>
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
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Exam reminders, result announcements, proctoring notices, and system updates.
          </p>
        </div>
        {unreadCount > 0 ? (
          <Button variant="outline" size="sm" onClick={() => markAllRead()} className="gap-1.5">
            <CheckCheck className="h-4 w-4" />
            Mark all as read
          </Button>
        ) : (
          <span className="pt-2 text-sm text-muted-foreground">Up to date</span>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        {unreadCount > 0
          ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
          : 'All caught up'}
      </p>

      <PushPreferences />

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
              onMarkRead={markRead}
              href={getNotificationLink(notification)}
            />
          ))}
        </div>
      )}
    </div>
  );
}