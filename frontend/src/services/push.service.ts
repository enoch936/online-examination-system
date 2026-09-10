import { api, unwrap } from './api';

export type PushSubscriptionInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
};

export const pushService = {
  async vapidKey() {
    return unwrap<{ publicKey: string | null }>(await api.get('/push/vapid-key'));
  },
  async subscribe(subscription: PushSubscriptionInput) {
    return unwrap(await api.post('/push/subscriptions', subscription));
  },
  async unsubscribe(endpoint: string) {
    return unwrap(await api.delete('/push/subscriptions', { data: { endpoint } }));
  },
};

export function toBase64Url(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}