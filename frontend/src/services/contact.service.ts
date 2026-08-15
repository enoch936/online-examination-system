import { api, unwrap } from './api';

export type ContactMessage = {
  id: string;
  name: string;
  email: string;
  message: string;
  status: string;
  createdAt: string;
};

export const contactService = {
  async send(data: { name: string; email: string; message: string }): Promise<ContactMessage> {
    return unwrap<ContactMessage>(await api.post('/contact', data));
  },
};
