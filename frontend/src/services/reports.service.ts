import { api } from './api';

export const reportsService = {
  async getExamReport(examId: string) {
    const response = await api.get(`/reports/exams/${examId}`);
    return response.data;
  },
  async downloadPdf(examId: string) {
    const response = await api.get(`/reports/exams/${examId}/pdf`, { responseType: 'blob' });
    return response.data;
  },
  async downloadExcel(examId: string) {
    const response = await api.get(`/reports/exams/${examId}/excel`, { responseType: 'blob' });
    return response.data;
  },
};
