import { api, unwrap } from './api';

export type PublicSettings = {
  environment: string | null;
  jwtAccessExpiry: string | null;
  jwtRefreshExpiry: string | null;
  rateLimit: string | null;
};

export const settingsService = {
  async getPublic(): Promise<PublicSettings> {
    return unwrap<PublicSettings>(await api.get('/settings/public'));
  },
};
