import { api, unwrap } from './api';
import type { Notification } from '@/types/api';

export const notificationsService = {
  async list() {
    return unwrap<Notification[]>(await api.get('/notifications'));
  },
  async markRead(id: string) {
    return unwrap(await api.patch(`/notifications/${id}/read`));
  },
};
