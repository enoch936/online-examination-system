'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  AlignLeft, Bookmark, CheckCircle2, ChevronLeft, ChevronRight, FileText, Flag, Grid3X3,
  LayoutList, ListChecks, Loader2, Maximize, Mic, Send, ShieldAlert, Type, Video,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useAutosave } from '@/hooks/use-autosave';
import { useCountdown } from '@/hooks/use-countdown';
import { useExamMonitoring, type ProctorControl } from '@/hooks/use-exam-monitoring';
import { useProctoring } from '@/hooks/use-proctoring';
import { apiErrorMessage } from '@/lib/api-error';
import { formatDuration } from '@/lib/utils';
import { examsService } from '@/services/exams.service';
import { monitoringService } from '@/services/monitoring.service';
import { useExamStore } from '@/store/exam.store';
import type { ExamQuestion } from '@/types/api';
import type { StudentRequirements } from '@/types/monitoring';

const typeIcons: Record<string, typeof FileText> = {
  MULTIPLE_CHOICE: ListChecks,
  MULTIPLE_SELECT: Grid3X3,
  TRUE_FALSE: CheckCircle2,
  FILL_BLANK: Type,
  SHORT_ANSWER: AlignLeft,
  ESSAY: FileText,
  MATCHING: Grid3X3,
};

const typeLabels: Record<string, string> = {
  MULTIPLE_CHOICE: 'Multiple Choice',
  MULTIPLE_SELECT: 'Multiple Select',
  TRUE_FALSE: 'True/False',
  FILL_BLANK: 'Fill in the Blank',
  SHORT_ANSWER: 'Short Answer',
  ESSAY: 'Essay',
  MATCHING: 'Matching',
};

