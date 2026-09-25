'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { certificatesService } from '@/services/certificates.service';
import { resultsService } from '@/services/results.service';
import type { ResultDetail } from '@/types/api';
import { toast } from 'sonner';
import {
  Award,
  CheckCircle2,
  FileSearch,
  Loader2,
  Pencil,
  RotateCcw,
  Send,
  ShieldOff,
  XCircle,
} from 'lucide-react';

const CHOICE_TYPES = ['MULTIPLE_CHOICE', 'MULTIPLE_SELECT', 'TRUE_FALSE'];
const GRADE_OPTIONS = ['A', 'B', 'C', 'D', 'F'];
const GRADE_BANDS: Array<{ min: number; letter: string }> = [
  { min: 90, letter: 'A' },
  { min: 80, letter: 'B' },
  { min: 70, letter: 'C' },
  { min: 60, letter: 'D' },
  { min: 0, letter: 'F' },
];

type ScoreEntry = { score: string; feedback: string };

function autoGrade(percentage: number): string {
  return GRADE_BANDS.find((band) => percentage >= band.min)?.letter ?? 'F';
}

function parseSelected(selectedOptionIds?: string): string[] {
  if (!selectedOptionIds) return [];
  try {
    const parsed = JSON.parse(selectedOptionIds);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function buildScoreForm(detail: ResultDetail): Record<string, ScoreEntry> {
  const form: Record<string, ScoreEntry> = {};
  for (const answer of detail.submission?.session?.answers ?? []) {
    form[answer.id] = { score: String(answer.score ?? ''), feedback: answer.feedback ?? '' };
  }
  return form;
}

async function refreshResultViews(queryClient: QueryClient, resultId: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['result-detail', resultId] }),
    queryClient.invalidateQueries({ queryKey: ['results'] }),
    queryClient.invalidateQueries({ queryKey: ['certificates'] }),
  ]);
}

/**
 * Owns every staff-editable control for one result. It is mounted with a key that
 * changes whenever a save succeeds, so the form always re-seeds from the server
 * response instead of drifting from the persisted state.
 */
