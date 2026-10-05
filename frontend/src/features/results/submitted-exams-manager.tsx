'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { classesService } from '@/services/classes.service';
import { examsService } from '@/services/exams.service';
import { resultsService, type BulkGradeSummary, type ResultFilters } from '@/services/results.service';
import { apiErrorMessage } from '@/lib/api-error';
import { toast } from 'sonner';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  FileQuestion,
  Layers,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  Trophy,
  UserCheck,
} from 'lucide-react';
import { SubmissionDetailSheet } from '@/features/results/submission-detail-sheet';
import type { GradingStatus, Result } from '@/types/api';

const GRADE_COLORS: Record<string, string> = {
  A: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  B: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  C: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  D: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  F: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const GRADING_STATUSES: Array<{ value: GradingStatus | ''; label: string }> = [
  { value: '', label: 'Any grading status' },
  { value: 'PENDING', label: 'Pending manual grading' },
  { value: 'GRADED', label: 'Graded' },
  { value: 'PUBLISHED', label: 'Published' },
];

const SUBMISSION_STATUSES: Array<{ value: string; label: string }> = [
  { value: '', label: 'Any submission status' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'AUTO_SUBMITTED', label: 'Auto-submitted' },
  { value: 'NEEDS_MANUAL_GRADING', label: 'Needs manual grading' },
  { value: 'GRADED', label: 'Graded' },
];

const SORTS: Array<{ value: NonNullable<ResultFilters['sortBy']>; label: string }> = [
  { value: 'submittedAt', label: 'Recently submitted' },
  { value: 'percentage', label: 'Score' },
  { value: 'student', label: 'Student name' },
];

const INPUT = 'h-10 w-full rounded-md border bg-background px-3 text-sm';
const SELECT = 'h-10 w-full rounded-md border bg-background px-3 text-sm';

function GradeBadge({ grade }: { grade?: string | null }) {
  if (!grade) return <span className="text-sm text-muted-foreground">&mdash;</span>;
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
        GRADE_COLORS[grade] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300'
      }`}
    >
      {grade}
    </span>
  );
}

/**
 * Grading lifecycle, shown as its own state rather than inferred from
 * `publishedAt`. A result can be fully graded and still unpublished, and a
 * result can be published and manually adjusted — collapsing those into one
 * column is what made "who still owes me marks" unanswerable.
 */
function GradingStatusBadge({ result }: { result: Result }) {
  const status = result.gradingStatus ?? (result.publishedAt ? 'PUBLISHED' : 'GRADED');
  if (status === 'PENDING') return <Badge variant="warning">Pending grading</Badge>;
  if (status === 'PUBLISHED') return <Badge variant="success">Published</Badge>;
  return <Badge variant="secondary">Graded</Badge>;
}

/**
 * Automatic score, manual adjustment and final score side by side.
 *
 * `autoScore` is what the automatic pass produced and `score` is final, so the
 * difference is the grader's contribution rather than something to be inferred
 * by comparing numbers across screens.
 */
function ScoreCell({ result }: { result: Result }) {
  const final = Number(result.score);
  const auto = result.autoScore == null ? null : Number(result.autoScore);
  const adjusted = Boolean(result.manualAdjusted) || (auto != null && Math.abs(auto - final) > 0.001);
  return (
    <div className="text-sm">
      <span className="tabular-nums">
        {final}
        <span className="text-muted-foreground"> / {Number(result.maxScore)}</span>
      </span>
      {auto != null && (
        <p className="text-[11px] text-muted-foreground">
          auto {auto}
          {adjusted && <span className="ml-1 text-amber-600">({final - auto > 0 ? '+' : ''}{Math.round((final - auto) * 100) / 100} manual)</span>}
        </p>
      )}
    </div>
  );
}

export function SubmittedExamsManager({ role }: { role: 'Instructor' | 'Admin' }) {
  const queryClient = useQueryClient();
  const [detailId, setDetailId] = useState<string | null>(null);

  // Every criterion here is executed by the backend. Nothing below filters the
  // rows it received: the table renders whatever the query returned.
  const [filters, setFilters] = useState<ResultFilters>({});
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<NonNullable<ResultFilters['sortBy']>>('submittedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [regrade, setRegrade] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<null | { kind: 'selected' } | { kind: 'ungraded' }>(null);

  const set = <K extends keyof ResultFilters>(key: K, value: ResultFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const { data: exams } = useQuery({ queryKey: ['exams'], queryFn: () => examsService.list() });
  const { data: classes } = useQuery({ queryKey: ['classes'], queryFn: () => classesService.list() });

  const activeFilters: ResultFilters = useMemo(
    () => ({ ...filters, sortBy, sortDir, page, limit: 25 }),
    [filters, sortBy, sortDir, page],
  );

  const { data: resultsData, isLoading, error, isFetching, refetch } = useQuery({
    queryKey: ['results', activeFilters],
    queryFn: () => resultsService.list(activeFilters),
    placeholderData: (prev) => prev,
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => resultsService.publish(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['results'] });
      void queryClient.invalidateQueries({ queryKey: ['certificates'] });
      toast.success('Result published');
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, 'Failed to publish result')),
  });

  const bulkMutation = useMutation({
    mutationFn: async (target: { kind: 'selected' | 'ungraded' }) => {
      const examId = filters.examId;
      if (!examId) throw new Error('Choose an exam first — bulk grading works on one exam at a time');
      if (target.kind === 'selected') {
        // Only ids from the rows currently on screen, so a page change cannot
        // quietly include a result the proctor can no longer see or justify.
        return resultsService.bulkGradeByIds({ resultIds: selectedOnPage, regrade });
      }
      // "Ungraded" = every attempt on the exam still owing marks, narrowed by
      // whatever class/student filters are active. Resolution happens server-side.
      return resultsService.bulkGrade({
        examId,
        classId: filters.classId,
        onlyUngraded: !regrade,
        regrade,
      });
    },
    onSuccess: (summary: BulkGradeSummary, target) => {
      void queryClient.invalidateQueries({ queryKey: ['results'] });
      setSelected([]);
      setPendingTarget(null);
      const parts = [
        `${summary.graded} graded`,
        summary.needsManualGrading > 0 ? `${summary.needsManualGrading} still need a human` : null,
        summary.skipped > 0 ? `${summary.skipped} unchanged` : null,
        summary.failed.length > 0 ? `${summary.failed.length} failed` : null,
      ].filter(Boolean);
      toast.success(`${parts.join(' · ')} of ${summary.matched} matched`);
      if (summary.failed.length > 0) {
        toast.error(summary.failed[0]!.reason);
      }
      void target;
    },
    onError: (err: unknown) => {
      setPendingTarget(null);
      toast.error(apiErrorMessage(err, 'Bulk grading failed'));
    },
  });

  const results = useMemo(() => resultsData?.data ?? [], [resultsData]);
  const pagination = resultsData?.pagination;
  const totalPages = pagination?.totalPages ?? 1;
  const activeFilterCount = Object.values(filters).filter((v) => v !== undefined && v !== '').length;

  // A selection is only meaningful while the rows under it are still on screen,
  // so intersect at render time instead of storing a copy and pruning it later.
  const selectedOnPage = useMemo(
    () => selected.filter((id) => results.some((r) => r.id === id)),
    [selected, results],
  );

  const allOnPageSelected = results.length > 0 && results.every((r) => selectedOnPage.includes(r.id));
  const toggleAll = () =>
    setSelected((prev) =>
      allOnPageSelected
        ? prev.filter((id) => !results.some((r) => r.id === id))
        : [...new Set([...prev, ...results.map((r) => r.id)])],
    );
  const toggleOne = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const runBulk = (kind: 'selected' | 'ungraded') => {
    if (kind === 'selected' && selected.length === 0) {
      toast.error('Select at least one result first');
      return;
    }
    setPendingTarget({ kind });
    bulkMutation.mutate({ kind });
  };

  const clearFilters = () => {
    setFilters({});
    setSearch('');
    setSubmitted('');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Submitted exams</h1>
          <p className="text-sm text-muted-foreground">
            Search, filter and grade submitted work. Filters run on the server, so totals match what you see.
          </p>
        </div>
        <Badge variant="secondary">{role}</Badge>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <form
              className="flex flex-1 items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                set('q', search.trim() || undefined);
              }}
            >
              <label className="min-w-[220px] flex-1 text-xs text-muted-foreground">
                Search student or exam
                <input
                  className={`${INPUT} mt-1`}
                  value={search}
                  placeholder="Name, email or exam title"
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <Button type="submit" variant="outline" className="h-10">
                Search
              </Button>
            </form>

            <label className="text-xs text-muted-foreground">
              Exam
              <select
                className={`${SELECT} mt-1 min-w-[200px]`}
                value={filters.examId ?? ''}
                onChange={(e) => set('examId', e.target.value || undefined)}
              >
                <option value="">All exams</option>
                {exams?.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.title}
                  </option>
                ))}
              </select>
            </label>

            <Button
              variant="outline"
              className="h-10"
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
            >
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              title="Refresh"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {showFilters && (
            <div className="grid gap-3 border-t pt-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs text-muted-foreground">
                Class
                <select
                  className={`${SELECT} mt-1`}
                  value={filters.classId ?? ''}
                  onChange={(e) => set('classId', e.target.value || undefined)}
                >
                  <option value="">All classes</option>
                  {classes?.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} ({cls.code})
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted-foreground">
                Grading status
                <select
                  className={`${SELECT} mt-1`}
                  value={filters.gradingStatus ?? ''}
                  onChange={(e) =>
                    set('gradingStatus', (e.target.value || undefined) as ResultFilters['gradingStatus'])
                  }
                >
                  {GRADING_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted-foreground">
                Submission status
                <select
                  className={`${SELECT} mt-1`}
                  value={filters.submissionStatus ?? ''}
                  onChange={(e) => set('submissionStatus', e.target.value || undefined)}
                >
                  {SUBMISSION_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted-foreground">
                Result
                <select
                  className={`${SELECT} mt-1`}
                  value={filters.passed === undefined ? '' : filters.passed ? 'pass' : 'fail'}
                  onChange={(e) =>
                    set('passed', e.target.value === '' ? undefined : e.target.value === 'pass')
                  }
                >
                  <option value="">Pass and fail</option>
                  <option value="pass">Passed only</option>
                  <option value="fail">Failed only</option>
                </select>
              </label>

              <label className="text-xs text-muted-foreground">
                Score from (%)
                <input
                  type="number"
                  min={0}
                  max={100}
                  className={`${INPUT} mt-1`}
                  value={filters.minPercentage ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value;
                    set('minPercentage', raw === '' ? undefined : Number(raw));
                  }}
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Score to (%)
                <input
                  type="number"
                  min={0}
                  max={100}
                  className={`${INPUT} mt-1`}
                  value={filters.maxPercentage ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value;
                    set('maxPercentage', raw === '' ? undefined : Number(raw));
                  }}
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Submitted after
                <input
                  type="date"
                  className={`${INPUT} mt-1`}
                  value={submitted}
                  onChange={(e) => {
                    setSubmitted(e.target.value);
                    set('submittedFrom', e.target.value ? new Date(e.target.value).toISOString() : undefined);
                  }}
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Submitted before
                <input
                  type="date"
                  className={`${INPUT} mt-1`}
                  onChange={(e) =>
                    set(
                      'submittedTo',
                      e.target.value
                        ? // Inclusive of the whole end day, not midnight of it.
                          new Date(new Date(e.target.value).getTime() + 86_399_999).toISOString()
                        : undefined,
                    )
                  }
                />
              </label>

              <label className="text-xs text-muted-foreground">
                Sort by
                <select className={`${SELECT} mt-1`} value={sortBy} onChange={(e) => setSortBy(e.target.value as NonNullable<ResultFilters['sortBy']>)}>
                  {SORTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted-foreground">
                Direction
                <select
                  className={`${SELECT} mt-1`}
                  value={sortDir}
                  onChange={(e) => setSortDir(e.target.value as 'asc' | 'desc')}
                >
                  <option value="desc">Highest / newest first</option>
                  <option value="asc">Lowest / oldest first</option>
                </select>
              </label>
              <label className="flex items-center gap-2 self-end text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={regrade}
                  onChange={(e) => setRegrade(e.target.checked)}
                />
                Include already-graded attempts (re-grade)
              </label>
              <div className="flex items-end">
                <Button variant="ghost" onClick={clearFilters} className="h-10">
                  Clear filters
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <Button
              size="sm"
              variant="outline"
              disabled={!filters.examId || bulkMutation.isPending}
              onClick={() => runBulk('ungraded')}
            >
              {bulkMutation.isPending && pendingTarget?.kind === 'ungraded' ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="mr-1 h-3.5 w-3.5" />
              )}
              Grade all ungraded{filters.classId ? ' in class' : ''}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={selectedOnPage.length === 0 || bulkMutation.isPending}
              onClick={() => runBulk('selected')}
            >
              {bulkMutation.isPending && pendingTarget?.kind === 'selected' ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <UserCheck className="mr-1 h-3.5 w-3.5" />
              )}
              Grade {selectedOnPage.length > 0 ? `${selectedOnPage.length} selected` : 'selected'}
            </Button>
            {!filters.examId && (
              <p className="text-xs text-muted-foreground">
                Pick an exam to grade every ungraded attempt at once.
              </p>
            )}
            {selectedOnPage.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
                Clear selection
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="space-y-4 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <FileQuestion className="h-10 w-10 text-destructive" />
            <p className="text-sm font-medium text-destructive">Failed to load submitted exams</p>
            <p className="text-sm text-muted-foreground">{apiErrorMessage(error, 'Please try again later.')}</p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : results.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Trophy className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium">No results match these filters</p>
            <p className="text-sm text-muted-foreground">
              {activeFilterCount > 0 || search ? 'Try widening or clearing the filters.' : 'Submitted attempts will appear here.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={allOnPageSelected}
                      onChange={toggleAll}
                      aria-label="Select all rows on this page"
                      title="Select all rows on this page"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Student</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Exam</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Score</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Percentage</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Grade</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Grading</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Certificate</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result) => {
                  const student = result.submission?.session?.student;
                  return (
                    <tr
                      key={result.id}
                      className={`border-b last:border-0 hover:bg-muted/50 ${selectedOnPage.includes(result.id) ? 'bg-primary/5' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={selectedOnPage.includes(result.id)}
                          onChange={() => toggleOne(result.id)}
                          aria-label={`Select result for ${student ? `${student.firstName} ${student.lastName}` : 'student'}`}
                        />
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {student ? (
                          `${student.firstName} ${student.lastName}`
                        ) : (
                          <span className="text-muted-foreground">Unknown</span>
                        )}
                        {result.submission?.submittedAt && (
                          <p className="text-[11px] text-muted-foreground">
                            {new Date(result.submission.submittedAt).toLocaleString()}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">{result.exam.title}</td>
                      <td className="px-4 py-3">
                        <ScoreCell result={result} />
                      </td>
                      <td className="px-4 py-3 text-sm">{Number(result.percentage).toFixed(1)}%</td>
                      <td className="px-4 py-3">
                        <GradeBadge grade={result.grade} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <GradingStatusBadge result={result} />
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            {result.passed ? <Badge variant="success">Pass</Badge> : <Badge variant="warning">Fail</Badge>}
                            {result.manualAdjusted && (
                              <span title="A grader changed at least one mark">
                                <Layers className="h-3 w-3 text-amber-600" />
                              </span>
                            )}
                            {(result.regradeCount ?? 0) > 0 && (
                              <span title={`Re-graded ${result.regradeCount} time(s)`}>
                                regrade ×{result.regradeCount}
                              </span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {result.certificate ? (
                          <Badge variant="outline">Issued</Badge>
                        ) : result.passed ? (
                          <span className="text-xs text-muted-foreground">Not issued</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">&mdash;</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Open grading and certificate controls"
                            onClick={() => setDetailId(result.id)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {!result.publishedAt && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Publish"
                              onClick={() => publishMutation.mutate(result.id)}
                              disabled={publishMutation.isPending}
                            >
                              {publishMutation.isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Send className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {pagination && pagination.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            Page {pagination.page} of {totalPages} · {pagination.total} result{pagination.total === 1 ? '' : 's'} match
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isFetching}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isFetching}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      <SubmissionDetailSheet
        resultId={detailId}
        open={Boolean(detailId)}
        onOpenChange={(next) => {
          if (!next) setDetailId(null);
        }}
      />
    </div>
  );
}