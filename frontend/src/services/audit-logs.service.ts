import { api, unwrap } from './api';
import type { AuditLog } from '@/types/api';

export const auditLogsService = {
  async list() {
    return unwrap<AuditLog[]>(await api.get('/audit-logs'));
  },
};
