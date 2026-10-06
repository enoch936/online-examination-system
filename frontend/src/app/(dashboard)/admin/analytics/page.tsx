'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ChartFrame,
  CategoryBarChart,
  DonutChart,
  hasData,
  MetricGrid,
  PassFailBar,
  ScoreBandChart,
  StatusPill,
  TrendAreaChart,
  humanize,
} from '@/features/charts/chart-kit';
import type { MetricTile } from '@/services/analytics.service';
import { analyticsService } from '@/services/analytics.service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiErrorMessage } from '@/lib/api-error';

export default function AdminAnalyticsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: analyticsService.getOverview,
  });

  const { data: examData } = useQuery({
    queryKey: ['analytics', 'exams'],
    queryFn: () => analyticsService.getExamBreakdown(),
    enabled: !error,
  });

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm font-medium text-destructive">Could not load analytics</p>
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
        { label: 'Total exams', value: m.totalExams.toLocaleString(), hint: `${m.liveExams} live or published` },
        { label: 'Exam sessions', value: m.totalSessions.toLocaleString(), hint: `${m.liveSessions} in progress right now` },
        { label: 'Submissions (24h)', value: m.submissions24h.toLocaleString(), hint: `${m.submissions7d} in the last 7 days` },
        { label: 'Average score', value: `${m.averagePercentage}%`, tone: m.averagePercentage >= 50 ? 'success' : 'warning', hint: `across ${m.officialResults} official attempts` },
        { label: 'Pass rate', value: `${m.passRate}%`, tone: m.passRate >= 60 ? 'success' : 'warning', hint: `${m.passedCount} passed, ${m.failedCount} failed` },
        { label: 'Pending grading', value: m.pendingGrading.toLocaleString(), tone: m.pendingGrading > 0 ? 'warning' : 'default', hint: 'Attempts still owing manual marks' },
        { label: 'Integrity flags (24h)', value: m.violations24h.toLocaleString(), tone: m.violations24h > 0 ? 'danger' : 'default', hint: 'Proctoring violations recorded' },
        { label: 'Time granted (24h)', value: m.timeExtensions24h.toLocaleString(), hint: `${m.totalRegrades} bulk regrades all-time` },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Platform-wide throughput, score distribution, grading pipeline, and integrity signals.
          Every figure is computed server-side from official attempts only, so a candidate who retook
          an exam cannot inflate the counts.
        </p>
      </div>

      <MetricGrid metrics={metrics} loading={isLoading} />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ChartFrame
            title="Activity over the last 14 days"
            description="Sessions started, submissions received, and results produced."
            isLoading={isLoading}
            isEmpty={!hasData(data?.charts.trend?.map((t) => ({ label: t.date, count: t.submissions })))}
            height={320}
          >
            <TrendAreaChart data={data?.charts.trend ?? []} />
          </ChartFrame>
        </div>
        <div className="space-y-4">
          <ChartFrame
            title="Pass / fail split"
            description="Official attempts only."
            isLoading={isLoading}
            isEmpty={!m || m.officialResults === 0}
          >
            <PassFailBar passed={m?.passedCount ?? 0} failed={m?.failedCount ?? 0} />
          </ChartFrame>
          <ChartFrame
            title="Grading pipeline"
            description="Where submitted attempts currently sit."
            isLoading={isLoading}
            isEmpty={!hasData(data?.charts.gradingStatus)}
          >
            <DonutChart data={(data?.charts.gradingStatus ?? []) as unknown as Array<Record<string, unknown>>} />
          </ChartFrame>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartFrame
          title="Score distribution"
          description="Banded so the shape is comparable across exams and terms."
          isLoading={isLoading}
          isEmpty={!hasData(data?.charts.scoreDistribution?.map((b) => ({ label: b.label, count: b.count })))}
        >
          <ScoreBandChart data={data?.charts.scoreDistribution ?? []} />
        </ChartFrame>
        <ChartFrame
          title="Exams by status"
          isLoading={isLoading}
          isEmpty={!hasData(data?.charts.examStatus)}
        >
          <DonutChart data={(data?.charts.examStatus ?? []) as unknown as Array<Record<string, unknown>>} />
        </ChartFrame>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <ChartFrame
          title="Session outcomes"
          isLoading={isLoading}
          isEmpty={!hasData(data?.charts.sessionStatus)}
          height={300}
        >
          <CategoryBarChart
            data={(data?.charts.sessionStatus ?? []) as unknown as Array<Record<string, unknown>>}
            colorBy="index"
          />
        </ChartFrame>
        <ChartFrame
          title="Risk levels"
          description="Sessions classified as high or critical."
          isLoading={isLoading}
          isEmpty={!hasData(data?.charts.riskLevels)}
          height={300}
        >
          <CategoryBarChart
            data={(data?.charts.riskLevels ?? []) as unknown as Array<Record<string, unknown>>}
            colorBy="index"
          />
        </ChartFrame>
        <ChartFrame
          title="Violation types"
          description="What the proctoring engine actually caught."
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

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartFrame
          title="Why attempts ended"
          description="Manual versus every automatic trigger."
          isLoading={isLoading}
          isEmpty={!hasData(data?.charts.submissionReasons)}
          height={300}
        >
          <CategoryBarChart
            data={(data?.charts.submissionReasons ?? []) as unknown as Array<Record<string, unknown>>}
            horizontal
            colorBy="index"
          />
        </ChartFrame>
        <ChartFrame
          title="Question mix"
          description="Objective versus graded-by-hand question types."
          isLoading={isLoading}
          isEmpty={!hasData(data?.charts.questionMix)}
          height={300}
        >
          <CategoryBarChart
            data={(data?.charts.questionMix ?? []) as unknown as Array<Record<string, unknown>>}
            horizontal
            colorBy="index"
          />
        </ChartFrame>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="card-hover xl:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Busiest exams</CardTitle>
            <CardDescription>Attempt volume with the average score achieved.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {isLoading ? (
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
                    <th className="px-4 py-3 text-right text-sm font-medium">Attempts</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Average</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.charts.topExams ?? []).map((row) => (
                    <tr key={row.examId} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="px-4 py-3 text-sm">{row.label}</td>
                      <td className="px-4 py-3 text-right text-sm tabular-nums">{row.attempts}</td>
                      <td
                        className={`px-4 py-3 text-right text-sm tabular-nums font-medium ${
                          row.averagePercentage >= 50 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {row.averagePercentage}%
                      </td>
                    </tr>
                  ))}
                  {(data?.charts.topExams ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        No graded attempts yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card className="card-hover xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">At-risk sessions</CardTitle>
            <CardDescription>Highest risk scores first. Investigate these.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-sm font-medium">Student</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Risk</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.tables.atRiskSessions ?? []).map((row) => (
                    <tr key={row.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium">{row.student}</p>
                        <p className="text-[11px] text-muted-foreground">{row.exam}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill value={row.riskLevel} />
                      </td>
                      <td className="px-4 py-3 text-right text-sm tabular-nums">{row.riskScore}</td>
                    </tr>
                  ))}
                  {(data?.tables.atRiskSessions ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        No sessions flagged. Nothing to investigate.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="card-hover">
        <CardHeader>
          <CardTitle className="text-base">Exam health</CardTitle>
          <CardDescription>
            Every exam you can monitor, newest first. Pending grading is the work still outstanding.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
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
                {(examData?.exams ?? []).map((row) => (
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
                {(examData?.exams ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No exams yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {data ? (
        <p className="text-xs text-muted-foreground">
          Figures generated {new Date(data.generatedAt).toLocaleString()} &middot;{' '}
          {data.scope.officialResultCount} official of {data.scope.resultCount} total attempts &middot;{' '}
          {humanize(data.audience)} scope
        </p>
      ) : null}
    </div>
  );
}