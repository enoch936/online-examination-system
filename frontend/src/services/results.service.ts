import { api, unwrap } from './api';
import type { GradingStatus, Result, ResultDetail, PaginatedResponse } from '@/types/api';

/**
 * Every criterion the results table can filter or sort by.
 *
 * All of these are executed by Postgres: the browser sends criteria and renders
 * whatever comes back, it never filters the page itself.
 */
export type ResultFilters = {
  examId?: string;
  classId?: string;
  studentId?: string;
  q?: string;
  gradingStatus?: GradingStatus;
  submissionStatus?: string;
  passed?: boolean;
  certificateStatus?: 'issued' | 'none';
  minPercentage?: number;
  maxPercentage?: number;
  submittedFrom?: string;
  submittedTo?: string;
  sortBy?: 'submittedAt' | 'percentage' | 'student';
  sortDir?: 'asc' | 'desc';
  page?: number;
  limit?: number;
};

/** What a bulk grading run did, as reported by the backend. */
export type BulkGradeSummary = {
  matched: number;
  graded: number;
  skipped: number;
  needsManualGrading: number;
  failed: Array<{ resultId: string; reason: string }>;
};

export const resultsService = {
  async list(params?: ResultFilters) {
    // Empty strings mean "no filter"; sending them would otherwise match nothing.
    const cleaned = Object.fromEntries(
      Object.entries(params ?? {}).filter(([, value]) => value !== '' && value !== undefined && value !== null),
    );
    return unwrap<PaginatedResponse<Result>>(await api.get('/results', { params: cleaned }));
  },
  async get(id: string) {
    return unwrap<ResultDetail>(await api.get(`/results/${id}`));
  },
  async publish(id: string) {
    return unwrap(await api.patch(`/results/${id}/publish`));
  },
  async grade(id: string, answers: Array<{ answerId: string; score: number; feedback?: string }>) {
    return unwrap(await api.post(`/results/${id}/grade`, { answers }));
  },
  async override(
    id: string,
    payload: { grade?: string | null; feedback?: string | null; recomputeGrade?: boolean },
  ) {
    return unwrap(await api.patch(`/results/${id}/override`, payload));
  },
  /**
   * Grade by selection rather than by row id: an exam, optionally narrowed to a
   * class and/or specific students. `onlyUngraded` restricts the run to attempts
   * that still owe marks; `regrade` re-runs attempts already marked GRADED.
   */
  async bulkGrade(payload: {
    examId: string;
    classId?: string;
    studentIds?: string[];
    onlyUngraded?: boolean;
    regrade?: boolean;
  }) {
    return unwrap<BulkGradeSummary>(await api.post('/results/bulk/grade', payload));
  },
  /** Grade exactly the rows ticked in the table. */
  async bulkGradeByIds(payload: { resultIds: string[]; regrade?: boolean }) {
    return unwrap<BulkGradeSummary>(await api.post('/results/bulk/grade-by-ids', payload));
  },
};