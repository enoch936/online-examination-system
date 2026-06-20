'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Fragment, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { questionsService } from '@/services/questions.service';
import { subjectsService } from '@/services/subjects.service';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ChevronDown, ChevronRight, FileQuestion, Pencil, Trash2, Plus, Search } from 'lucide-react';
import type { Question, Subject } from '@/types/api';

const typeLabels: Record<string, string> = {
  MCQ: 'Multiple Choice',
  TRUE_FALSE: 'True/False',
  SHORT_ANSWER: 'Short Answer',
  ESSAY: 'Essay',
  CODING: 'Coding',
};

const typeOptions = [
  { value: 'MCQ', label: 'Multiple Choice' },
  { value: 'TRUE_FALSE', label: 'True/False' },
  { value: 'SHORT_ANSWER', label: 'Short Answer' },
  { value: 'ESSAY', label: 'Essay' },
  { value: 'CODING', label: 'Coding' },
];

const difficultyOptions = [
  { value: 'EASY', label: 'Easy' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HARD', label: 'Hard' },
];

const difficultyColors: Record<string, string> = {
  EASY: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  MEDIUM: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  HARD: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const needsOptions = (type: string) => type === 'MCQ' || type === 'TRUE_FALSE';

type QuestionFormData = {
  subjectId: string;
  type: string;
  difficulty: string;
  prompt: string;
  explanation: string;
  points: number;
  negativePoints: number;
  tags: string;
  options: { label: string; text: string; isCorrect: boolean }[];
};

const emptyForm: QuestionFormData = {
  subjectId: '',
  type: 'MCQ',
  difficulty: 'MEDIUM',
  prompt: '',
  explanation: '',
  points: 1,
  negativePoints: 0,
  tags: '',
  options: [{ label: 'A', text: '', isCorrect: false }],
};

function ExpandableQuestion({ q }: { q: Question }) {
  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-semibold mb-1">Prompt</h4>
        <p className="text-sm whitespace-pre-wrap">{q.prompt}</p>
      </div>
      {q.explanation && (
        <div>
          <h4 className="text-sm font-semibold mb-1">Explanation</h4>
          <p className="text-sm text-muted-foreground">{q.explanation}</p>
        </div>
      )}
      {q.options && q.options.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-1">Options</h4>
          <div className="space-y-1">
            {q.options.map((opt) => (
              <div key={opt.id} className="flex items-center gap-2 text-sm">
                <span className="font-mono text-xs text-muted-foreground">{opt.label}.</span>
                <span>{opt.text}</span>
                {opt.isCorrect && <Badge variant="success" className="text-[10px]">Correct</Badge>}
              </div>
            ))}
          </div>
        </div>
      )}
      {q.subject && (
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>Subject: {q.subject.name}</span>
          {q.createdBy && <span>Created by: {q.createdBy.firstName} {q.createdBy.lastName}</span>}
        </div>
      )}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>Negative: -{q.negativePoints} pts</span>
        <span>Tags: {q.tags !== '[]' && q.tags ? q.tags.replace(/[["\]]/g, '') : '—'}</span>
      </div>
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96 mt-2" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-10 w-60" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="rounded-lg border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b p-4">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Question bank</h1>
          <p className="text-sm text-muted-foreground">Create, edit, tag, categorize, and reuse questions across exams.</p>
        </div>
        <Badge variant="secondary">Instructor</Badge>
      </div>
      <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/50 bg-destructive/5 py-12 text-center">
        <FileQuestion className="h-12 w-12 text-destructive mb-3" />
        <p className="text-lg font-medium text-destructive">{message}</p>
        <p className="text-sm text-muted-foreground mt-1">Please try again later.</p>
        {onRetry && (
          <Button variant="outline" className="mt-4" onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
      <FileQuestion className="h-12 w-12 text-muted-foreground mb-3" />
      <p className="text-lg font-medium">No questions found</p>
      <p className="text-sm text-muted-foreground mt-1">Get started by creating your first question.</p>
      <Button className="mt-4" onClick={onAdd}>
        <Plus className="mr-2 h-4 w-4" />
        Add Question
      </Button>
    </div>
  );
}

export default function QuestionBankPage() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<QuestionFormData>({ ...emptyForm, options: [{ label: 'A', text: '', isCorrect: false }] });

  const { data: questionsData, isLoading, error, refetch } = useQuery({
    queryKey: ['questions'],
    queryFn: () => questionsService.list(),
  });

  const questions = questionsData?.questions ?? [];

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectsService.list(),
  });

  const types = [...new Set(questions.map((q) => q.type))];
  const difficulties = [...new Set(questions.map((q) => q.difficulty))];
  const questionSubjects = [...new Map(questions.filter(q => q.subject).map(q => [q.subject!.id, q.subject!])).values()];

  const filtered = questions.filter((q) => {
    if (typeFilter && q.type !== typeFilter) return false;
    if (difficultyFilter && q.difficulty !== difficultyFilter) return false;
    if (subjectFilter && q.subjectId !== subjectFilter) return false;
    if (searchQuery && !q.prompt.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const createMutation = useMutation({
    mutationFn: (data: QuestionFormData) => {
      const payload = {
        subjectId: data.subjectId,
        type: data.type,
        difficulty: data.difficulty,
        prompt: data.prompt,
        explanation: data.explanation || undefined,
        points: data.points,
        negativePoints: data.negativePoints,
        tags: data.tags ? data.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        options: needsOptions(data.type) ? data.options.map((o, i) => ({ ...o, sortOrder: i })) : undefined,
      };
      return questionsService.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions'] });
      toast.success('Question created successfully');
      handleCloseSheet();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create question');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: QuestionFormData) => {
      const payload = {
        subjectId: data.subjectId,
        type: data.type,
        difficulty: data.difficulty,
        prompt: data.prompt,
        explanation: data.explanation || undefined,
        points: data.points,
        negativePoints: data.negativePoints,
        tags: data.tags ? data.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        options: needsOptions(data.type) ? data.options.map((o, i) => ({ ...o, sortOrder: i })) : undefined,
      };
      return questionsService.update(editingId!, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions'] });
      toast.success('Question updated successfully');
      handleCloseSheet();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update question');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => questionsService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions'] });
      toast.success('Question deleted successfully');
      setDeletingId(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete question');
    },
  });

  function handleCloseSheet() {
    setSheetOpen(false);
    setEditingId(null);
    setForm({ ...emptyForm, options: [{ label: 'A', text: '', isCorrect: false }] });
  }

  function handleEdit(q: Question) {
    setEditingId(q.id);
    setForm({
      subjectId: q.subjectId,
      type: q.type,
      difficulty: q.difficulty,
      prompt: q.prompt,
      explanation: q.explanation || '',
      points: Number(q.points),
      negativePoints: Number(q.negativePoints),
      tags: q.tags ? q.tags.replace(/[["\]]/g, '') : '',
      options: q.options.length > 0
        ? q.options.map(o => ({ label: o.label, text: o.text, isCorrect: o.isCorrect ?? false }))
        : [{ label: 'A', text: '', isCorrect: false }],
    });
    setSheetOpen(true);
  }

  function handleSave() {
    if (!form.subjectId) { toast.error('Please select a subject'); return; }
    if (!form.prompt.trim()) { toast.error('Prompt is required'); return; }
    if (needsOptions(form.type) && form.options.some(o => !o.text.trim())) {
      toast.error('All options must have text');
      return;
    }
    if (needsOptions(form.type) && !form.options.some(o => o.isCorrect)) {
      toast.error('At least one option must be marked correct');
      return;
    }

    if (editingId) {
      updateMutation.mutate(form);
    } else {
      createMutation.mutate(form);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (isLoading) return <SkeletonTable />;
  if (error) return <ErrorState message="Failed to load questions" onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Question bank</h1>
          <p className="text-sm text-muted-foreground">
            Create, edit, tag, categorize, and reuse questions across exams.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">Instructor</Badge>
          <Button onClick={() => { setEditingId(null); setForm({ ...emptyForm, options: [{ label: 'A', text: '', isCorrect: false }] }); setSheetOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Add Question
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-1.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Search questions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">All types</option>
          {types.map((t) => (
            <option key={t} value={t}>{typeLabels[t] ?? t}</option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={difficultyFilter}
          onChange={(e) => setDifficultyFilter(e.target.value)}
        >
          <option value="">All difficulties</option>
          {difficulties.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
        >
          <option value="">All subjects</option>
          {questionSubjects.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState onAdd={() => { setEditingId(null); setForm({ ...emptyForm, options: [{ label: 'A', text: '', isCorrect: false }] }); setSheetOpen(true); }} />
      ) : (
        <div className="rounded-lg border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium">Prompt</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Difficulty</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Subject</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Points</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                <th className="w-24 px-4 py-3 text-left text-sm font-medium">Actions</th>
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((q) => (
                <Fragment key={q.id}>
                  <tr
                    className="border-b hover:bg-muted/50 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
                  >
                    <td className="max-w-xs truncate px-4 py-3 text-sm">{q.prompt}</td>
                    <td className="px-4 py-3 text-sm">
                      <Badge variant="outline">{typeLabels[q.type] ?? q.type}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${difficultyColors[q.difficulty] ?? ''}`}>
                        {q.difficulty}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {q.subject?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm">{Number(q.points)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={q.isActive ? 'success' : 'secondary'}>
                        {q.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(q)} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeletingId(q.id)} title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {expandedId === q.id ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </td>
                  </tr>
                  {expandedId === q.id && (
                    <tr className="border-b bg-muted/20">
                      <td colSpan={8} className="px-6 py-4">
                        <ExpandableQuestion q={q} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={(open) => { if (!open) handleCloseSheet(); }}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingId ? 'Edit Question' : 'Add Question'}</SheetTitle>
            <SheetDescription>
              {editingId ? 'Update the question details below.' : 'Fill in the details to create a new question.'}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-5">
            <div>
              <label className="mb-1 block text-sm font-medium">Subject *</label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={form.subjectId}
                onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
              >
                <option value="">Select subject</option>
                {subjects?.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Type *</label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value, options: needsOptions(e.target.value) ? [{ label: 'A', text: '', isCorrect: false }] : [] })}
                >
                  {typeOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Difficulty</label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.difficulty}
                  onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                >
                  {difficultyOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Prompt *</label>
              <textarea
                className="min-h-[100px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={form.prompt}
                onChange={(e) => setForm({ ...form, prompt: e.target.value })}
                placeholder="Enter the question text..."
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Explanation</label>
              <textarea
                className="min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={form.explanation}
                onChange={(e) => setForm({ ...form, explanation: e.target.value })}
                placeholder="Explain the correct answer (shown after answering)..."
              />
            </div>

            {needsOptions(form.type) && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium">Options</label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const nextLabel = String.fromCharCode(65 + form.options.length);
                      setForm({ ...form, options: [...form.options, { label: nextLabel, text: '', isCorrect: false }] });
                    }}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Add option
                  </Button>
                </div>
                <div className="space-y-2">
                  {form.options.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="w-5 text-center text-sm font-mono text-muted-foreground">{opt.label}.</span>
                      <input
                        className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
                        value={opt.text}
                        onChange={(e) => {
                          const newOpts = [...form.options];
                          newOpts[idx] = { ...newOpts[idx], text: e.target.value };
                          setForm({ ...form, options: newOpts });
                        }}
                        placeholder="Option text..."
                      />
                      <label className="flex items-center gap-1 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={opt.isCorrect}
                          onChange={(e) => {
                            const newOpts = [...form.options];
                            if (form.type === 'TRUE_FALSE') {
                              newOpts.forEach((o, i) => { newOpts[i] = { ...o, isCorrect: i === idx }; });
                            } else {
                              newOpts[idx] = { ...newOpts[idx], isCorrect: e.target.checked };
                            }
                            setForm({ ...form, options: newOpts });
                          }}
                        />
                        Correct
                      </label>
                      {form.options.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setForm({ ...form, options: form.options.filter((_, i) => i !== idx) })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Points</label>
                <input
                  type="number"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.points}
                  min={0}
                  onChange={(e) => setForm({ ...form, points: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Negative points</label>
                <input
                  type="number"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.negativePoints}
                  min={0}
                  onChange={(e) => setForm({ ...form, negativePoints: Number(e.target.value) })}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Tags (comma separated)</label>
              <input
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="e.g. algebra, beginner, quiz1"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button onClick={handleSave} disabled={isSaving} className="flex-1">
                {isSaving ? 'Saving...' : editingId ? 'Update Question' : 'Create Question'}
              </Button>
              <Button variant="outline" onClick={handleCloseSheet} disabled={isSaving}>
                Cancel
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDeletingId(null)}>
          <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">Delete Question</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Are you sure you want to deactivate this question? It will be marked as inactive.
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeletingId(null)} disabled={deleteMutation.isPending}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => deleteMutation.mutate(deletingId)} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
