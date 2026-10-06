'use client';

import type { ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { MetricTile, NamedCount, ScoreBand, TrendPoint } from '@/services/analytics.service';

const PALETTE = [
  'hsl(var(--chart-1, 221 83% 53%)))',
  'hsl(var(--chart-2, 262 83% 58%)))',
  'hsl(var(--chart-3, 142 71% 45%)))',
  'hsl(var(--chart-4, 38 92% 50%)))',
  'hsl(var(--chart-5, 340 82% 52%)))',
  'hsl(var(--chart-6, 190 90% 42%)))',
];

const AXIS = { stroke: 'hsl(var(--muted-foreground))', fontSize: 11, tickLine: false, axisLine: false };

const tooltipStyle = {
  background: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '0.75rem',
  boxShadow: 'var(--shadow-card-hover)',
  fontSize: '12px',
  color: 'hsl(var(--popover-foreground))',
};

// recharts 3 types the legend wrapper rather than a `contentStyle` prop.
const legendStyle = { fontSize: '11px', paddingTop: '8px' };

/**
 * recharts hands formatters `ValueType | undefined`. Coercing once here keeps
 * every call site free of non-null assertions without lying about the type.
 */
const num = (value: unknown): number => Number(value ?? 0);

/** Builds a tooltip formatter that appends a share of the total. */
function shareFormatter(value: unknown, total: number): [string, string] {
  const n = num(value);
  const pct = total ? Math.round((n / total) * 1000) / 10 : 0;
  return [`${n.toLocaleString()} (${pct}%)`, 'Attempts'];
}

/** Turns "MULTIPLE_CHOICE" / "AUTO_TIME_EXPIRY" into "Multiple choice" for display. */
export function humanize(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function ChartFrame({
  title,
  description,
  action,
  isLoading,
  isEmpty,
  emptyMessage,
  height = 280,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  height?: number;
  children: ReactNode;
}) {
  return (
    <Card className="card-hover">
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {action}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="w-full" style={{ height }} />
        ) : isEmpty ? (
          <div
            className="flex items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground"
            style={{ height }}
          >
            {emptyMessage ?? 'No data for this period yet.'}
          </div>
        ) : (
          <div style={{ height }}>{children}</div>
        )}
      </CardContent>
    </Card>
  );
}

/** Headline counter. `tone` drives colour only — never used to convey state alone. */
export function MetricTileView({ metric }: { metric: MetricTile }) {
  const tone = {
    default: 'text-foreground',
    success: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-amber-600 dark:text-amber-400',
    danger: 'text-destructive',
  }[metric.tone ?? 'default'];

  return (
    <Card className="card-hover">
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{metric.label}</p>
        <p className={cn('mt-2 text-3xl font-bold tracking-tight tabular-nums', tone)}>{metric.value}</p>
        {metric.hint ? <p className="mt-1 text-xs text-muted-foreground">{metric.hint}</p> : null}
        {metric.spark && metric.spark.length > 1 ? (
          <div className="mt-3 h-10">
            <ResponsiveContainer width="100%" height={40}>
              <AreaChart data={metric.spark}>
                <defs>
                  <linearGradient id={`spark-${metric.label.replace(/\W/g, '')}`} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  strokeWidth={1.5}
                  fill={`url(#spark-${metric.label.replace(/\W/g, '')})`}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function MetricGrid({ metrics, loading }: { metrics: MetricTile[]; loading?: boolean }) {
  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="space-y-3 p-5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <MetricTileView key={metric.label} metric={metric} />
      ))}
    </div>
  );
}

