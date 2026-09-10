'use client';

import { useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { notificationsService } from '@/services/notifications.service';
import { getSocket } from '@/services/socket.service';
import { useAuthStore } from '@/store/auth.store';
import type { Notification } from '@/types/api';

export const NOTIFICATIONS_QUERY_KEY = ['notifications'];

export function getNotificationLink(notification: Notification): string | undefined {
  if (!notification.metadata) return undefined;
  try {
    const parsed = JSON.parse(notification.metadata) as { link?: string };
    return parsed.link;
  } catch {
    return undefined;
  }
}

export function useNotifications() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: notificationsService.list,
    refetchInterval: 60_000,
    enabled: Boolean(userId),
  });

  useEffect(() => {
    if (!userId) return;
    const socket = getSocket();
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    };
    socket.on('notification:new', invalidate);
    const subscribe = () => socket.emit('notifications:subscribe', { userId });
    if (socket.connected) {
      subscribe();
    } else {
      socket.once('connect', subscribe);
      socket.connect();
    }
    return () => {
      socket.off('notification:new', invalidate);
    };
  }, [userId, queryClient]);

  const notifications = useMemo(() => {
    const data = query.data;
    return Array.isArray(data) ? data : [];
  }, [query.data]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.readAt).length, [notifications]);

  const markReadMutation = useMutation({
    mutationFn: notificationsService.markRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: notificationsService.markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      toast.success('All notifications marked as read');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Failed to mark all as read');
    },
  });

  return {
    notifications,
    unreadCount,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    markRead: markReadMutation.mutate,
    markAllRead: markAllReadMutation.mutate,
  };
}