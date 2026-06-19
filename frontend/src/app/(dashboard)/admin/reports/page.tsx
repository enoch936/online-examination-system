'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Download, FileSpreadsheet, Loader2, BarChart3, Calendar } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { examsService } from '@/services/exams.service';
import { reportsService } from '@/services/reports.service';
import { dashboardService } from '@/services/dashboard.service';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminReportsPage() {
  const [selectedExamId, setSelectedExamId] = useState('');
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);

  const { data: exams } = useQuery({
    queryKey: ['admin', 'exams'],
    queryFn: () => examsService.list(),
  });

  const { data: examReport, isLoading: reportLoading } = useQuery({
    queryKey: ['admin', 'report', selectedExamId],
    queryFn: () => reportsService.getExamReport(selectedExamId),
    enabled: !!selectedExamId,
  });

  const { data: stats } = useQuery({
    queryKey: ['admin', 'dashboard-stats'],
    queryFn: dashboardService.getStats,
  });

  const handleDownloadPdf = async () => {
    if (!selectedExamId) {
      toast.error('Select an exam first');
      return;
    }
    setDownloadingPdf(true);
    try {
      const blob = await reportsService.downloadPdf(selectedExamId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `exam-report-${selectedExamId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('PDF downloaded');
    } catch {
      toast.error('Failed to download PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadExcel = async () => {
    if (!selectedExamId) {
      toast.error('Select an exam first');
      return;
    }
    setDownloadingExcel(true);
    try {
      const blob = await reportsService.downloadExcel(selectedExamId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `exam-report-${selectedExamId}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Excel downloaded');
    } catch {
      toast.error('Failed to download Excel');
    } finally {
      setDownloadingExcel(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Badge variant="outline">Admin</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal">Reports</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Institutional reports for performance and compliance.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" /> Exam report
            </CardTitle>
            <CardDescription>Select an exam to view its report and download options.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium text-muted-foreground">Select exam</label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                >
                  <option value="">— Choose an exam —</option>
                  {exams?.map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {exam.title} ({exam.status})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={!selectedExamId || downloadingPdf}
                  onClick={handleDownloadPdf}
                >
                  {downloadingPdf ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-1 h-4 w-4" />
                  )}
                  PDF
                </Button>
                <Button
                  variant="outline"
                  disabled={!selectedExamId || downloadingExcel}
                  onClick={handleDownloadExcel}
                >
                  {downloadingExcel ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="mr-1 h-4 w-4" />
                  )}
                  Excel
                </Button>
              </div>
            </div>

            {selectedExamId && reportLoading && (
              <div className="mt-4 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-40" />
              </div>
            )}

            {selectedExamId && examReport && !reportLoading && (
              <div className="mt-4 space-y-2 rounded-lg bg-muted/50 p-4">
                {Object.entries(examReport as Record<string, unknown>).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="capitalize text-muted-foreground">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <span className="font-medium">{String(value)}</span>
                  </div>
                ))}
              </div>
            )}

            {selectedExamId && !reportLoading && !examReport && (
              <p className="mt-4 text-sm text-muted-foreground">No report data available for this exam.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Platform summary
            </CardTitle>
            <CardDescription>High-level platform metrics.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats?.metrics?.slice(0, 4).map((m) => (
              <div key={m.key} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{m.label}</span>
                <Badge variant="secondary" className="text-base">{m.value}</Badge>
              </div>
            )) || (
              <>
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </>
            )}
            <Separator />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Violations (24h)</span>
              <Badge variant="warning">{stats?.violations24h ?? 0}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {stats?.chartData && stats.chartData.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Submissions over time
            </CardTitle>
            <CardDescription>All submissions across the platform.</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.chartData}>
                <defs>
                  <linearGradient id="reportSubmissions" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip />
                <Area type="monotone" dataKey="submissions" stroke="hsl(var(--primary))" fill="url(#reportSubmissions)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Submissions over time</CardTitle>
            <CardDescription>No submission data available.</CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
