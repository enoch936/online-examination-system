import { api, unwrap } from './api';
import type { Notification } from '@/types/api';

export const notificationsService = {
  async list() {
    return unwrap<Notification[]>(await api.get('/notifications'));
  },
  async markRead(id: string) {
    return unwrap(await api.patch(`/notifications/${id}/read`));
  },
  async markAllRead() {
    return unwrap(await api.patch('/notifications/read-all'));
  },
  async unreadCount() {
    return unwrap<number>(await api.get('/notifications/unread-count'));
  },
};