export function TrendAreaChart({ data }: { data: TrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="trend-submissions" x1="0" x2="0" y1="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.35} />
            <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="trend-sessions" x1="0" x2="0" y1="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="date" {...AXIS} tickFormatter={(v: string) => v.slice(5)} />
        <YAxis {...AXIS} width={30} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => `Week of ${v}`} />
        <Legend wrapperStyle={legendStyle} />
        <Area type="monotone" dataKey="sessionsStarted" name="Sessions started" stroke="hsl(var(--chart-3))" strokeWidth={2} fill="url(#trend-sessions)" />
        <Area type="monotone" dataKey="submissions" name="Submissions" stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#trend-submissions)" />
        <Area type="monotone" dataKey="resultsPublished" name="Results" stroke="hsl(var(--chart-2))" strokeWidth={2} fill="none" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({
  data,
  nameKey = 'label',
  valueKey = 'count',
  legend = true,
}: {
  data: Array<Record<string, unknown>>;
  nameKey?: string;
  valueKey?: string;
  legend?: boolean;
}) {
  const total = data.reduce((sum, row) => sum + Number(row[valueKey] ?? 0), 0);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value, name) => shareFormatter(value, total).map(String) as unknown as [string, string]}
        />
        {legend ? <Legend wrapperStyle={legendStyle} /> : null}
        <Pie
          data={data}
          dataKey={valueKey}
          nameKey={nameKey}
          innerRadius="55%"
          outerRadius="82%"
          paddingAngle={2}
          stroke="hsl(var(--card))"
          strokeWidth={2}
        >
          {data.map((entry, index) => (
            <Cell key={String(entry[nameKey])} fill={PALETTE[index % PALETTE.length]} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

export function CategoryBarChart({
  data,
  valueKey = 'count',
  horizontal = false,
  colorBy = 'series',
}: {
  data: Array<Record<string, unknown>>;
  valueKey?: string;
  horizontal?: boolean;
  colorBy?: 'series' | 'index';
}) {
  const nameKey = horizontal ? 'label' : 'label';
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        layout={horizontal ? 'vertical' : 'horizontal'}
        margin={{ top: 8, right: 12, left: horizontal ? 8 : -18, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={horizontal} horizontal={!horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" {...AXIS} allowDecimals={false} />
            <YAxis type="category" dataKey={nameKey} {...AXIS} width={110} tickFormatter={(v: string) => humanize(v)} />
          </>
        ) : (
          <>
            <XAxis dataKey={nameKey} {...AXIS} interval={0} tickFormatter={(v: string) => humanize(v)} />
            <YAxis {...AXIS} width={30} allowDecimals={false} />
          </>
        )}
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value, name) => [num(value).toLocaleString(), humanize(String(name))]}
          labelFormatter={(v) => humanize(String(v))}
        />
        <Bar dataKey={valueKey} radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {data.map((entry, index) => (
            <Cell
              key={String(entry[nameKey])}
              fill={
                colorBy === 'index'
                  ? PALETTE[index % PALETTE.length]
                  : 'hsl(var(--chart-1))'
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ScoreBandChart({ data }: { data: ScoreBand[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="label" {...AXIS} />
        <YAxis {...AXIS} width={30} allowDecimals={false} />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: 'hsl(var(--muted) / 0.5)' }}
          formatter={(value, _name, item) => {
            // recharts 3 passes the whole payload array as the third argument;
            // the band's own share is already computed server-side, so it is
            // read from the row rather than recomputed here.
            const payload = (item as { payload?: ScoreBand } | undefined)?.payload;
            const share = payload?.share ?? 0;
            return [`${num(value)} attempts (${share}%)`, 'Attempts'];
          }}
          labelFormatter={(v) => `Score ${v}%`}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {data.map((entry) => (
            <Cell
              key={entry.label}
              fill={entry.passed ? 'hsl(var(--chart-3))' : 'hsl(var(--chart-4))'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Pass/fail split as a single stacked bar — reads faster than a donut at 2 values. */
export function PassFailBar({ passed, failed }: { passed: number; failed: number }) {
  const data = [
    { name: 'Passed', value: passed, fill: 'hsl(var(--chart-3))' },
    { name: 'Failed', value: failed, fill: 'hsl(var(--chart-4))' },
  ];
  const total = passed + failed;
  return (
    <div>
      <ResponsiveContainer width="100%" height={56}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }} barCategoryGap={0}>
          <XAxis type="number" hide domain={[0, Math.max(total, 1)]} />
          <YAxis type="category" dataKey="name" hide />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, name) => shareFormatter(value, total).map(String) as unknown as [string, string]}
          />
          <Bar dataKey="value" stackId="a" isAnimationActive={false}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>{passed} passed</span>
        <span>{failed} failed</span>
      </div>
    </div>
  );
}

export function RadarPanel({
  data,
  subjectKey = 'label',
  valueKey = 'count',
  max,
}: {
  data: Array<Record<string, unknown>>;
  subjectKey?: string;
  valueKey?: string;
  max?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="hsl(var(--border))" />
        <PolarAngleAxis dataKey={subjectKey} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Radar
          dataKey={valueKey}
          stroke="hsl(var(--chart-1))"
          fill="hsl(var(--chart-1))"
          fillOpacity={0.35}
        />
        {max ? <YAxis domain={[0, max]} hide /> : null}
      </RadarChart>
    </ResponsiveContainer>
  );
}

export function MultiLineChart({
  data,
  series,
  xKey = 'date',
  yDomain,
  suffix = '',
}: {
  data: Array<Record<string, unknown>>;
  series: Array<{ key: string; label: string }>;
  xKey?: string;
  yDomain?: [number, number];
  suffix?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey={xKey} {...AXIS} />
        <YAxis {...AXIS} width={30} domain={yDomain} tickFormatter={(v) => `${num(v)}${suffix}`} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={legendStyle} />
        {series.map((s, index) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={PALETTE[index % PALETTE.length]}
            strokeWidth={2}
            dot={{ r: 2.5 }}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function StatusPill({ value }: { value: string }) {
  const tone: Record<string, string> = {
    PASS: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    PUBLISHED: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    GRADED: 'border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400',
    PENDING: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
    LIVE: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    IN_PROGRESS: 'border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400',
    HIGH: 'border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400',
    CRITICAL: 'border-destructive/30 bg-destructive/10 text-destructive',
    MEDIUM: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
    LOW: 'border-muted-foreground/30 bg-muted text-muted-foreground',
    DRAFT: 'border-muted-foreground/30 bg-muted text-muted-foreground',
    SCHEDULED: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    CLOSED: 'border-muted-foreground/30 bg-muted text-muted-foreground',
    ARCHIVED: 'border-muted-foreground/30 bg-muted text-muted-foreground',
  };
  return (
    <Badge variant="outline" className={cn('font-medium', tone[value] ?? '')}>
      {humanize(value)}
    </Badge>
  );
}

export function hasData(data: NamedCount[] | undefined | null): boolean {
  return Boolean(data?.some((row) => row.count > 0));
}