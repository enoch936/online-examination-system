import type { ReactNode } from 'react';
import { api } from './api';
import type { ApiEnvelope } from '@/types/api';

export type AnalyticsAudience = 'ADMIN' | 'INSTRUCTOR' | 'STUDENT';

export type NamedCount = { label: string; count: number };

export type ScoreBand = {
  label: string;
  count: number;
  share: number;
  passed: boolean;
};

export type TrendPoint = {
  date: string;
  submissions: number;
  sessionsStarted: number;
  resultsPublished: number;
};

export type AtRiskSession = {
  id: string;
  student: string;
  exam: string;
  riskLevel: string;
  riskScore: number;
  disconnectCount: number;
  status: string;
};

export type RecentResultRow = {
  id: string;
  student: string;
  exam: string;
  percentage: number;
  passed: boolean;
  gradingStatus: string;
  manualAdjusted: boolean;
  submittedAt: string;
};

export type AnalyticsOverview = {
  generatedAt: string;
  audience: AnalyticsAudience;
  scope: {
    examCount: number;
    sessionCount: number;
    resultCount: number;
    officialResultCount: number;
  };
  metrics: {
    totalExams: number;
    liveExams: number;
    totalSessions: number;
    liveSessions: number;
    totalResults: number;
    officialResults: number;
    pendingGrading: number;
    submissions24h: number;
    submissions7d: number;
    violations24h: number;
    timeExtensions24h: number;
    passRate: number;
    passedCount: number;
    failedCount: number;
    averagePercentage: number;
    manualAdjustments: number;
    totalRegrades: number;
    medianDurationMinutes: number;
  };
  charts: {
    trend: TrendPoint[];
    scoreDistribution: ScoreBand[];
    examStatus: NamedCount[];
    sessionStatus: NamedCount[];
    gradingStatus: NamedCount[];
    riskLevels: NamedCount[];
    violationTypes: NamedCount[];
    submissionReasons: NamedCount[];
    questionMix: NamedCount[];
    topExams: Array<{
      examId: string;
      label: string;
      attempts: number;
      averagePercentage: number;
    }>;
    enrollmentByCourse: NamedCount[];
  };
  tables: {
    atRiskSessions: AtRiskSession[];
    recentResults: RecentResultRow[];
  };
};

export type ExamBreakdownRow = {
  id: string;
  title: string;
  status: string;
  durationMinutes: number;
  totalMarks: number;
  passingMarks: number;
  attempts: number;
  results: number;
  liveSessions: number;
  pendingGrading: number;
  averagePercentage: number;
};

export const analyticsService = {
  async getOverview() {
    const response = await api.get<ApiEnvelope<AnalyticsOverview>>('/analytics/overview');
    return response.data.data;
  },

  async getExamBreakdown(examIds?: string[]) {
    const query = examIds?.length ? `?examIds=${encodeURIComponent(examIds.join(','))}` : '';
    const response = await api.get<ApiEnvelope<{ exams: ExamBreakdownRow[] }>>(
      `/analytics/exams${query}`,
    );
    return response.data.data;
  },
};

export type MetricTile = {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
  /** Optional server-provided sparkline series. */
  spark?: Array<{ value: number }>;
  icon?: ReactNode;
};