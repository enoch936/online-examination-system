'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { coursesService } from '@/services/courses.service';
import { examsService } from '@/services/exams.service';
import type { Question, QuestionBankPoolItem, QuestionPoolCourse } from '@/types/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Search, ChevronDown, ChevronRight, Library } from 'lucide-react';
import { toast } from 'sonner';

function SkeletonForm() {
  return (
    <div className="space-y-6">
      <div><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-96 mt-2" /></div>
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          <Card><CardHeader><Skeleton className="h-6 w-40" /></CardHeader><CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" /><Skeleton className="h-24 w-full" /><Skeleton className="h-10 w-full" />
          </CardContent></Card>
        </div>
        <div className="space-y-4">
          <Card><CardHeader><Skeleton className="h-6 w-32" /></CardHeader><CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" />
          </CardContent></Card>
        </div>
      </div>
    </div>
  );
}

export default function CreateExamPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [durationMinutes, setDurationMinutes] = useState('');
  const [totalMarks, setTotalMarks] = useState('');
  const [passingMarks, setPassingMarks] = useState('');
  const [attemptsAllowed, setAttemptsAllowed] = useState('1');
  const [negativeMarkingRate, setNegativeMarkingRate] = useState('0');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [randomizeQuestions, setRandomizeQuestions] = useState(true);
  const [randomizeOptions, setRandomizeOptions] = useState(true);
  const [fullscreenRequired, setFullscreenRequired] = useState(true);
  const [showResultImmediately, setShowResultImmediately] = useState(false);
  const [resumeApprovalRequired, setResumeApprovalRequired] = useState(false);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [expandedBankIds, setExpandedBankIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: courses, isLoading: coursesLoading } = useQuery({
    queryKey: ['courses'],
    queryFn: () => coursesService.list(),
  });

  const courseKey = selectedCourseIds.length > 0 ? [...selectedCourseIds].sort().join(',') : '';
  const { data: pool, isLoading: poolLoading, isError: poolError } = useQuery({
    queryKey: ['exam-question-pool', courseKey],
    queryFn: () => examsService.questionPool(selectedCourseIds),
    enabled: selectedCourseIds.length > 0,
  });

  const poolCourses: QuestionPoolCourse[] = selectedCourseIds
    .map((id) => pool?.courses.find((c) => c.course.id === id))
    .filter((c): c is QuestionPoolCourse => Boolean(c));
  const selected = new Set(selectedQuestionIds);

  const matchesSearch = (q: Question) =>
    q.prompt.toLowerCase().includes(searchQuery.toLowerCase());

  const isBankSelected = (bank: QuestionBankPoolItem) =>
    bank.questions.length > 0 && bank.questions.every((q) => selected.has(q.id));

  const toggleQuestion = (id: string) => {
    setSelectedQuestionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleBank = (bank: QuestionBankPoolItem, on: boolean) => {
    setSelectedQuestionIds((prev) => {
      const next = new Set(prev);
      for (const q of bank.questions) {
        if (on) next.add(q.id);
        else next.delete(q.id);
      }
      return [...next];
    });
  };

  const toggleExpanded = (id: string) => {
    setExpandedBankIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleCourse = (id: string) => {
    setSelectedCourseIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    setSelectedQuestionIds([]);
    setExpandedBankIds([]);
    setSearchQuery('');
  };

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof examsService.create>[0]) => examsService.create(data),
    onSuccess: () => {
      toast.success('Exam created successfully');
      router.push('/instructor/exams/manage');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create exam');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCourseIds.length === 0) { toast.error('Please select at least one course'); return; }
    if (!title.trim()) { toast.error('Please enter a title'); return; }
    if (!durationMinutes || isNaN(Number(durationMinutes))) { toast.error('Please enter a valid duration'); return; }
    if (!totalMarks || isNaN(Number(totalMarks))) { toast.error('Please enter valid total marks'); return; }
    if (!passingMarks || isNaN(Number(passingMarks))) { toast.error('Please enter valid passing marks'); return; }
    if (!startsAt) { toast.error('Please select a start date'); return; }
    if (!endsAt) { toast.error('Please select an end date'); return; }
    if (new Date(endsAt) <= new Date(startsAt)) { toast.error('End date must be after start date'); return; }
    if (Number(passingMarks) > Number(totalMarks)) { toast.error('Passing marks cannot exceed total marks'); return; }
    if (Number(negativeMarkingRate) > 1) { toast.error('Negative marking rate must be between 0 and 1'); return; }
    if (selectedQuestionIds.length === 0) { toast.error('Please select at least one question'); return; }

    createMutation.mutate({
      courseId: selectedCourseIds[0],
      courseIds: selectedCourseIds,
      title: title.trim(),
      description: description.trim() || undefined,
      instructions: instructions.trim() || undefined,
      durationMinutes: Number(durationMinutes),
      totalMarks: Number(totalMarks),
      passingMarks: Number(passingMarks),
      attemptsAllowed: Number(attemptsAllowed),
      negativeMarkingRate: Number(negativeMarkingRate) || 0,
      randomizeQuestions,
      randomizeOptions,
      fullscreenRequired,
      showResultImmediately,
      resumeApprovalRequired,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      questionIds: selectedQuestionIds,
    });
  };

  if (coursesLoading) return <SkeletonForm />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Create exam</h1>
          <p className="text-sm text-muted-foreground">
            Configure schedule, duration, attempts, randomization, grading policy, and instructions.
          </p>
        </div>
        <Badge variant="secondary">Instructor</Badge>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Exam details</CardTitle>
                <CardDescription>Basic information about the exam</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter exam title" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Exam description (optional)" rows={3} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instructions">Instructions</Label>
                  <Textarea id="instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Instructions shown to students before starting (optional)" rows={4} />
                </div>
                <div className="space-y-2">
                  <Label>Courses (select one or more)</Label>
                  <div className="max-h-52 space-y-1 overflow-y-auto rounded-md border p-2">
                    {courses?.length === 0 ? (
                      <p className="px-2 py-2 text-sm text-muted-foreground">No courses available.</p>
                    ) : (
                      courses?.map((c) => {
                        const checked = selectedCourseIds.includes(c.id);
                        return (
                          <label key={c.id} className={`flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 ${checked ? 'bg-primary/5' : ''}`}>
                            <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-gray-300" checked={checked} onChange={() => toggleCourse(c.id)} />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{c.name} <span className="text-muted-foreground">({c.code})</span></p>
                              <p className="text-xs text-muted-foreground">Category: {c.subject?.name ?? '—'}</p>
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                  {selectedCourseIds.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Primary course: <span className="font-medium">{courses?.find((c) => c.id === selectedCourseIds[0])?.name}</span>
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Questions</CardTitle>
                <CardDescription>
                  {selectedCourseIds.length > 0
                    ? `Selected questions: ${selectedQuestionIds.length}`
                    : 'Select at least one course. Only questions from the selected courses and their categories are shown.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedCourseIds.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-center">
                    <Library className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Select courses to load their question banks and standalone questions.</p>
                  </div>
                ) : poolError ? (
                  <div className="rounded-lg border border-dashed py-8 text-center text-sm text-destructive">
                    Failed to load questions for the selected courses.
                  </div>
                ) : poolLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input className="pl-9" placeholder="Search questions across all selected courses..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>

                    {poolCourses.map((coursePool) => (
                      <div key={coursePool.course.id} className="rounded-lg border p-3">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold">{coursePool.course.name}</span>
                          <Badge variant="outline" className="text-[10px]">{coursePool.course.code}</Badge>
                          <Badge variant="secondary" className="text-[10px]">Category: {coursePool.course.subject.name}</Badge>
                        </div>

                        <div className="mb-4">
                          <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            <Library className="h-3.5 w-3.5" /> Question banks
                          </h3>
                          {coursePool.banks.length === 0 ? (
                            <p className="rounded-md border border-dashed px-3 py-3 text-center text-sm text-muted-foreground">
                              No question banks for {coursePool.course.name} — {coursePool.course.subject.name}.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {coursePool.banks.map((bank) => {
                                const expanded = expandedBankIds.includes(bank.id);
                                const selectedBank = isBankSelected(bank);
                                const visible = bank.questions.filter(matchesSearch);
                                return (
                                  <div key={bank.id} className={`rounded-lg border ${selectedBank ? 'border-primary bg-primary/5' : ''}`}>
                                    <div className="flex items-center gap-2 p-3">
                                      <input type="checkbox" className="h-4 w-4 rounded border-gray-300" checked={selectedBank} onChange={(e) => toggleBank(bank, e.target.checked)} aria-label={`Select all questions from ${bank.name}`} />
                                      <button type="button" onClick={() => toggleExpanded(bank.id)} className="flex flex-1 items-center gap-2 text-left">
                                        {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                                        <span className="text-sm font-medium truncate">{bank.name}</span>
                                      </button>
                                      <Badge variant="outline" className="shrink-0">{bank.questionCount} questions</Badge>
                                      <Button type="button" size="sm" variant="ghost" className="shrink-0" onClick={() => toggleExpanded(bank.id)}>
                                        {expanded ? 'Hide' : 'View'}
                                      </Button>
                                    </div>
                                    {expanded && (
                                      <div className="max-h-64 space-y-1 overflow-y-auto border-t px-3 py-2">
                                        <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium hover:bg-muted/50">
                                          <input type="checkbox" className="h-4 w-4 rounded border-gray-300" checked={selectedBank} onChange={(e) => toggleBank(bank, e.target.checked)} />
                                          Select all ({bank.questionCount})
                                        </label>
                                        {visible.length === 0 ? (
                                          <p className="px-2 py-2 text-xs text-muted-foreground">No matching questions.</p>
                                        ) : (
                                          visible.map((q) => (
                                            <label key={q.id} className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50">
                                              <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-gray-300" checked={selected.has(q.id)} onChange={() => toggleQuestion(q.id)} />
                                              <div className="min-w-0 flex-1">
                                                <p className="text-sm leading-snug truncate">{q.prompt}</p>
                                                <div className="flex gap-1.5 mt-0.5 flex-wrap">
                                                  <Badge variant="outline" className="text-[10px]">{q.type}</Badge>
                                                  <Badge variant="outline" className="text-[10px]">{q.difficulty}</Badge>
                                                  {q.topic ? <span className="text-[10px] text-muted-foreground">{q.topic}</span> : null}
                                                </div>
                                              </div>
                                            </label>
                                          ))
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div>
                          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Standalone questions
                          </h3>
                          {coursePool.standaloneQuestions.length === 0 ? (
                            <p className="rounded-md border border-dashed px-3 py-3 text-center text-sm text-muted-foreground">
                              No standalone questions for {coursePool.course.name} — {coursePool.course.subject.name}.
                            </p>
                          ) : (
                            <div className="max-h-64 space-y-1 overflow-y-auto">
                              {coursePool.standaloneQuestions.filter(matchesSearch).length === 0 ? (
                                <p className="px-2 py-2 text-xs text-muted-foreground">No matching questions.</p>
                              ) : (
                                coursePool.standaloneQuestions.filter(matchesSearch).map((q) => (
                                  <label key={q.id} className="flex cursor-pointer items-start gap-2 rounded-md border px-2 py-2 hover:bg-muted/50">
                                    <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-gray-300" checked={selected.has(q.id)} onChange={() => toggleQuestion(q.id)} />
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm leading-snug">{q.prompt}</p>
                                      <div className="flex gap-1.5 mt-0.5 flex-wrap">
                                        <Badge variant="outline" className="text-[10px]">{q.type}</Badge>
                                        <Badge variant="outline" className="text-[10px]">{q.difficulty}</Badge>
                                        {q.topic ? <span className="text-[10px] text-muted-foreground">{q.topic}</span> : null}
                                      </div>
                                    </div>
                                  </label>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Schedule & scoring</CardTitle>
                <CardDescription>Duration, dates, passing criteria</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (minutes)</Label>
                  <Input id="duration" type="number" min={1} value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} placeholder="e.g. 60" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="totalMarks">Total marks</Label>
                  <Input id="totalMarks" type="number" min={1} value={totalMarks} onChange={(e) => setTotalMarks(e.target.value)} placeholder="e.g. 100" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="passingMarks">Passing marks</Label>
                  <Input id="passingMarks" type="number" min={0} value={passingMarks} onChange={(e) => setPassingMarks(e.target.value)} placeholder="e.g. 40" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="negativeMarking">Negative marking rate</Label>
                  <Input id="negativeMarking" type="number" min={0} step={0.25} value={negativeMarkingRate} onChange={(e) => setNegativeMarkingRate(e.target.value)} placeholder="e.g. 0.25" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="attempts">Attempts allowed</Label>
                  <Input id="attempts" type="number" min={1} value={attemptsAllowed} onChange={(e) => setAttemptsAllowed(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startsAt">Start date & time</Label>
                  <Input id="startsAt" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endsAt">End date & time</Label>
                  <Input id="endsAt" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} required />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Behavior</CardTitle>
                <CardDescription>Randomization, security, result display</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" className="h-4 w-4" checked={randomizeQuestions} onChange={(e) => setRandomizeQuestions(e.target.checked)} />
                  <div><p className="text-sm font-medium">Randomize questions</p><p className="text-xs text-muted-foreground">Shuffle question order for each student</p></div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" className="h-4 w-4" checked={randomizeOptions} onChange={(e) => setRandomizeOptions(e.target.checked)} />
                  <div><p className="text-sm font-medium">Randomize options</p><p className="text-xs text-muted-foreground">Shuffle answer option order</p></div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" className="h-4 w-4" checked={fullscreenRequired} onChange={(e) => setFullscreenRequired(e.target.checked)} />
                  <div><p className="text-sm font-medium">Fullscreen required</p><p className="text-xs text-muted-foreground">Force fullscreen during exam</p></div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" className="h-4 w-4" checked={showResultImmediately} onChange={(e) => setShowResultImmediately(e.target.checked)} />
                  <div><p className="text-sm font-medium">Show result immediately</p><p className="text-xs text-muted-foreground">Display score right after submission</p></div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" className="h-4 w-4" checked={resumeApprovalRequired} onChange={(e) => setResumeApprovalRequired(e.target.checked)} />
                  <div>
                    <p className="text-sm font-medium">Require approval to resume</p>
                    <p className="text-xs text-muted-foreground">
                      If a student&apos;s session is interrupted, pause it and require an instructor to approve the resume
                    </p>
                  </div>
                </label>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between rounded-lg border bg-muted/50 px-4 py-3">
              <span className="text-sm text-muted-foreground">Selected questions</span>
              <span className="text-sm font-semibold">{selectedQuestionIds.length}</span>
            </div>

            <Button type="submit" className="w-full" disabled={createMutation.isPending || (selectedCourseIds.length > 0 && !poolLoading && selectedQuestionIds.length === 0)}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {createMutation.isPending ? 'Creating...' : 'Create exam'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
