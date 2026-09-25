'use client';

import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { resultsService } from '@/services/results.service';
import type { ResultDetail } from '@/types/api';
import { CheckCircle2, XCircle, FileSearch } from 'lucide-react';

const CHOICE_TYPES = ['MULTIPLE_CHOICE', 'MULTIPLE_SELECT', 'TRUE_FALSE'];

function parseSelected(selectedOptionIds?: string): string[] {
  if (!selectedOptionIds) return [];
  try {
    const parsed = JSON.parse(selectedOptionIds);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
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
  const { data, isLoading, error } = useQuery({
    queryKey: ['result-detail', resultId],
    queryFn: () => resultsService.get(resultId!),
    enabled: open && Boolean(resultId),
  });

  const detail = data as ResultDetail | undefined;
  const student = detail?.submission?.session?.student;
  const answers = detail?.submission?.session?.answers ?? [];
  const answerByQuestion = new Map(answers.map((a) => [a.questionId, a]));
  const examQuestions = detail?.exam?.questions ?? [];

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
                      <p className="text-xl font-semibold">{detail.score} / {detail.maxScore}</p>
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
                </CardContent>
              </Card>

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
                const gotFull = awarded != null && Number(awarded) >= Number(examQuestion.points);
                const studentAnswered =
                  selected.length > 0 || (answer?.answerText && answer.answerText.trim().length > 0);

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
                        {question.type.replace(/_/g, ' ')} &middot; {Number(examQuestion.points)} pts &middot; awarded{' '}
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
                          {studentAnswered ? answer?.answerText : <span className="italic text-muted-foreground">No answer provided</span>}
                        </div>
                      )}

                      {!studentAnswered && isChoice && (
                        <p className="italic text-muted-foreground">No answer selected</p>
                      )}

                      {correctOptions.length === 0 && !isChoice && (
                        <p className="text-xs text-muted-foreground">
                          Correct answer: graded manually{answer?.grader ? ` by ${answer.grader.firstName} ${answer.grader.lastName}` : ''}.
                        </p>
                      )}

                      {answer?.feedback && (
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
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
