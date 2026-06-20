import { api } from './api';

export const reportsService = {
  async getExamReport(examId: string) {
    const response = await api.get(`/reports/exams/${examId}`);
    return response.data;
  },
  async downloadExamPdf(examId: string) {
    const response = await api.get(`/reports/exams/${examId}/pdf`, { responseType: 'blob' });
    return response.data;
  },
  async downloadExamExcel(examId: string) {
    const response = await api.get(`/reports/exams/${examId}/excel`, { responseType: 'blob' });
    return response.data;
  },

  async getStudentReport(studentId: string) {
    const response = await api.get(`/reports/students/${studentId}`);
    return response.data;
  },
  async downloadStudentPdf(studentId: string) {
    const response = await api.get(`/reports/students/${studentId}/pdf`, { responseType: 'blob' });
    return response.data;
  },
  async downloadStudentExcel(studentId: string) {
    const response = await api.get(`/reports/students/${studentId}/excel`, { responseType: 'blob' });
    return response.data;
  },

  async getSubjectReport(subjectId: string) {
    const response = await api.get(`/reports/subjects/${subjectId}`);
    return response.data;
  },
  async downloadSubjectPdf(subjectId: string) {
    const response = await api.get(`/reports/subjects/${subjectId}/pdf`, { responseType: 'blob' });
    return response.data;
  },
  async downloadSubjectExcel(subjectId: string) {
    const response = await api.get(`/reports/subjects/${subjectId}/excel`, { responseType: 'blob' });
    return response.data;
  },

  async getOverview() {
    const response = await api.get('/reports/overview');
    return response.data;
  },
  async downloadOverviewPdf() {
    const response = await api.get('/reports/overview/pdf', { responseType: 'blob' });
    return response.data;
  },
  async downloadOverviewExcel() {
    const response = await api.get('/reports/overview/excel', { responseType: 'blob' });
    return response.data;
  },
};
