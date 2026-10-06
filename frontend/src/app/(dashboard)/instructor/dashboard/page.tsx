'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  CategoryBarChart,
  ChartFrame,
  DonutChart,
  hasData,
  MetricGrid,
  PassFailBar,
  RadarPanel,
  ScoreBandChart,
  StatusPill,
  TrendAreaChart,
} from '@/features/charts/chart-kit';
import type { MetricTile } from '@/services/analytics.service';
import { analyticsService } from '@/services/analytics.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiErrorMessage } from '@/lib/api-error';

export default function InstructorDashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: analyticsService.getOverview,
  });

  const { data: examData, isLoading: examsLoading } = useQuery({
    queryKey: ['analytics', 'exams'],
    queryFn: () => analyticsService.getExamBreakdown(),
  });

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Instructor dashboard</h1>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm font-medium text-destructive">Could not load your dashboard</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {apiErrorMessage(error, 'Please try again later.')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const m = data?.metrics;
  const exams = examData?.exams ?? [];

  const metrics: MetricTile[] = m
    ? [
        { label: 'My exams', value: m.totalExams.toLocaleString(), hint: `${m.liveExams} published or live` },
        { label: 'Attempts', value: m.totalSessions.toLocaleString(), hint: `${m.liveSessions} in progress now` },
        { label: 'Grading queue', value: m.pendingGrading.toLocaleString(), tone: m.pendingGrading > 0 ? 'warning' : 'success', hint: m.pendingGrading > 0 ? 'Needs your marks' : 'All caught up' },
        { label: 'Pass rate', value: `${m.passRate}%`, tone: m.passRate >= 60 ? 'success' : 'warning', hint: `${m.passedCount} of ${m.officialResults} official` },
        { label: 'Submissions (24h)', value: m.submissions24h.toLocaleString(), hint: `${m.submissions7d} this week` },
        { label: 'Class average', value: `${m.averagePercentage}%`, tone: m.averagePercentage >= 50 ? 'success' : 'warning' },
        { label: 'Integrity flags (24h)', value: m.violations24h.toLocaleString(), tone: m.violations24h > 0 ? 'danger' : 'default' },
        { label: 'Manual adjustments', value: m.manualAdjustments.toLocaleString(), hint: `${m.totalRegrades} bulk regrades` },
      ]
    : [];

  // Difficulty of the cohort is the most actionable shape on this page: a tall
  // failing band means the teaching, not the marking.
  const bandShape = (data?.charts.scoreDistribution ?? []).map((b) => ({
    label: b.label.replace('-', ' to '),
    count: b.share,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Instructor dashboard</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Your exams, your cohorts, and the grading work outstanding. Scoped to exams you created or
          that were shared with you.
        </p>
      </div>

      <MetricGrid metrics={metrics} loading={isLoading} />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ChartFrame
            title="Your activity, last 14 days"
            description="Sessions started versus submissions received."
            isLoading={isLoading}
            isEmpty={!hasData(data?.charts.trend?.map((t) => ({ label: t.date, count: t.submissions })))}
            height={320}
          >
            <TrendAreaChart data={data?.charts.trend ?? []} />
          </ChartFrame>
        </div>
        <div className="space-y-4">
          <ChartFrame
            title="Pass / fail"
            isLoading={isLoading}
            isEmpty={!m || m.officialResults === 0}
          >
            <PassFailBar passed={m?.passedCount ?? 0} failed={m?.failedCount ?? 0} />
          </ChartFrame>
          <ChartFrame
            title="Cohort difficulty"
            description="Share of attempts per score band."
            isLoading={isLoading}
            isEmpty={!bandShape.some((b) => b.count > 0)}
          >
            <RadarPanel data={bandShape} valueKey="count" />
          </ChartFrame>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <ChartFrame
          title="Score distribution"
          description="Where your students are landing."
          isLoading={isLoading}
          isEmpty={!hasData(data?.charts.scoreDistribution?.map((b) => ({ label: b.label, count: b.count })))}
        >
          <ScoreBandChart data={data?.charts.scoreDistribution ?? []} />
        </ChartFrame>
        <ChartFrame
          title="Grading pipeline"
          isLoading={isLoading}
          isEmpty={!hasData(data?.charts.gradingStatus)}
        >
          <DonutChart data={(data?.charts.gradingStatus ?? []) as unknown as Array<Record<string, unknown>>} />
        </ChartFrame>
        <ChartFrame
          title="Integrity flags"
          description="Violations in your exams."
          isLoading={isLoading}
          isEmpty={!hasData(data?.charts.violationTypes)}
          height={300}
        >
          <CategoryBarChart
            data={(data?.charts.violationTypes ?? []) as unknown as Array<Record<string, unknown>>}
            horizontal
            colorBy="index"
          />
        </ChartFrame>
      </div>

      <Card className="card-hover">
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Your exams</CardTitle>
            <CardDescription>Newest first. Pending grading is the work still outstanding.</CardDescription>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/instructor/results">Open results</Link>
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {examsLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left text-sm font-medium">Exam</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">Live</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">Results</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">Pending</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">Average</th>
                </tr>
              </thead>
              <tbody>
                {exams.map((row) => (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium">{row.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {row.durationMinutes} min &middot; pass {row.passingMarks}/{row.totalMarks}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill value={row.status} />
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums">{row.liveSessions}</td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums">{row.results}</td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums">
                      {row.pendingGrading > 0 ? (
                        <span className="font-medium text-amber-600 dark:text-amber-400">
                          {row.pendingGrading}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums">
                      {row.results > 0 ? `${row.averagePercentage}%` : '—'}
                    </td>
                  </tr>
                ))}
                {exams.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      You have not created any exams yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}