function QuestionRenderer({
  question,
  draft,
  onUpdate,
}: {
  question: ExamQuestion;
  draft?: { selectedOptionIds?: string[]; answerText?: string; isBookmarked?: boolean; isMarkedForReview?: boolean };
  onUpdate: (update: { selectedOptionIds?: string[]; answerText?: string }) => void;
}) {
  const q = question.question;
  const selectedIds = draft?.selectedOptionIds ?? [];
  const answerText = draft?.answerText ?? '';

  const isMCQ = q.type === 'MULTIPLE_CHOICE' || q.type === 'TRUE_FALSE';
  const isMS = q.type === 'MULTIPLE_SELECT';
  const isText = q.type === 'SHORT_ANSWER' || q.type === 'FILL_BLANK';
  const isEssay = q.type === 'ESSAY';

  if (isMCQ || isMS) {
    return (
      <div className="space-y-2">
        {q.options.map((option) => {
          const active = selectedIds.includes(option.id);
          return (
            <button
              type="button"
              key={option.id}
              onClick={() => {
                if (isMCQ) {
                  onUpdate({ selectedOptionIds: active ? [] : [option.id] });
                } else {
                  onUpdate({
                    selectedOptionIds: active
                      ? selectedIds.filter((id) => id !== option.id)
                      : [...selectedIds, option.id],
                  });
                }
              }}
              className={`focus-ring flex w-full items-center justify-between rounded-lg border p-4 text-left text-sm transition-colors ${
                active ? 'border-primary bg-primary/10' : 'bg-background hover:bg-muted'
              }`}
            >
              <span>
                <span className="mr-3 font-semibold">{option.label}</span>
                {option.text}
              </span>
              {active && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
            </button>
          );
        })}
        {isMS && <p className="text-xs text-muted-foreground mt-1">Select all that apply</p>}
      </div>
    );
  }

  if (isText) {
    return (
      <div>
        <input
          className="h-10 w-full rounded-lg border bg-background px-3 text-sm shadow-sm"
          value={answerText}
          onChange={(e) => onUpdate({ answerText: e.target.value })}
          placeholder="Type your answer..."
          autoComplete="off"
        />
        {q.type === 'FILL_BLANK' && q.options.length > 0 && (
          <p className="text-xs text-muted-foreground mt-2">Hint: {q.options.filter((o) => o.isCorrect).map((o) => o.text).join(', ') || '—'}</p>
        )}
      </div>
    );
  }

  if (isEssay) {
    return (
      <div>
        <textarea
          className="min-h-[200px] w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm"
          value={answerText}
          onChange={(e) => onUpdate({ answerText: e.target.value })}
          placeholder="Write your essay answer..."
        />
      </div>
    );
  }

  return <p className="text-sm text-muted-foreground">Question type &quot;{q.type}&quot; is not yet supported in this view.</p>;
}

export function ExamTakingClient({ examId, sessionId }: { examId?: string; sessionId?: string }) {
  const router = useRouter();
  const currentIndex = useExamStore((state) => state.currentIndex);
  const answers = useExamStore((state) => state.answers);
  const setCurrentIndex = useExamStore((state) => state.setCurrentIndex);
  const updateAnswer = useExamStore((state) => state.updateAnswer);
  const toggleBookmark = useExamStore((state) => state.toggleBookmark);
  const resetStore = useExamStore((state) => state.reset);
  const submittedRef = useRef(false);
  const [showAll, setShowAll] = useState(false);
  const [proctorPaused, setProctorPaused] = useState(false);
  const [proctorBanner, setProctorBanner] = useState<string | null>(null);
  const [disconnectMsg, setDisconnectMsg] = useState<string | null>(null);
  const [requirements, setRequirements] = useState<StudentRequirements | null>(null);
  const [consentGiven, setConsentGiven] = useState(false);
  const [consentDeclined, setConsentDeclined] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reporting, setReporting] = useState(false);

  const query = useQuery({
    queryKey: ['exam-session', examId, sessionId],
    queryFn: () => (sessionId ? examsService.resume(sessionId) : examsService.start(examId ?? '')),
    enabled: Boolean(sessionId || examId),
    retry: false,
  });

  const resumeErrorCode = (
    query.error as { response?: { data?: { error?: { code?: string } | undefined } } } | null
  )?.response?.data?.error?.code;

  useEffect(() => {
    if (resumeErrorCode !== 'RESUME_PENDING') return;
    const timer = setInterval(() => void query.refetch(), 5000);
    return () => clearInterval(timer);
  }, [resumeErrorCode, query]);

  const submitMutation = useMutation({
    mutationFn: (autoSubmitted: boolean) => examsService.submit(query.data?.id ?? '', autoSubmitted),
    onSuccess: (data) => {
      toast.success('Exam submitted successfully');
      submittedRef.current = true;
      const resultId = (data as { result?: { id: string } })?.result?.id;
      if (resultId) {
        router.push(`/student/results?id=${resultId}`);
      } else {
        router.push('/student/results');
      }
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err, 'Failed to submit exam'));
    },
  });

  const remainingSeconds = useCountdown(
    query.data?.remainingSeconds ?? (query.data?.exam.durationMinutes ?? 0) * 60,
    useCallback(() => {
      if (query.data?.id && !submittedRef.current) {
        toast.info('Time is up! Auto-submitting...');
        submitMutation.mutate(true);
      }
    }, [query.data?.id, submitMutation]),
  );

  const remainingRef = useRef(remainingSeconds);
  remainingRef.current = remainingSeconds;

  useEffect(() => {
    resetStore();
    return () => { resetStore(); };
  }, [resetStore]);

  const questions = query.data?.exam.questions ?? [];
  const currentQuestion = questions[currentIndex];
  const currentDraft = currentQuestion ? answers[currentQuestion.question.id] : undefined;

  const saveDraft = useCallback(
    async (draft: typeof currentDraft) => {
      if (!query.data?.id || !draft || proctorPaused) return;
      await examsService.saveAnswer(query.data.id, { ...draft, remainingSeconds: remainingRef.current });
    },
    [proctorPaused, query.data?.id],
  );

  const saveCurrentAnswer = useCallback(async () => {
    if (!query.data?.id || !currentDraft) return;
    await examsService.saveAnswer(query.data.id, { ...currentDraft, remainingSeconds: remainingRef.current });
  }, [query.data?.id, currentDraft]);

  const goToQuestion = useCallback((index: number) => {
    void saveCurrentAnswer();
    setCurrentIndex(index);
  }, [saveCurrentAnswer, setCurrentIndex]);

  useAutosave(currentDraft, saveDraft);

  const handleProctorControl = useCallback(
    (control: ProctorControl) => {
      if (control.type === 'pause') {
        setProctorPaused(true);
      } else if (control.type === 'resume') {
        setProctorPaused(false);
        void query.refetch();
      } else if (control.type === 'extend') {
        toast.success(`Time extended by ${control.minutes} minute(s)`);
        void query.refetch();
      } else if (control.type === 'force-submit') {
        submitMutation.mutate(true);
      } else if (control.type === 'disconnect') {
        setDisconnectMsg('You have been disconnected by the proctor.');
      } else if (control.type === 'warning') {
        setProctorBanner(control.message);
      } else {
        toast.info(control.message);
      }
    },
    [query, submitMutation],
  );

  const submitReport = useCallback(async () => {
    const sessionIdValue = query.data?.id;
    if (!sessionIdValue || !reportText.trim()) return;
    setReporting(true);
    try {
      await monitoringService.recordEvent(sessionIdValue, {
        type: 'MANUAL_FLAG',
        metadata: { message: reportText.trim(), source: 'student-report' },
      });
      toast.success('Report sent to your proctor');
      setReportOpen(false);
      setReportText('');
    } catch {
      toast.error('Failed to send report');
    } finally {
      setReporting(false);
    }
  }, [query.data?.id, reportText]);

  const { reportEvent } = useExamMonitoring({
    examId: query.data?.examId ?? examId ?? '',
    sessionId: query.data?.id ?? '',
    remainingSeconds,
    onControl: handleProctorControl,
  });

  useEffect(() => {
    const examIdForProctor = query.data?.examId ?? examId ?? '';
    if (!examIdForProctor) return;
    void monitoringService.requirements(examIdForProctor).then(setRequirements).catch(() => undefined);
  }, [examId, query.data?.examId]);

  useEffect(() => {
    if (!query.data?.id || !currentQuestion) return;
    reportEvent('QUESTION_VIEWED', {
      questionId: currentQuestion.question.id,
      index: currentIndex,
      questionType: currentQuestion.question.type,
    });
  }, [currentIndex, currentQuestion, query.data?.id, reportEvent]);

  useProctoring({
    sessionId: query.data?.id ?? '',
    examId: query.data?.examId ?? examId ?? '',
    enabled: Boolean(
      query.data?.id &&
        requirements &&
        (requirements.webcamEnabled || requirements.micEnabled || requirements.aiDetectionEnabled) &&
        (requirements.requireConsent ? consentGiven : true),
    ),
    webcam: requirements?.webcamEnabled ?? false,
    mic: requirements?.micEnabled ?? false,
    ai: requirements?.aiDetectionEnabled ?? false,
  });

  const handleUpdateAnswer = useCallback(
    (question: ExamQuestion, update: { selectedOptionIds?: string[]; answerText?: string }) => {
      const questionId = question.question.id;
      const prev = answers[questionId];
      updateAnswer({
        questionId,
        selectedOptionIds: update.selectedOptionIds ?? prev?.selectedOptionIds ?? [],
        answerText: update.answerText ?? prev?.answerText,
        isBookmarked: prev?.isBookmarked,
      });
      const prevIds = prev?.selectedOptionIds ?? [];
      const nextIds = update.selectedOptionIds ?? prevIds;
      const prevText = prev?.answerText ?? '';
      const nextText = update.answerText ?? prevText;
      const changed =
        nextIds.length !== prevIds.length || nextIds.some((id) => !prevIds.includes(id)) || nextText !== prevText;
      if (changed) {
        reportEvent('QUESTION_ANSWERED', {
          questionId,
          selectedCount: nextIds.length,
          textLength: nextText.length,
        });
      }
    },
    [answers, reportEvent, updateAnswer],
  );

  const handleToggleBookmark = useCallback(
    (questionId: string) => {
      toggleBookmark(questionId);
      reportEvent('QUESTION_FLAGGED', { questionId });
    },
    [reportEvent, toggleBookmark],
  );

  const answeredCount = useMemo(
    () => Object.values(answers).filter((a) => (a.selectedOptionIds?.length ?? 0) > 0 || (a.answerText?.length ?? 0) > 0).length,
    [answers],
  );

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (query.isError) {
    if (resumeErrorCode === 'RESUME_PENDING') {
      return (
        <Card>
          <CardContent className="pt-6 text-center">
            <ShieldAlert className="mx-auto h-8 w-8 text-warning" />
            <h2 className="mt-3 text-lg font-semibold">Waiting for instructor approval</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Your session was interrupted and is now paused. Your instructor has been notified — once they
              approve your resume, you will be taken straight back to your exam.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking for approval...
            </div>
            <Button className="mt-4" variant="outline" onClick={() => router.push('/student/exams')}>
              Back to exams
            </Button>
          </CardContent>
        </Card>
      );
    }
    if (resumeErrorCode === 'RESUME_DENIED') {
      return (
        <Card>
          <CardContent className="pt-6 text-center">
            <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
            <h2 className="mt-3 text-lg font-semibold">Resume denied</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Your instructor did not approve your resume request. The exam remains paused — contact your
              instructor for help.
            </p>
            <Button className="mt-4" onClick={() => router.push('/student/exams')}>Back to exams</Button>
          </CardContent>
        </Card>
      );
    }
    return (
      <Card>
        <CardHeader>
          <CardTitle>Exam session unavailable</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{apiErrorMessage(query.error, 'We could not open your exam session.')}</p>
          <Button onClick={() => router.push('/student/exams')}>Back to exams</Button>
        </CardContent>
      </Card>
    );
  }

  if (!query.data || !currentQuestion) {
    const emptyExam = Boolean(query.data) && (query.data?.exam.questions.length ?? 0) === 0;
    return (
      <Card>
        <CardHeader>
          <CardTitle>{emptyExam ? 'This exam has no questions yet' : 'Exam session unavailable'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {emptyExam
              ? 'The instructor has not added questions to this exam. Please contact your instructor or try again later.'
              : 'Your exam session could not be opened. It may have already been submitted or is no longer available.'}
          </p>
          <Button onClick={() => router.push('/student/exams')}>Back to exams</Button>
        </CardContent>
      </Card>
    );
  }

  const TypeIcon = typeIcons[currentQuestion.question.type] ?? FileText;

  const captureNeeded =
    requirements && (requirements.webcamEnabled || requirements.micEnabled || requirements.aiDetectionEnabled);

  if (disconnectMsg) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
          <h2 className="mt-3 text-lg font-semibold">Session ended</h2>
          <p className="mt-1 text-sm text-muted-foreground">{disconnectMsg}</p>
          <Button className="mt-4" onClick={() => router.push('/student/exams')}>Back to exams</Button>
        </CardContent>
      </Card>
    );
  }

  if (requirements?.requireConsent && captureNeeded && !consentGiven && !consentDeclined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Proctoring consent required</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This exam uses automated proctoring. Your camera{requirements.micEnabled ? ', microphone and screen' : ' and screen'}
            may be monitored to preserve exam integrity.
          </p>
          <ul className="space-y-1 text-sm">
            {requirements.webcamEnabled && (
              <li className="flex items-center gap-2"><Video className="h-4 w-4" /> Camera feed is shared with the proctor.</li>
            )}
            {requirements.micEnabled && (
              <li className="flex items-center gap-2"><Mic className="h-4 w-4" /> Microphone audio is analyzed for activity.</li>
            )}
            {requirements.aiDetectionEnabled && (
              <li className="flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> AI analysis detects suspicious behavior.</li>
            )}
          </ul>
          <div className="flex gap-3">
            <Button onClick={() => setConsentGiven(true)}>I consent</Button>
            <Button
              variant="outline"
              onClick={() => {
                setConsentDeclined(true);
                reportEvent('PROCTORING_CONSENT_DECLINED', {});
                toast.warning('Proctoring stays disabled. The proctor has been notified.');
              }}
            >
              Decline
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="relative space-y-5">
      {proctorBanner && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          <span className="flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> {proctorBanner}</span>
          <Button size="sm" variant="ghost" onClick={() => setProctorBanner(null)}>Dismiss</Button>
        </div>
      )}
      {proctorPaused && (
        <div className="absolute inset-0 z-50 flex items-center justify-center rounded-lg bg-background/95 backdrop-blur-sm">
          <div className="text-center">
            <ShieldAlert className="mx-auto h-10 w-10 text-warning" />
            <h2 className="mt-3 text-lg font-semibold">Exam paused by proctor</h2>
            <p className="mt-1 text-sm text-muted-foreground">Time is frozen. Wait for the proctor to resume.</p>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-4 rounded-lg border bg-background p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Badge variant="outline">Exam in progress</Badge>
          <h1 className="mt-2 text-2xl font-semibold tracking-normal">{query.data.exam.title}</h1>
          <p className="text-sm text-muted-foreground">
            Answered {answeredCount} of {questions.length}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={remainingSeconds < 60 ? 'warning' : remainingSeconds < 300 ? 'warning' : 'secondary'} className="text-sm tabular-nums">
            {formatDuration(remainingSeconds)}
          </Badge>
          <Button type="button" variant="outline" size="icon" title="Enter fullscreen" onClick={() => void document.documentElement.requestFullscreen()}>
            <Maximize className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={showAll ? 'secondary' : 'outline'}
            size="icon"
            title={showAll ? 'Show one at a time' : 'Show all questions'}
            onClick={() => setShowAll((v) => !v)}
          >
            <LayoutList className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            title="Report a problem to your proctor"
            onClick={() => setReportOpen((v) => !v)}
          >
            <Flag className="mr-1 h-4 w-4" />
            Report
          </Button>
          <Button
            variant="destructive"
            onClick={() => { if (window.confirm('Are you sure you want to submit?')) submitMutation.mutate(false); }}
            disabled={submitMutation.isPending}
          >
            <Send className="h-4 w-4" />
            Submit
          </Button>
        </div>
      </div>

      {reportOpen && (
        <div className="rounded-lg border bg-background p-4">
          <div className="mb-2 flex items-center gap-2">
            <Flag className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">Report a problem to your proctor</p>
          </div>
          <Textarea
            value={reportText}
            onChange={(e) => setReportText(e.target.value)}
            placeholder="Describe the issue, e.g. 'Question 5 options are not rendering' or 'My camera is not connecting'..."
            maxLength={500}
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">{reportText.length}/500</p>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setReportOpen(false); setReportText(''); }}>
                Cancel
              </Button>
              <Button size="sm" onClick={submitReport} disabled={reporting || !reportText.trim()}>
                {reporting ? 'Sending...' : 'Send report'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showAll ? (
        <div className="space-y-6">
          {questions.map((question, index) => {
            const draft = answers[question.question.id];
            const TypeIcon = typeIcons[question.question.type] ?? FileText;
            return (
              <Card key={question.question.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="flex items-center gap-1">
                          <TypeIcon className="h-3 w-3" />
                          {typeLabels[question.question.type] ?? question.question.type}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">{question.question.difficulty}</Badge>
                        <span className="text-xs text-muted-foreground">{Number(question.points)} pts</span>
                      </div>
                      <CardTitle className="leading-7 text-base">
                        {index + 1}. {question.question.prompt}
                      </CardTitle>
                    </div>
                    <Button
                      type="button"
                      variant={draft?.isBookmarked ? 'secondary' : 'outline'}
                      size="icon"
                      title="Bookmark question"
                      onClick={() => handleToggleBookmark(question.question.id)}
                    >
                      <Bookmark className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <QuestionRenderer
                    question={question}
                    draft={draft}
                    onUpdate={(update) => handleUpdateAnswer(question, update)}
                  />
                </CardContent>
              </Card>
            );
          })}
          <div className="flex justify-center pb-6">
            <Button
              size="lg"
              variant="destructive"
              onClick={() => { if (window.confirm('Are you sure you want to submit?')) submitMutation.mutate(false); }}
              disabled={submitMutation.isPending}
            >
              <Send className="mr-2 h-4 w-4" />
              Submit all answers
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="flex items-center gap-1">
                      <TypeIcon className="h-3 w-3" />
                      {typeLabels[currentQuestion.question.type] ?? currentQuestion.question.type}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">{currentQuestion.question.difficulty}</Badge>
                  </div>
                  <CardTitle className="leading-7 text-base">
                    {currentIndex + 1}. {currentQuestion.question.prompt}
                  </CardTitle>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant={currentDraft?.isBookmarked ? 'secondary' : 'outline'}
                    size="icon"
                    title="Bookmark question"
                    onClick={() => handleToggleBookmark(currentQuestion.question.id)}
                  >
                    <Bookmark className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <QuestionRenderer
                question={currentQuestion}
                draft={currentDraft}
                onUpdate={(update) => handleUpdateAnswer(currentQuestion, update)}
              />
              <div className="flex items-center justify-between pt-4">
                <Button
                  variant="outline"
                  disabled={currentIndex === 0}
                  onClick={() => goToQuestion(currentIndex - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  disabled={currentIndex === questions.length - 1}
                  onClick={() => goToQuestion(currentIndex + 1)}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Navigator</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-2">
                {questions.map((question, index) => {
                  const draft = answers[question.question.id];
                  const isAnswered = (draft?.selectedOptionIds?.length ?? 0) > 0 || (draft?.answerText?.length ?? 0) > 0;
                  const isBookmarked = draft?.isBookmarked;
                  let variant: 'default' | 'secondary' | 'outline' | 'destructive' | 'ghost' = 'outline';
                  if (index === currentIndex) variant = 'default';
                  else if (isBookmarked) variant = 'secondary';
                  else if (isAnswered) variant = 'ghost';
                  return (
                    <Button
                      key={question.question.id}
                      type="button"
                      size="icon"
                      variant={variant}
                      onClick={() => goToQuestion(index)}
                      title={`Question ${index + 1}${isAnswered ? ' (answered)' : ''}${isBookmarked ? ' (bookmarked)' : ''}`}
                      className="relative"
                    >
                      {index + 1}
                      {isBookmarked && <Bookmark className="absolute -top-1 -right-1 h-2.5 w-2.5 fill-current" />}
                    </Button>
                  );
                })}
              </div>
              <div className="mt-4 space-y-1 text-xs text-muted-foreground">
                <p><span className="inline-block w-3 h-3 rounded bg-primary mr-1 align-middle" /> Current</p>
                <p><span className="inline-block w-3 h-3 rounded bg-secondary mr-1 align-middle" /> Bookmarked</p>
                <p><span className="inline-block w-3 h-3 rounded bg-muted mr-1 align-middle" /> Answered</p>
                <p><span className="inline-block w-3 h-3 rounded border mr-1 align-middle" /> Unanswered</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
