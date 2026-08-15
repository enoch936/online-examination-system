import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type ModulePageProps = {
  title: string;
  description: string;
  role: 'Student' | 'Instructor' | 'Admin';
  metrics?: Array<{ label: string; value: string; tone?: 'default' | 'success' | 'warning' }>;
  children?: React.ReactNode;
};

const metricTone: Record<string, string> = {
  default: 'text-foreground',
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
};

const roleTone: Record<string, string> = {
  Student: 'border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400',
  Instructor: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  Admin: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
};

export function ModulePage({ title, description, role, metrics, children }: ModulePageProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge variant="outline" className={cn('w-fit', roleTone[role])}>{role}</Badge>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>
      {metrics && metrics.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          {metrics.map((metric) => (
            <Card key={metric.label} className="card-hover">
              <CardHeader className="pb-2">
                <CardDescription>{metric.label}</CardDescription>
                <CardTitle className={cn('text-3xl', metricTone[metric.tone ?? 'default'])}>{metric.value}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
      {children ?? (
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>This section is under development.</CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