function ResultWorkspace({
  detail,
  queryClient,
  onSaved,
}: {
  detail: ResultDetail;
  queryClient: QueryClient;
  onSaved: () => void;
}) {
  const [scoreForm, setScoreForm] = useState<Record<string, ScoreEntry>>(() => buildScoreForm(detail));
  const [gradeLetter, setGradeLetter] = useState(detail.grade ?? '');
  const [overallFeedback, setOverallFeedback] = useState(detail.feedback ?? '');
  const [editingScores, setEditingScores] = useState(false);

  const answers = detail.submission?.session?.answers ?? [];
  const answerByQuestion = new Map(answers.map((a) => [a.questionId, a]));
  const examQuestions = detail.exam?.questions ?? [];
  const percentage = Number(detail.percentage ?? 0);
  const certificate = detail.certificate ?? null;

  const pointsByAnswerId = new Map<string, number>();
  for (const examQuestion of examQuestions) {
    const answer = answerByQuestion.get(examQuestion.questionId);
    if (answer) pointsByAnswerId.set(answer.id, Number(examQuestion.points));
  }

  const afterSave = async (message: string) => {
    await refreshResultViews(queryClient, detail.id);
    onSaved();
    toast.success(message);
  };

  const gradeMutation = useMutation({
    mutationFn: (payload: { id: string; answers: Array<{ answerId: string; score: number; feedback?: string }> }) =>
      resultsService.grade(payload.id, payload.answers),
    onSuccess: async () => {
      setEditingScores(false);
      await afterSave('Scores saved and total recalculated');
    },
    onError: (err: Error) => toast.error(err?.message || 'Failed to save scores'),
  });

  const overrideMutation = useMutation({
    mutationFn: (payload: { id: string; body: { grade?: string | null; feedback?: string | null; recomputeGrade?: boolean } }) =>
      resultsService.override(payload.id, payload.body),
    onSuccess: () => afterSave('Grade and feedback updated'),
    onError: (err: Error) => toast.error(err?.message || 'Failed to update grade'),
  });

  const issueMutation = useMutation({
    mutationFn: (id: string) => certificatesService.issue(id),
    onSuccess: () => afterSave('Certificate issued'),
    onError: (err: Error) => toast.error(err?.message || 'Failed to issue certificate'),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => certificatesService.revoke(id),
    onSuccess: () => afterSave('Certificate revoked'),
    onError: (err: Error) => toast.error(err?.message || 'Failed to revoke certificate'),
  });

  const reissueMutation = useMutation({
    mutationFn: (id: string) => certificatesService.reissue(id),
    onSuccess: () => afterSave('Certificate reissued with a new verification code'),
    onError: (err: Error) => toast.error(err?.message || 'Failed to reissue certificate'),
  });

  const saveScores = () => {
    const payload = Object.entries(scoreForm).map(([answerId, entry]) => {
      const maxPoints = pointsByAnswerId.get(answerId) ?? Number.MAX_SAFE_INTEGER;
      const requested = Number(entry.score);
      const score = Math.min(Math.max(Number.isFinite(requested) ? requested : 0, 0), maxPoints);
      return { answerId, score, feedback: entry.feedback.trim() || undefined };
    });
    if (payload.length === 0) {
      toast.error('There are no saved answers to grade');
      return;
    }
    gradeMutation.mutate({ id: detail.id, answers: payload });
  };

  const saveGrade = () => {
    const body: { grade?: string | null; feedback?: string | null; recomputeGrade?: boolean } = {};
    if (gradeLetter) body.grade = gradeLetter;
    else body.recomputeGrade = true;
    body.feedback = overallFeedback.trim() || null;
    overrideMutation.mutate({ id: detail.id, body });
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Pencil className="h-4 w-4" />
            Adjust grade
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium">Letter grade</label>
              <select
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={gradeLetter}
                onChange={(e) => setGradeLetter(e.target.value)}
              >
                <option value="">Auto from score ({autoGrade(percentage)})</option>
                {GRADE_OPTIONS.map((letter) => (
                  <option key={letter} value={letter}>
                    {letter}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Overall feedback</label>
              <textarea
                className="min-h-[60px] w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                value={overallFeedback}
                onChange={(e) => setOverallFeedback(e.target.value)}
                placeholder="Optional feedback shown to the student..."
              />
            </div>
          </div>
          <Button className="w-full" onClick={saveGrade} disabled={overrideMutation.isPending}>
            {overrideMutation.isPending ? 'Saving...' : 'Save grade & feedback'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Award className="h-4 w-4" />
            Certificate
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!detail.passed ? (
            <p className="text-sm text-muted-foreground">
              A certificate can only be issued once this result passes.
            </p>
          ) : certificate ? (
            <div className="space-y-3">
              <div className="space-y-1 rounded-md border bg-muted/30 p-3 text-sm">
                <p>
                  <span className="text-muted-foreground">Certificate no:</span>{' '}
                  <span className="font-medium">{certificate.certificateNo}</span>
                </p>
                <p className="break-all">
                  <span className="text-muted-foreground">Verification code:</span>{' '}
                  <span className="font-mono text-xs">{certificate.verificationCode}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Issued {new Date(certificate.issuedAt).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => reissueMutation.mutate(certificate.id)}
                  disabled={reissueMutation.isPending}
                >
                  {reissueMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="mr-2 h-4 w-4" />
                  )}
                  Reissue
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 text-destructive"
                  onClick={() => revokeMutation.mutate(certificate.id)}
                  disabled={revokeMutation.isPending}
                >
                  {revokeMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldOff className="mr-2 h-4 w-4" />
                  )}
                  Revoke
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                No certificate has been issued for this result yet.
              </p>
              <Button
                className="w-full"
                onClick={() => issueMutation.mutate(detail.id)}
                disabled={issueMutation.isPending}
              >
                {issueMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Award className="mr-2 h-4 w-4" />
                )}
                Issue certificate
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Question scores</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditingScores((prev) => !prev)}>
            <Pencil className="mr-2 h-3.5 w-3.5" />
            {editingScores ? 'Done editing' : 'Adjust scores'}
          </Button>
          {editingScores && (
            <Button size="sm" onClick={saveScores} disabled={gradeMutation.isPending}>
              {gradeMutation.isPending ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
              )}
              Save scores
            </Button>
          )}
        </div>
      </div>

      {examQuestions.length === 0 && (
        <p className="text-sm text-muted-foreground">This exam has no questions to display.</p>
      )}

      {examQuestions.map((examQuestion, index) => {
        const question = examQuestion.question;
        const answer = answerByQuestion.get(question.id);
        const selected = parseSelected(answer?.selectedOptionIds);
        const isChoice = CHOICE_TYPES.includes(question.type);
        const correctOptions = question.options.filter((o) => o.isCorrect);
        const awarded = answer?.score;
        const points = Number(examQuestion.points);
        const gotFull = awarded != null && Number(awarded) >= points;
        const studentAnswered =
          selected.length > 0 || (answer?.answerText && answer.answerText.trim().length > 0);
        const entry = answer ? scoreForm[answer.id] : undefined;

        return (
          <Card key={question.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="text-sm leading-6">
                  {index + 1}. {question.prompt}
                </CardTitle>
                <div className="flex shrink-0 items-center gap-1">
                  {gotFull ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                </div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {question.type.replace(/_/g, ' ')} &middot; {points} pts &middot; awarded{' '}
                {awarded != null ? Number(awarded) : 0}
              </p>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {isChoice && question.options.length > 0 && (
                <ul className="space-y-1">
                  {question.options.map((option) => {
                    const isCorrect = Boolean(option.isCorrect);
                    const isPicked = selected.includes(option.id);
                    return (
                      <li
                        key={option.id}
                        className={`rounded-md border px-3 py-2 ${
                          isCorrect
                            ? 'border-emerald-500/40 bg-emerald-500/10'
                            : isPicked
                              ? 'border-destructive/40 bg-destructive/10'
                              : 'bg-muted/20'
                        }`}
                      >
                        <span className="font-semibold">{option.label}.</span> {option.text}
                        {isCorrect && <span className="ml-2 text-xs font-medium text-emerald-600">Correct answer</span>}
                        {isPicked && (
                          <span className="ml-2 text-xs font-medium text-foreground">
                            Your answer{isCorrect ? ' (correct)' : ' (incorrect)'}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {!isChoice && (
                <div className="rounded-md bg-muted/40 p-3 whitespace-pre-wrap">
                  {studentAnswered ? (
                    answer?.answerText
                  ) : (
                    <span className="italic text-muted-foreground">No answer provided</span>
                  )}
                </div>
              )}

              {!studentAnswered && isChoice && (
                <p className="italic text-muted-foreground">No answer selected</p>
              )}

              {correctOptions.length === 0 && !isChoice && (
                <p className="text-xs text-muted-foreground">
                  Correct answer: graded manually
                  {answer?.grader ? ` by ${answer.grader.firstName} ${answer.grader.lastName}` : ''}.
                </p>
              )}

              {editingScores && answer && entry && (
                <div className="grid gap-3 rounded-md border border-dashed p-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium">Score (max {points})</label>
                    <input
                      type="number"
                      min={0}
                      max={points}
                      step="0.5"
                      className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                      value={entry.score}
                      onChange={(e) =>
                        setScoreForm((prev) => ({
                          ...prev,
                          [answer.id]: { ...entry, score: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">Question feedback</label>
                    <input
                      className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                      value={entry.feedback}
                      onChange={(e) =>
                        setScoreForm((prev) => ({
                          ...prev,
                          [answer.id]: { ...entry, feedback: e.target.value },
                        }))
                      }
                      placeholder="Optional..."
                    />
                  </div>
                </div>
              )}

              {answer?.feedback && !editingScores && (
                <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                  <p className="text-xs font-medium text-primary">Grader feedback</p>
                  <p className="mt-1">{answer.feedback}</p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}

export function SubmissionDetailSheet({
  resultId,
  open,
  onOpenChange,
}: {
  resultId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [epoch, setEpoch] = useState(0);

  const { data, isLoading, error } = useQuery({
    queryKey: ['result-detail', resultId],
    queryFn: () => resultsService.get(resultId!),
    enabled: open && Boolean(resultId),
  });

  const detail = data as ResultDetail | undefined;
  const student = detail?.submission?.session?.student;

  const publishMutation = useMutation({
    mutationFn: (id: string) => resultsService.publish(id),
    onSuccess: async () => {
      await refreshResultViews(queryClient, detail?.id ?? '');
      setEpoch((prev) => prev + 1);
      toast.success('Result published');
    },
    onError: (err: Error) => toast.error(err?.message || 'Failed to publish result'),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Submitted exam details</SheetTitle>
          <SheetDescription>
            Every question, the student&apos;s answer, the correct answer, and the awarded score.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {isLoading && (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          )}

          {error && !isLoading && (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                <FileSearch className="h-8 w-8 text-destructive" />
                <p className="text-sm font-medium text-destructive">Failed to load submission details</p>
                <p className="text-sm text-muted-foreground">Please close this panel and try again.</p>
              </CardContent>
            </Card>
          )}

          {detail && !isLoading && (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">{detail.exam.title}</CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {student ? `${student.firstName} ${student.lastName}` : 'Unknown student'}
                        {student?.email ? ` · ${student.email}` : ''}
                      </p>
                    </div>
                    <Badge variant={detail.passed ? 'success' : 'warning'}>
                      {detail.passed ? 'PASS' : 'FAIL'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-xs text-muted-foreground">Score</p>
                      <p className="text-xl font-semibold">
                        {detail.score} / {detail.maxScore}
                      </p>
                    </div>
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-xs text-muted-foreground">Percentage</p>
                      <p className="text-xl font-semibold">{Number(detail.percentage).toFixed(1)}%</p>
                    </div>
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-xs text-muted-foreground">Grade</p>
                      <p className="text-xl font-semibold">{detail.grade ?? 'N/A'}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Completed: {new Date(detail.createdAt).toLocaleString()} &middot;{' '}
                    {detail.publishedAt ? 'Result published' : 'Result not published'}
                  </p>
                  {detail.feedback && (
                    <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 p-3">
                      <p className="text-xs font-medium text-primary">Overall feedback</p>
                      <p className="mt-1 text-sm">{detail.feedback}</p>
                    </div>
                  )}
                  {!detail.publishedAt && (
                    <Button
                      className="mt-3 w-full"
                      onClick={() => publishMutation.mutate(detail.id)}
                      disabled={publishMutation.isPending}
                    >
                      {publishMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      Publish result
                    </Button>
                  )}
                </CardContent>
              </Card>

              <ResultWorkspace
                key={`${detail.id}:${epoch}`}
                detail={detail}
                queryClient={queryClient}
                onSaved={() => setEpoch((prev) => prev + 1)}
              />
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
