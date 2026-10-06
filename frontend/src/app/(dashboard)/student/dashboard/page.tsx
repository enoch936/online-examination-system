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

export default function StudentDashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: analyticsService.getOverview,
  });

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">My dashboard</h1>
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

  const metrics: MetricTile[] = m
    ? [
        { label: 'Attempts made', value: m.totalSessions.toLocaleString(), hint: `${m.liveSessions} still in progress` },
        { label: 'Results released', value: m.officialResults.toLocaleString(), hint: `of ${m.totalResults} total attempts` },
        { label: 'My average', value: `${m.averagePercentage}%`, tone: m.averagePercentage >= 50 ? 'success' : 'warning', hint: 'Across official attempts' },
        { label: 'Pass rate', value: `${m.passRate}%`, tone: m.passRate >= 60 ? 'success' : 'warning', hint: `${m.passedCount} passed, ${m.failedCount} failed` },
        { label: 'Typical time used', value: m.medianDurationMinutes > 0 ? `${m.medianDurationMinutes} min` : '—', hint: 'Median across your attempts' },
        { label: 'Marks adjusted', value: m.manualAdjustments.toLocaleString(), hint: 'Results a grader changed' },
        { label: 'Extra time granted', value: m.timeExtensions24h.toLocaleString(), hint: 'In the last 24 hours' },
        { label: 'Time in exams', value: m.submissions7d.toLocaleString(), hint: 'Submissions in the last 7 days' },
      ]
    : [];

  const hasResults = (m?.officialResults ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">My dashboard</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Your own results and progress. Nothing here is shared with other candidates.
        </p>
      </div>

      <MetricGrid metrics={metrics} loading={isLoading} />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ChartFrame
            title="Your exam activity, last 14 days"
            description="Sessions you started versus papers you handed in."
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
            isEmpty={!hasResults}
          >
            <PassFailBar passed={m?.passedCount ?? 0} failed={m?.failedCount ?? 0} />
          </ChartFrame>
          <ChartFrame
            title="Your attempts"
            description="Not yet released by your instructor."
            isLoading={isLoading}
            isEmpty={!hasData(data?.charts.gradingStatus)}
          >
            <DonutChart data={(data?.charts.gradingStatus ?? []) as unknown as Array<Record<string, unknown>>} />
          </ChartFrame>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartFrame
          title="Where your scores land"
          description="Compared against the standard bands."
          isLoading={isLoading}
          isEmpty={!hasData(data?.charts.scoreDistribution?.map((b) => ({ label: b.label, count: b.count })))}
        >
          <ScoreBandChart data={data?.charts.scoreDistribution ?? []} />
        </ChartFrame>
        <ChartFrame
          title="How your exams ended"
          isLoading={isLoading}
          isEmpty={!hasData(data?.charts.submissionReasons)}
        >
          <CategoryBarChart
            data={(data?.charts.submissionReasons ?? []) as unknown as Array<Record<string, unknown>>}
            horizontal
            colorBy="index"
          />
        </ChartFrame>
      </div>

      <Card className="card-hover">
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Your recent results</CardTitle>
            <CardDescription>Newest first.</CardDescription>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/student/results">See all results</Link>
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left text-sm font-medium">Exam</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Outcome</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">State</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">Score</th>
                </tr>
              </thead>
              <tbody>
                {(data?.tables.recentResults ?? []).map((row) => (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-3 text-sm">{row.exam}</td>
                    <td className="px-4 py-3">
                      <StatusPill value={row.passed ? 'PASS' : 'FAIL'} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <StatusPill value={row.gradingStatus} />
                        {row.manualAdjusted ? (
                          <span className="text-[11px] text-amber-600 dark:text-amber-400">
                            Adjusted
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td
                      className={`px-4 py-3 text-right text-sm font-medium tabular-nums ${
                        row.percentage >= 50
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {row.percentage}%
                    </td>
                  </tr>
                ))}
                {(data?.tables.recentResults ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No results yet. Sit an exam and they will appear here.
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