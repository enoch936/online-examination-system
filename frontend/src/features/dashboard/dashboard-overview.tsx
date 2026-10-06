'use client';

import { useQuery } from '@tanstack/react-query';
import {
  CategoryBarChart,
  ChartFrame,
  DonutChart,
  hasData,
  MetricGrid,
  MultiLineChart,
  PassFailBar,
  RadarPanel,
  TrendAreaChart,
} from '@/features/charts/chart-kit';
import type { MetricTile } from '@/services/analytics.service';
import { analyticsService } from '@/services/analytics.service';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiErrorMessage } from '@/lib/api-error';

/**
 * Platform view. Kept separate from the role dashboards because an admin's
 * headline numbers are platform-wide, while every other role's are scoped.
 */
export function DashboardOverview({ role }: { role: 'Student' | 'Instructor' | 'Admin' }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: analyticsService.getOverview,
  });

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">{role} dashboard</h1>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm font-medium text-destructive">Could not load the dashboard</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {apiErrorMessage(error, 'Please try again later.')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const m = data?.metrics;
  const isAdmin = role === 'Admin';

  const metrics: MetricTile[] = m
    ? isAdmin
      ? [
          { label: 'Exams', value: m.totalExams.toLocaleString(), hint: `${m.liveExams} live or published` },
          { label: 'Live sessions', value: m.liveSessions.toLocaleString(), tone: m.liveSessions > 0 ? 'success' : 'default', hint: `${m.totalSessions} total` },
          { label: 'Pending grading', value: m.pendingGrading.toLocaleString(), tone: m.pendingGrading > 0 ? 'warning' : 'default' },
          { label: 'Pass rate', value: `${m.passRate}%`, tone: m.passRate >= 60 ? 'success' : 'warning', hint: `${m.officialResults} official attempts` },
          { label: 'Submissions (24h)', value: m.submissions24h.toLocaleString() },
          { label: 'Average score', value: `${m.averagePercentage}%`, tone: m.averagePercentage >= 50 ? 'success' : 'warning' },
          { label: 'Integrity flags (24h)', value: m.violations24h.toLocaleString(), tone: m.violations24h > 0 ? 'danger' : 'default' },
          { label: 'Manual adjustments', value: m.manualAdjustments.toLocaleString(), hint: `${m.totalRegrades} regrades` },
        ]
      : [
          { label: 'Attempts', value: m.totalSessions.toLocaleString(), hint: `${m.liveSessions} live now` },
          { label: 'Results', value: m.officialResults.toLocaleString(), hint: `of ${m.totalResults} attempts` },
          { label: 'Pending grading', value: m.pendingGrading.toLocaleString(), tone: m.pendingGrading > 0 ? 'warning' : 'default' },
          { label: 'Average score', value: `${m.averagePercentage}%`, tone: m.averagePercentage >= 50 ? 'success' : 'warning' },
        ]
    : [];

  const subjectMix = (data?.charts.questionMix ?? []).map((row) => ({
    label: row.label,
    count: row.count,
  }));

  const riskShape = (data?.charts.riskLevels ?? []).map((row) => ({
    label: row.label,
    count: row.count,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">{role} dashboard</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          {isAdmin
            ? 'Platform-wide exam operations, grading load, and integrity signals.'
            : role === 'Instructor'
              ? 'Your exams, cohorts, and outstanding grading work.'
              : 'Your own results and progress.'}
        </p>
      </div>

      <MetricGrid metrics={metrics} loading={isLoading} />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ChartFrame
            title="Exam throughput, last 14 days"
            description="Sessions started, submissions received, results produced."
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
            description="Official attempts only."
            isLoading={isLoading}
            isEmpty={!m || m.officialResults === 0}
          >
            <PassFailBar passed={m?.passedCount ?? 0} failed={m?.failedCount ?? 0} />
          </ChartFrame>
          {isAdmin ? (
            <ChartFrame
              title="Grading pipeline"
              isLoading={isLoading}
              isEmpty={!hasData(data?.charts.gradingStatus)}
            >
              <DonutChart data={(data?.charts.gradingStatus ?? []) as unknown as Array<Record<string, unknown>>} />
            </ChartFrame>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <ChartFrame
          title="Question mix"
          description="Objective versus hand-graded types."
          isLoading={isLoading}
          isEmpty={!hasData(subjectMix)}
          height={300}
        >
          <RadarPanel data={subjectMix} />
        </ChartFrame>
        <ChartFrame
          title="Risk levels"
          description="Across live and finished sessions."
          isLoading={isLoading}
          isEmpty={!hasData(riskShape)}
          height={300}
        >
          <CategoryBarChart data={riskShape as unknown as Array<Record<string, unknown>>} colorBy="index" />
        </ChartFrame>
        <ChartFrame
          title="Violations"
          description="Integrity events recorded."
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

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <Card className="card-hover">
          <CardHeader>
            <CardTitle className="text-base">Pass rate trend</CardTitle>
            <CardDescription>Daily share of attempts that passed, from the trend window.</CardDescription>
          </CardHeader>
          <CardContent>
            <MultiLineChart
              data={(data?.charts.trend ?? []).map((point) => ({
                date: point.date.slice(5),
                submissions: point.submissions,
                sessionsStarted: point.sessionsStarted,
                resultsPublished: point.resultsPublished,
              }))}
              series={[
                { key: 'submissions', label: 'Submissions' },
                { key: 'sessionsStarted', label: 'Sessions started' },
                { key: 'resultsPublished', label: 'Results' },
              ]}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}