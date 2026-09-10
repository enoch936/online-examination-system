'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { pushService, toBase64Url, urlBase64ToUint8Array } from '@/services/push.service';

export type PushNotificationsAPI = {
  supported: boolean;
  enabled: boolean;
  loading: boolean;
  permission: NotificationPermission | 'unsupported';
  enable: () => Promise<void>;
  disable: () => Promise<void>;
};

export function usePushNotifications(): PushNotificationsAPI {
  const supported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    void (async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (!cancelled && subscription) setEnabled(true);
      } catch {
        /* no registration yet */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supported]);

  const enable = useCallback(async () => {
    if (!supported) return;
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error('Notification permission was not granted');
        return;
      }
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        const { publicKey } = await pushService.vapidKey();
        if (!publicKey) {
          toast.error('Browser notifications are not configured on the server yet');
          return;
        }
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      const rawP256dh = subscription.getKey('p256dh');
      const rawAuth = subscription.getKey('auth');
      if (!rawP256dh || !rawAuth) {
        toast.error('The browser did not provide push keys');
        return;
      }

      await pushService.subscribe({
        endpoint: subscription.endpoint,
        p256dh: toBase64Url(rawP256dh),
        auth: toBase64Url(rawAuth),
        userAgent: navigator.userAgent,
      });
      setEnabled(true);
      toast.success('Browser notifications enabled');
    } catch (err: unknown) {
      toast.error((err as Error)?.message ?? 'Failed to enable browser notifications');
    } finally {
      setLoading(false);
    }
  }, [supported]);

  const disable = useCallback(async () => {
    if (!supported) return;
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe().catch(() => undefined);
        await pushService.unsubscribe(endpoint).catch(() => undefined);
      }
      setEnabled(false);
      toast.success('Browser notifications disabled');
    } catch (err: unknown) {
      toast.error((err as Error)?.message ?? 'Failed to disable browser notifications');
    } finally {
      setLoading(false);
    }
  }, [supported]);

  const permission: NotificationPermission | 'unsupported' = supported
    ? Notification.permission
    : 'unsupported';

  return { supported, enabled, loading, permission, enable, disable };
}