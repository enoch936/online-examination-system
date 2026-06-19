import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type ModulePageProps = {
  title: string;
  description: string;
  role: 'Student' | 'Instructor' | 'Admin';
  metrics?: Array<{ label: string; value: string; tone?: 'default' | 'success' | 'warning' }>;
  children?: React.ReactNode;
};

export function ModulePage({ title, description, role, metrics, children }: ModulePageProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge variant="outline">{role}</Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>
      {metrics && metrics.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          {metrics.map((metric) => (
            <Card key={metric.label}>
              <CardHeader>
                <CardDescription>{metric.label}</CardDescription>
                <CardTitle className="text-3xl">{metric.value}</CardTitle>
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
