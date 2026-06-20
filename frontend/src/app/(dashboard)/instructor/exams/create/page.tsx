'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { coursesService } from '@/services/courses.service';
import { questionsService } from '@/services/questions.service';
import { examsService } from '@/services/exams.service';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Search, BookOpen } from 'lucide-react';
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
  const [courseId, setCourseId] = useState('');
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
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: courses, isLoading: coursesLoading } = useQuery({
    queryKey: ['courses'],
    queryFn: () => coursesService.list(),
  });

  const { data: questionsData, isLoading: questionsLoading } = useQuery({
    queryKey: ['questions'],
    queryFn: () => questionsService.list({ take: 200 }),
  });

  const questions = questionsData?.questions ?? [];
  const filteredQuestions = questions.filter((q) =>
    q.prompt.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const toggleQuestion = (id: string) => {
    setSelectedQuestionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
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
    if (!courseId) { toast.error('Please select a course'); return; }
    if (!title.trim()) { toast.error('Please enter a title'); return; }
    if (!durationMinutes || isNaN(Number(durationMinutes))) { toast.error('Please enter a valid duration'); return; }
    if (!totalMarks || isNaN(Number(totalMarks))) { toast.error('Please enter valid total marks'); return; }
    if (!passingMarks || isNaN(Number(passingMarks))) { toast.error('Please enter valid passing marks'); return; }
    if (!startsAt) { toast.error('Please select a start date'); return; }
    if (!endsAt) { toast.error('Please select an end date'); return; }
    if (new Date(endsAt) <= new Date(startsAt)) { toast.error('End date must be after start date'); return; }
    if (selectedQuestionIds.length === 0) { toast.error('Please select at least one question'); return; }

    createMutation.mutate({
      courseId,
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
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      questionIds: selectedQuestionIds,
    });
  };

  if (coursesLoading || questionsLoading) return <SkeletonForm />;

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
                  <Label htmlFor="course">Course</Label>
                  <select id="course" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={courseId} onChange={(e) => setCourseId(e.target.value)} required>
                    <option value="">Select a course</option>
                    {courses?.map((c) => (<option key={c.id} value={c.id}>{c.name} ({c.code})</option>))}
                  </select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Questions</CardTitle>
                <CardDescription>Select questions to include ({selectedQuestionIds.length} selected)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Search questions..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
                {filteredQuestions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <BookOpen className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No questions found</p>
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {filteredQuestions.map((q) => (
                      <label key={q.id} className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors hover:bg-muted/50 ${selectedQuestionIds.includes(q.id) ? 'border-primary bg-primary/5' : ''}`}>
                        <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-gray-300" checked={selectedQuestionIds.includes(q.id)} onChange={() => toggleQuestion(q.id)} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{q.prompt}</p>
                          <div className="flex gap-2 mt-1 flex-wrap">
                            <Badge variant="outline" className="text-[10px]">{q.type}</Badge>
                            <Badge variant="outline" className="text-[10px]">{q.difficulty}</Badge>
                            <span className="text-[10px] text-muted-foreground">{Number(q.points)} pts</span>
                            <span className="text-[10px] text-muted-foreground">{q.subject?.name}</span>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
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
              </CardContent>
            </Card>

            <Button type="submit" className="w-full" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {createMutation.isPending ? 'Creating...' : 'Create exam'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
