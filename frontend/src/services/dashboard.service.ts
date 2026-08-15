import { api } from './api';
import type { ApiEnvelope } from '@/types/api';

type DashboardStats = {
  metrics: Array<{ label: string; value: string; key: string; tone?: string }>;
  chartData: Array<{ day: string; submissions: number }>;
  violations24h: number;
};

export const dashboardService = {
  async getStats() {
    const response = await api.get<ApiEnvelope<DashboardStats>>('/dashboard/stats');
    return response.data.data;
  },
};
