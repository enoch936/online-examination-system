'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  FolderOpen,
  Gauge,
  HelpCircle,
  ListChecks,
  Loader2,
  Target,
  Users,
} from 'lucide-react';
import { examsService } from '@/services/exams.service';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { ExamQuestion, ExamSummary } from '@/types/api';

const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'secondary' | 'outline'> = {
  DRAFT: 'default',
  SCHEDULED: 'secondary',
  PUBLISHED: 'success',
  LIVE: 'warning',
  CLOSED: 'outline',
  IN_PROGRESS: 'warning',
  COMPLETED: 'secondary',
  ARCHIVED: 'outline',
};

function examCoursesLabel(exam: ExamSummary): string {
  const names = exam.courses?.map((ec) => ec.course.name).filter(Boolean) ?? [];
  return names.length > 0 ? names.join(', ') : (exam.course?.name ?? 'No course');
}

function examBanksLabel(exam: ExamSummary): string {
  const names = exam.questionBanks?.map((qb) => qb.questionBank.name).filter(Boolean) ?? [];
  return names.join(', ');
}

function InfoItem({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function QuestionCard({ index, item }: { index: number; item: ExamQuestion }) {
  const q = item.question;
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{index + 1}</span>
            <div>
              <p className="font-medium leading-snug">{q.prompt}</p>
              {q.topic && <p className="mt-1 text-xs text-muted-foreground">Topic: {q.topic}</p>}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge variant="secondary">{q.type.replace(/_/g, ' ')}</Badge>
            <span className="text-xs text-muted-foreground">{q.points} pts{q.negativePoints > 0 ? ` / -${q.negativePoints}` : ''}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {q.options?.map((opt) => (
          <div
            key={opt.id}
            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${opt.isCorrect ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : ''}`}
          >
            {opt.isCorrect ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />}
            <span>{opt.label}. {opt.text}</span>
            {opt.isCorrect && <span className="ml-auto text-xs font-medium">Correct</span>}
          </div>
        ))}
        {q.explanation && (
          <p className="pt-1 text-xs text-muted-foreground">
            <span className="font-medium">Explanation:</span> {q.explanation}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function InstructorExamDetailPage() {
  const params = useParams<{ examId: string }>();
  const examId = params.examId;

  const { data: exam, isLoading, error } = useQuery({
    queryKey: ['exams', examId],
    queryFn: () => examsService.get(examId),
    enabled: !!examId,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (error || !exam) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm"><Link href="/instructor/exams/manage"><ArrowLeft className="mr-1 h-4 w-4" />Back to manage exams</Link></Button>
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Failed to load exam</CardTitle>
            <CardDescription>{(error as Error)?.message ?? 'Exam not found'}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const questions = exam.questions ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="sm"><Link href="/instructor/exams/manage"><ArrowLeft className="mr-1 h-4 w-4" />Back</Link></Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-normal">{exam.title}</h1>
              <Badge variant={statusVariant[exam.status] ?? 'default'}>{exam.status}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {examCoursesLabel(exam)}
              {examBanksLabel(exam) ? ` • Banks: ${examBanksLabel(exam)}` : ''}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link href="/instructor/exams/monitor">Monitor</Link></Button>
          <Button asChild><Link href="/instructor/exams/manage">Manage exams</Link></Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Schedule</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <InfoItem icon={Calendar} label="Starts" value={new Date(exam.startsAt).toLocaleString()} />
            <InfoItem icon={Calendar} label="Ends" value={new Date(exam.endsAt).toLocaleString()} />
            <InfoItem icon={Clock} label="Duration" value={`${exam.durationMinutes} min`} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Scoring</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <InfoItem icon={Target} label="Total marks" value={String(exam.totalMarks)} />
            <InfoItem icon={Gauge} label="Passing marks" value={String(exam.passingMarks)} />
            <InfoItem icon={Gauge} label="Negative marking" value={`${exam.negativeMarkingRate}×`} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Settings</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <InfoItem icon={Users} label="Attempts allowed" value={String(exam.attemptsAllowed)} />
            <InfoItem icon={ListChecks} label="Questions" value={String(questions.length)} />
            <InfoItem icon={HelpCircle} label="Randomize" value={`${exam.randomizeQuestions ? 'questions' : 'no'} / ${exam.randomizeOptions ? 'options' : 'no options'}`} />
          </CardContent>
        </Card>
      </div>

      {exam.assignments && exam.assignments.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Assigned students ({exam.assignments.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {exam.assignments.map((a) => (
                <Badge key={a.id} variant="outline">
                  {a.student.firstName} {a.student.lastName} <span className="ml-1 text-muted-foreground">({a.student.email})</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Questions ({questions.length})</h2>
        </div>
        {questions.length === 0 ? (
          <Card className="mt-3">
            <CardContent className="flex flex-col items-center gap-2 py-10">
              <FolderOpen className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No questions attached to this exam.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="mt-3 space-y-4">
            {questions.map((item, i) => <QuestionCard key={item.id} index={i} item={item} />)}
          </div>
        )}
      </div>
    </div>
  );
}
