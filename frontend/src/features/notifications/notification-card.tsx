'use client';

import Link from 'next/link';
import { Bell, BellDot, CheckCheck, FileCheck, Info, Megaphone, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Notification } from '@/types/api';

const typeIconMap: Record<string, typeof Bell> = {
  exam_reminder: Bell,
  EXAM_REMINDER: Bell,
  result: FileCheck,
  RESULT_PUBLISHED: FileCheck,
  proctoring: ShieldAlert,
  system: Info,
  INFO: Info,
  SUCCESS: FileCheck,
  announcement: Megaphone,
  RETAKE_REQUEST: Megaphone,
  RETAKE_APPROVED: FileCheck,
  RETAKE_REJECTED: ShieldAlert,
  RESUME_REQUEST: Megaphone,
  RESUME_APPROVED: FileCheck,
  RESUME_REJECTED: ShieldAlert,
};

export function NotificationCard({
  notification,
  onMarkRead,
  href,
  onNavigate,
}: {
  notification: Notification;
  onMarkRead?: (id: string) => void;
  href?: string;
  onNavigate?: () => void;
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
              {href ? (
                <Link
                  href={href}
                  onClick={onNavigate}
                  className="flex items-center gap-2 text-sm font-semibold hover:underline"
                >
                  {notification.title}
                </Link>
              ) : (
                <CardTitle className="text-sm">{notification.title}</CardTitle>
              )}
              {isUnread && <BellDot className="h-3 w-3 text-primary" />}
            </div>
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              {new Date(notification.createdAt).toLocaleDateString()}
            </span>
          </div>
          <CardDescription className="text-sm">{notification.message}</CardDescription>
          {isUnread && onMarkRead && (
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