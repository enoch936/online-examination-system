'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { examsService } from '@/services/exams.service';
import { reportsService } from '@/services/reports.service';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, FileSpreadsheet, Download, BarChart3, ClipboardList, Users, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ExamReport {
  exam: {
    id: string;
    title: string;
    totalMarks: number;
    passingMarks: number;
  };
  summary: {
    totalSessions: number;
    totalSubmissions: number;
    averageScore: number;
    passRate: number;
    highestScore: number;
    lowestScore: number;
  };
}

function SkeletonReport() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96 mt-2" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="h-10 w-72" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-5 space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function InstructorReportsPage() {
  const [selectedExamId, setSelectedExamId] = useState('');

  const { data: exams, isLoading: examsLoading } = useQuery({
    queryKey: ['exams'],
    queryFn: () => examsService.list(),
  });

  const { data: report, isLoading: reportLoading, error: reportError } = useQuery({
    queryKey: ['exam-report', selectedExamId],
    queryFn: async () => {
      const res = await reportsService.getExamReport(selectedExamId);
      return (res as { success: boolean; data: ExamReport }).data;
    },
    enabled: !!selectedExamId,
  });

  const handleDownloadPdf = async () => {
    try {
      const blob = await reportsService.downloadPdf(selectedExamId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `exam-report-${selectedExamId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('PDF report downloaded');
    } catch {
      toast.error('Failed to download PDF report');
    }
  };

  const handleDownloadExcel = async () => {
    try {
      const blob = await reportsService.downloadExcel(selectedExamId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `exam-report-${selectedExamId}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Excel report downloaded');
    } catch {
      toast.error('Failed to download Excel report');
    }
  };

  if (examsLoading) return <SkeletonReport />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-sm text-muted-foreground">
            Generate PDF and Excel reports for exams, subjects, students, and cohorts.
          </p>
        </div>
        <Badge variant="secondary">Instructor</Badge>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Select exam</label>
        <select
          className="h-10 w-full max-w-sm rounded-md border bg-background px-3 text-sm"
          value={selectedExamId}
          onChange={(e) => setSelectedExamId(e.target.value)}
        >
          <option value="">Choose an exam to view report</option>
          {exams?.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </select>
      </div>

      {!selectedExamId && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <BarChart3 className="h-12 w-12 text-muted-foreground mb-3" />
          <p className="text-lg font-medium">Select an exam</p>
          <p className="text-sm text-muted-foreground mt-1">
            Choose an exam from the dropdown above to view its report.
          </p>
        </div>
      )}

      {reportLoading && selectedExamId && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-2 p-5">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {reportError && selectedExamId && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/50 bg-destructive/5 py-12 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mb-3" />
          <p className="text-lg font-medium text-destructive">Failed to load report</p>
          <p className="text-sm text-muted-foreground mt-1">Please try again later.</p>
        </div>
      )}

      {report && !reportLoading && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  Total sessions
                </div>
                <p className="mt-1 text-2xl font-bold">{report.summary.totalSessions}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ClipboardList className="h-4 w-4" />
                  Submissions
                </div>
                <p className="mt-1 text-2xl font-bold">{report.summary.totalSubmissions}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <BarChart3 className="h-4 w-4" />
                  Average score
                </div>
                <p className="mt-1 text-2xl font-bold">
                  {report.summary.averageScore.toFixed(1)}
                  <span className="text-sm font-normal text-muted-foreground">
                    {' '}/ {report.exam.totalMarks}
                  </span>
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4" />
                  Pass rate
                </div>
                <p className="mt-1 text-2xl font-bold">
                  {(report.summary.passRate * 100).toFixed(1)}%
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <BarChart3 className="h-4 w-4" />
                  Highest score
                </div>
                <p className="mt-1 text-2xl font-bold text-emerald-600">{report.summary.highestScore}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <BarChart3 className="h-4 w-4" />
                  Lowest score
                </div>
                <p className="mt-1 text-2xl font-bold text-red-600">{report.summary.lowestScore}</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleDownloadPdf}>
              <Download className="mr-2 h-4 w-4" />
              <FileText className="mr-1 h-4 w-4" />
              Download PDF
            </Button>
            <Button variant="outline" onClick={handleDownloadExcel}>
              <Download className="mr-2 h-4 w-4" />
              <FileSpreadsheet className="mr-1 h-4 w-4" />
              Download Excel
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
