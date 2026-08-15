'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { examsService } from '@/services/exams.service';
import { reportsService } from '@/services/reports.service';
import { usersService } from '@/services/users.service';
import { subjectsService } from '@/services/subjects.service';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, FileSpreadsheet, Download, BarChart3, ClipboardList, Users, CheckCircle, AlertCircle, BookOpen, GraduationCap, LayoutDashboard } from 'lucide-react';
import { toast } from 'sonner';

type Tab = 'exam' | 'student' | 'subject' | 'overview';

const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'exam', label: 'Exam Report', icon: <ClipboardList className="h-4 w-4" /> },
  { key: 'student', label: 'Student Report', icon: <GraduationCap className="h-4 w-4" /> },
  { key: 'subject', label: 'Subject Report', icon: <BookOpen className="h-4 w-4" /> },
  { key: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
];

function SkeletonGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="space-y-2 p-5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function InstructorReportsPage() {
  const [tab, setTab] = useState<Tab>('exam');
  const [selectedExamId, setSelectedExamId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');

  const { data: exams } = useQuery({
    queryKey: ['exams'],
    queryFn: () => examsService.list(),
  });

  const { data: students } = useQuery({
    queryKey: ['users', 'STUDENT'],
    queryFn: () => usersService.list('STUDENT'),
  });

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectsService.list(),
  });

  const { data: examReport, isLoading: examLoading, error: examError } = useQuery({
    queryKey: ['exam-report', selectedExamId],
    queryFn: async () => {
      const res = await reportsService.getExamReport(selectedExamId);
      return (res as { success: boolean; data: unknown }).data;
    },
    enabled: tab === 'exam' && !!selectedExamId,
  });

  const { data: studentReport, isLoading: studentLoading, error: studentError } = useQuery({
    queryKey: ['student-report', selectedStudentId],
    queryFn: async () => {
      const res = await reportsService.getStudentReport(selectedStudentId);
      return (res as { success: boolean; data: unknown }).data;
    },
    enabled: tab === 'student' && !!selectedStudentId,
  });

  const { data: subjectReport, isLoading: subjectLoading, error: subjectError } = useQuery({
    queryKey: ['subject-report', selectedSubjectId],
    queryFn: async () => {
      const res = await reportsService.getSubjectReport(selectedSubjectId);
      return (res as { success: boolean; data: unknown }).data;
    },
    enabled: tab === 'subject' && !!selectedSubjectId,
  });

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['overview-report'],
    queryFn: async () => {
      const res = await reportsService.getOverview();
      return (res as { success: boolean; data: unknown }).data;
    },
    enabled: tab === 'overview',
  });

  const downloadBlob = async (fn: () => Promise<Blob>, filename: string) => {
    try {
      const blob = await fn();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success(`${filename} downloaded`);
    } catch {
      toast.error(`Failed to download ${filename}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports & Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Generate PDF and Excel reports for exams, students, subjects, and overall statistics.
          </p>
        </div>
        <Badge variant="secondary">Instructor</Badge>
      </div>

      <div className="flex gap-1 rounded-lg border bg-muted p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* EXAM TAB */}
      {tab === 'exam' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select exam</label>
            <select
              className="h-10 w-full max-w-sm rounded-md border bg-background px-3 text-sm"
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
            >
              <option value="">Choose an exam</option>
              {exams?.map((e: { id: string; title: string }) => (
                <option key={e.id} value={e.id}>{e.title}</option>
              ))}
            </select>
          </div>
          {!selectedExamId && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-lg font-medium">Select an exam</p>
              <p className="text-sm text-muted-foreground mt-1">Choose an exam to view its report.</p>
            </div>
          )}
          {examLoading && <SkeletonGrid />}
          {examError && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/50 bg-destructive/5 py-12 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mb-3" />
              <p className="text-lg font-medium text-destructive">Failed to load report</p>
            </div>
          )}
          {examReport && !examLoading ? <ExamReportView data={examReport as ExamReport} onPdf={() => downloadBlob(() => reportsService.downloadExamPdf(selectedExamId), `exam-${selectedExamId}.pdf`)} onExcel={() => downloadBlob(() => reportsService.downloadExamExcel(selectedExamId), `exam-${selectedExamId}.xlsx`)} /> : null}
        </div>
      )}

      {/* STUDENT TAB */}
      {tab === 'student' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select student</label>
            <select
              className="h-10 w-full max-w-sm rounded-md border bg-background px-3 text-sm"
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
            >
              <option value="">Choose a student</option>
              {students?.map((s: { id: string; firstName: string; lastName: string; email: string }) => (
                <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.email})</option>
              ))}
            </select>
          </div>
          {!selectedStudentId && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
              <GraduationCap className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-lg font-medium">Select a student</p>
              <p className="text-sm text-muted-foreground mt-1">Choose a student to view their performance report.</p>
            </div>
          )}
          {studentLoading && <SkeletonGrid />}
          {studentError && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/50 bg-destructive/5 py-12 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mb-3" />
              <p className="text-lg font-medium text-destructive">Failed to load student report</p>
            </div>
          )}
          {studentReport && !studentLoading ? <StudentReportView data={studentReport as StudentReport} onPdf={() => downloadBlob(() => reportsService.downloadStudentPdf(selectedStudentId), `student-${selectedStudentId}.pdf`)} onExcel={() => downloadBlob(() => reportsService.downloadStudentExcel(selectedStudentId), `student-${selectedStudentId}.xlsx`)} /> : null}
        </div>
      )}

      {/* SUBJECT TAB */}
      {tab === 'subject' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select subject</label>
            <select
              className="h-10 w-full max-w-sm rounded-md border bg-background px-3 text-sm"
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
            >
              <option value="">Choose a subject</option>
              {subjects?.map((s: { id: string; name: string }) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          {!selectedSubjectId && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-lg font-medium">Select a subject</p>
              <p className="text-sm text-muted-foreground mt-1">Choose a subject to view its performance report.</p>
            </div>
          )}
          {subjectLoading && <SkeletonGrid />}
          {subjectError && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/50 bg-destructive/5 py-12 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mb-3" />
              <p className="text-lg font-medium text-destructive">Failed to load subject report</p>
            </div>
          )}
          {subjectReport && !subjectLoading ? <SubjectReportView data={subjectReport as SubjectReport} onPdf={() => downloadBlob(() => reportsService.downloadSubjectPdf(selectedSubjectId), `subject-${selectedSubjectId}.pdf`)} onExcel={() => downloadBlob(() => reportsService.downloadSubjectExcel(selectedSubjectId), `subject-${selectedSubjectId}.xlsx`)} /> : null}
        </div>
      )}

      {/* OVERVIEW TAB */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {overviewLoading && <SkeletonGrid count={6} />}
          {overview && !overviewLoading ? <OverviewReportView data={overview as OverviewReport} onPdf={() => downloadBlob(() => reportsService.downloadOverviewPdf(), 'overview.pdf')} onExcel={() => downloadBlob(() => reportsService.downloadOverviewExcel(), 'overview.xlsx')} /> : null}
        </div>
      )}
    </div>
  );
}

/* ─── Exam Report ─── */
interface ExamReport {
  exam: { id: string; title: string; totalMarks: number; passingMarks: number };
  summary: { totalSessions: number; totalSubmissions: number; averageScore: number; averagePercentage: number; passRate: number; highestScore: number; lowestScore: number };
  results: Array<{ id: string; student: { firstName: string; lastName: string } | null; score: number; percentage: number; grade: string | null; passed: boolean; publishedAt: string | null }>;
}

function ExamReportView({ data, onPdf, onExcel }: { data: ExamReport; onPdf: () => void; onExcel: () => void }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="p-5"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="h-4 w-4" />Sessions</div><p className="mt-1 text-2xl font-bold">{data.summary.totalSessions}</p></CardContent></Card>
        <Card><CardContent className="p-5"><div className="flex items-center gap-2 text-sm text-muted-foreground"><ClipboardList className="h-4 w-4" />Submissions</div><p className="mt-1 text-2xl font-bold">{data.summary.totalSubmissions}</p></CardContent></Card>
        <Card><CardContent className="p-5"><div className="flex items-center gap-2 text-sm text-muted-foreground"><BarChart3 className="h-4 w-4" />Avg score</div><p className="mt-1 text-2xl font-bold">{data.summary.averagePercentage.toFixed(1)}<span className="text-sm font-normal text-muted-foreground">%</span></p></CardContent></Card>
        <Card><CardContent className="p-5"><div className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle className="h-4 w-4" />Pass rate</div><p className="mt-1 text-2xl font-bold">{(data.summary.passRate * 100).toFixed(1)}%</p></CardContent></Card>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card><CardContent className="p-5"><div className="flex items-center gap-2 text-sm text-muted-foreground"><BarChart3 className="h-4 w-4" />Highest score</div><p className="mt-1 text-2xl font-bold text-emerald-600">{data.summary.highestScore} / {data.exam.totalMarks}</p></CardContent></Card>
        <Card><CardContent className="p-5"><div className="flex items-center gap-2 text-sm text-muted-foreground"><BarChart3 className="h-4 w-4" />Lowest score</div><p className="mt-1 text-2xl font-bold text-red-600">{data.summary.lowestScore} / {data.exam.totalMarks}</p></CardContent></Card>
      </div>
      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold mb-3">Student Results</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {data.results.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span>{r.student ? `${r.student.firstName} ${r.student.lastName}` : 'Unknown'}</span>
                <span className={r.passed ? 'text-emerald-600 font-medium' : 'text-red-600 font-medium'}>
                  {r.score}/{data.exam.totalMarks} ({r.percentage}%) {r.passed ? 'Pass' : 'Fail'}
                </span>
              </div>
            ))}
            {data.results.length === 0 && <p className="text-muted-foreground text-sm">No results yet.</p>}
          </div>
        </CardContent>
      </Card>
      <div className="flex gap-3">
        <Button onClick={onPdf}><Download className="mr-2 h-4 w-4" /><FileText className="mr-1 h-4 w-4" />Download PDF</Button>
        <Button variant="outline" onClick={onExcel}><Download className="mr-2 h-4 w-4" /><FileSpreadsheet className="mr-1 h-4 w-4" />Download Excel</Button>
      </div>
    </div>
  );
}

/* ─── Student Report ─── */
interface StudentReport {
  student: { id: string; firstName: string; lastName: string; email: string };
  summary: { totalExams: number; passedExams: number; failedExams: number; passRate: number; totalScore: number; maxScore: number; averagePercentage: number };
  subjects: Array<{ name: string; exams: number; totalScore: number; maxScore: number; passed: number }>;
  results: Array<{ id: string; examTitle: string; subject: string; score: number; maxScore: number; percentage: number; grade: string | null; passed: boolean; publishedAt: string | null }>;
}

function StudentReportView({ data, onPdf, onExcel }: { data: StudentReport; onPdf: () => void; onExcel: () => void }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5">
          <h3 className="font-semibold">{data.student.firstName} {data.student.lastName}</h3>
          <p className="text-sm text-muted-foreground">{data.student.email}</p>
        </CardContent>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="p-5"><div className="flex items-center gap-2 text-sm text-muted-foreground"><ClipboardList className="h-4 w-4" />Exams taken</div><p className="mt-1 text-2xl font-bold">{data.summary.totalExams}</p></CardContent></Card>
        <Card><CardContent className="p-5"><div className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle className="h-4 w-4" />Passed</div><p className="mt-1 text-2xl font-bold text-emerald-600">{data.summary.passedExams}</p></CardContent></Card>
        <Card><CardContent className="p-5"><div className="flex items-center gap-2 text-sm text-muted-foreground"><AlertCircle className="h-4 w-4" />Failed</div><p className="mt-1 text-2xl font-bold text-red-600">{data.summary.failedExams}</p></CardContent></Card>
        <Card><CardContent className="p-5"><div className="flex items-center gap-2 text-sm text-muted-foreground"><BarChart3 className="h-4 w-4" />Avg percentage</div><p className="mt-1 text-2xl font-bold">{data.summary.averagePercentage}%</p></CardContent></Card>
      </div>
      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold mb-3">Subject Breakdown</h3>
          <div className="space-y-2">
            {data.subjects.map((s) => (
              <div key={s.name} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span>{s.name}</span>
                <span className="text-muted-foreground">{s.passed}/{s.exams} passed, {s.maxScore ? Number((s.totalScore / s.maxScore * 100).toFixed(1)) : 0}% avg</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold mb-3">Exam History</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {data.results.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <div><span className="font-medium">{r.examTitle}</span><span className="text-muted-foreground ml-2">({r.subject})</span></div>
                <span className={r.passed ? 'text-emerald-600 font-medium' : 'text-red-600 font-medium'}>
                  {r.score}/{r.maxScore} ({r.percentage}%) {r.passed ? 'Pass' : 'Fail'}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="flex gap-3">
        <Button onClick={onPdf}><Download className="mr-2 h-4 w-4" /><FileText className="mr-1 h-4 w-4" />Download PDF</Button>
        <Button variant="outline" onClick={onExcel}><Download className="mr-2 h-4 w-4" /><FileSpreadsheet className="mr-1 h-4 w-4" />Download Excel</Button>
      </div>
    </div>
  );
}

/* ─── Subject Report ─── */
interface SubjectReport {
  subject: { id: string; name: string };
  summary: { totalExams: number; totalResults: number; totalPassed: number; passRate: number };
  exams: Array<{ examId: string; examTitle: string; courseName: string; totalStudents: number; passed: number; failed: number; passRate: number; averagePercentage: number }>;
}

function SubjectReportView({ data, onPdf, onExcel }: { data: SubjectReport; onPdf: () => void; onExcel: () => void }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5">
          <h3 className="font-semibold">{data.subject.name}</h3>
        </CardContent>
      </Card>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-5"><div className="flex items-center gap-2 text-sm text-muted-foreground"><ClipboardList className="h-4 w-4" />Exams</div><p className="mt-1 text-2xl font-bold">{data.summary.totalExams}</p></CardContent></Card>
        <Card><CardContent className="p-5"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="h-4 w-4" />Results</div><p className="mt-1 text-2xl font-bold">{data.summary.totalResults}</p></CardContent></Card>
        <Card><CardContent className="p-5"><div className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle className="h-4 w-4" />Pass rate</div><p className="mt-1 text-2xl font-bold">{(data.summary.passRate * 100).toFixed(1)}%</p></CardContent></Card>
      </div>
      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold mb-3">Exams in Subject</h3>
          <div className="space-y-2">
            {data.exams.map((e) => (
              <div key={e.examId} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <div><span className="font-medium">{e.examTitle}</span><span className="text-muted-foreground ml-2">({e.courseName})</span></div>
                <span className="text-muted-foreground">{e.passed}/{e.totalStudents} passed, {e.averagePercentage}% avg</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="flex gap-3">
        <Button onClick={onPdf}><Download className="mr-2 h-4 w-4" /><FileText className="mr-1 h-4 w-4" />Download PDF</Button>
        <Button variant="outline" onClick={onExcel}><Download className="mr-2 h-4 w-4" /><FileSpreadsheet className="mr-1 h-4 w-4" />Download Excel</Button>
      </div>
    </div>
  );
}

/* ─── Overview Report ─── */
interface OverviewReport {
  summary: { totalExams: number; totalStudents: number; totalInstructors: number; totalSubmissions: number; averagePercentage: number; totalResults: number };
  subjectPerformance: Array<{ subject: string; totalExams: number; totalResults: number; passRate: number; averagePercentage: number }>;
  recentResults: Array<{ id: string; examTitle: string; studentName: string; score: number; maxScore: number; percentage: number; passed: boolean; createdAt: string }>;
}

function OverviewReportView({ data, onPdf, onExcel }: { data: OverviewReport; onPdf: () => void; onExcel: () => void }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5">
          <h3 className="font-semibold">Overall Platform Statistics</h3>
          <p className="text-sm text-muted-foreground">Aggregate metrics across all exams, students, and subjects.</p>
        </CardContent>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card><CardContent className="p-5"><div className="flex items-center gap-2 text-sm text-muted-foreground"><ClipboardList className="h-4 w-4" />Total exams</div><p className="mt-1 text-2xl font-bold">{data.summary.totalExams}</p></CardContent></Card>
        <Card><CardContent className="p-5"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="h-4 w-4" />Students</div><p className="mt-1 text-2xl font-bold">{data.summary.totalStudents}</p></CardContent></Card>
        <Card><CardContent className="p-5"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="h-4 w-4" />Instructors</div><p className="mt-1 text-2xl font-bold">{data.summary.totalInstructors}</p></CardContent></Card>
        <Card><CardContent className="p-5"><div className="flex items-center gap-2 text-sm text-muted-foreground"><ClipboardList className="h-4 w-4" />Submissions</div><p className="mt-1 text-2xl font-bold">{data.summary.totalSubmissions}</p></CardContent></Card>
        <Card><CardContent className="p-5"><div className="flex items-center gap-2 text-sm text-muted-foreground"><BarChart3 className="h-4 w-4" />Avg percentage</div><p className="mt-1 text-2xl font-bold">{data.summary.averagePercentage}%</p></CardContent></Card>
        <Card><CardContent className="p-5"><div className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle className="h-4 w-4" />Total results</div><p className="mt-1 text-2xl font-bold">{data.summary.totalResults}</p></CardContent></Card>
      </div>
      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold mb-3">Subject Performance</h3>
          <div className="space-y-2">
            {data.subjectPerformance.map((s) => (
              <div key={s.subject} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span className="font-medium">{s.subject}</span>
                <span className="text-muted-foreground">{s.totalResults} results, {(s.passRate * 100).toFixed(1)}% pass rate, {s.averagePercentage}% avg</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold mb-3">Recent Results</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {data.recentResults.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <div><span className="font-medium">{r.studentName}</span><span className="text-muted-foreground ml-2">{r.examTitle}</span></div>
                <span className={r.passed ? 'text-emerald-600 font-medium' : 'text-red-600 font-medium'}>
                  {r.score}/{r.maxScore} ({r.percentage}%) {r.passed ? 'Pass' : 'Fail'}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="flex gap-3">
        <Button onClick={onPdf}><Download className="mr-2 h-4 w-4" /><FileText className="mr-1 h-4 w-4" />Download PDF</Button>
        <Button variant="outline" onClick={onExcel}><Download className="mr-2 h-4 w-4" /><FileSpreadsheet className="mr-1 h-4 w-4" />Download Excel</Button>
      </div>
    </div>
  );
}
