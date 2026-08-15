'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, useRef } from 'react';
import { toast } from 'sonner';
import { questionsService } from '@/services/questions.service';
import { questionBanksService } from '@/services/question-banks.service';
import { subjectsService } from '@/services/subjects.service';
import { coursesService } from '@/services/courses.service';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import {
  ArrowLeft, ArrowUp, ArrowDown, Copy, FileQuestion, Library, Pencil, Plus, Search, Trash2,
  Upload, Download, ChevronDown, ChevronRight,
} from 'lucide-react';
import type { Question, QuestionBank, Subject, Course } from '@/types/api';

const typeLabels: Record<string, string> = {
  MULTIPLE_CHOICE: 'Multiple Choice',
  MULTIPLE_SELECT: 'Multiple Select',
  TRUE_FALSE: 'True/False',
  FILL_BLANK: 'Fill in the Blank',
  SHORT_ANSWER: 'Short Answer',
  ESSAY: 'Essay',
  MATCHING: 'Matching',
};

const typeOptions = Object.entries(typeLabels).map(([value, label]) => ({ value, label }));

const difficultyOptions = [
  { value: 'EASY', label: 'Easy' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HARD', label: 'Hard' },
  { value: 'EXPERT', label: 'Expert' },
];

const difficultyColors: Record<string, string> = {
  EASY: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  MEDIUM: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  HARD: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  EXPERT: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
};

const needsOptions = (type: string) =>
  ['MULTIPLE_CHOICE', 'MULTIPLE_SELECT', 'TRUE_FALSE', 'MATCHING'].includes(type);

const hasCorrectAnswer = (type: string) =>
  ['MULTIPLE_CHOICE', 'MULTIPLE_SELECT', 'TRUE_FALSE', 'MATCHING'].includes(type);

type QuestionFormData = {
  type: string;
  difficulty: string;
  prompt: string;
  explanation: string;
  topic: string;
  imageUrl: string;
  points: number;
  negativePoints: number;
  tags: string;
  options: { label: string; text: string; isCorrect: boolean }[];
};

const emptyForm: QuestionFormData = {
  type: 'MULTIPLE_CHOICE',
  difficulty: 'MEDIUM',
  prompt: '',
  explanation: '',
  topic: '',
  imageUrl: '',
  points: 1,
  negativePoints: 0,
  tags: '',
  options: [{ label: 'A', text: '', isCorrect: false }],
};

type BankFormData = {
  courseId: string;
  categoryId: string;
  name: string;
  description: string;
  difficulty: string;
  status: 'DRAFT' | 'PUBLISHED';
};

const emptyBankForm: BankFormData = {
  courseId: '',
  categoryId: '',
  name: '',
  description: '',
  difficulty: 'MEDIUM',
  status: 'DRAFT',
};

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
      <div className="rounded-lg border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b p-4">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}

function BankQuestionsView({
  bank,
  subjects,
  onBack,
}: {
  bank: QuestionBank;
  subjects?: Subject[];
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [topicFilter, setTopicFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<QuestionFormData>({ ...emptyForm });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['question-banks', bank.id, 'questions'],
    queryFn: () => questionBanksService.getQuestions(bank.id),
  });

  const questions = data?.questions ?? [];
  const topics = data?.topics ?? [];

  const filtered = useMemo(() => {
    return questions.filter((q) => {
      if (typeFilter && q.type !== typeFilter) return false;
      if (difficultyFilter && q.difficulty !== difficultyFilter) return false;
      if (topicFilter && q.topic !== topicFilter) return false;
      if (searchQuery && !q.prompt.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [questions, typeFilter, difficultyFilter, topicFilter, searchQuery]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['question-banks'] });
    queryClient.invalidateQueries({ queryKey: ['question-banks', bank.id, 'questions'] });
    queryClient.invalidateQueries({ queryKey: ['questions'] });
  };

  const createMutation = useMutation({
    mutationFn: (data: QuestionFormData) =>
      questionsService.create({ ...toQuestionPayload(data, bank.categoryId), questionBankId: bank.id }),
    onSuccess: () => { invalidate(); toast.success('Question added successfully'); closeSheet(); },
    onError: (err: Error) => toast.error(err.message || 'Failed to add question'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: QuestionFormData) =>
      questionsService.update(editingId!, toQuestionPayload(data, bank.categoryId)),
    onSuccess: () => { invalidate(); toast.success('Question updated successfully'); closeSheet(); },
    onError: (err: Error) => toast.error(err.message || 'Failed to update question'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => questionsService.remove(id),
    onSuccess: () => { invalidate(); toast.success('Question deleted'); setDeletingId(null); },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete question'),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => questionBanksService.bulkDeleteQuestions(bank.id, ids),
    onSuccess: (res) => { invalidate(); toast.success(`Deleted ${res.deleted} question(s)`); setSelectedIds([]); },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete questions'),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => questionBanksService.duplicateQuestion(bank.id, id),
    onSuccess: () => { invalidate(); toast.success('Question duplicated'); },
    onError: (err: Error) => toast.error(err.message || 'Failed to duplicate question'),
  });

  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) => questionBanksService.reorderQuestions(bank.id, ids),
    onSuccess: () => { invalidate(); toast.success('Question order updated'); },
    onError: (err: Error) => toast.error(err.message || 'Failed to reorder questions'),
  });

  const importMutation = useMutation({
    mutationFn: (items: Parameters<typeof questionBanksService.importQuestions>[1]) =>
      questionBanksService.importQuestions(bank.id, items),
    onSuccess: (res) => { invalidate(); toast.success(`Imported ${res.count} question(s)`); },
    onError: (err: Error) => toast.error(err.message || 'Failed to import questions'),
  });

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= filtered.length) return;
    const reordered = [...filtered];
    const baseOrder = questions.map((q) => q.id);
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const movedIds = reordered.map((q) => q.id);
    const rest = baseOrder.filter((id) => !movedIds.includes(id));
    reorderMutation.mutate([...movedIds, ...rest]);
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  };

  const startAdd = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setSheetOpen(true);
  };

  function startEdit(q: Question) {
    setEditingId(q.id);
    setForm({
      type: q.type,
      difficulty: q.difficulty,
      prompt: q.prompt,
      explanation: q.explanation || '',
      topic: q.topic || '',
      imageUrl: q.imageUrl || '',
      points: Number(q.points),
      negativePoints: Number(q.negativePoints),
      tags: q.tags !== '[]' && q.tags ? q.tags.replace(/[["\]]/g, '').replace(/,/g, ', ') : '',
      options: q.options.length > 0
        ? q.options.map((o) => ({ label: o.label, text: o.text, isCorrect: o.isCorrect ?? false }))
        : [{ label: 'A', text: '', isCorrect: false }],
    });
    setSheetOpen(true);
  }

  function validateAndSave() {
    if (!form.prompt.trim()) { toast.error('Prompt is required'); return; }
    if (needsOptions(form.type) && form.options.some((o) => !o.text.trim())) {
      toast.error('All options must have text');
      return;
    }
    if (hasCorrectAnswer(form.type) && !form.options.some((o) => o.isCorrect)) {
      toast.error('At least one option must be marked correct');
      return;
    }
    if (editingId) updateMutation.mutate(form);
    else createMutation.mutate(form);
  }

  async function handleImportFile(file: File) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const items = Array.isArray(parsed) ? parsed : parsed.questions;
      if (!Array.isArray(items) || items.length === 0) {
        toast.error('File must contain an array of questions');
        return;
      }
      const mapped = items.map((q: Record<string, unknown>) => ({
        type: String(q.type),
        difficulty: q.difficulty ? String(q.difficulty) : undefined,
        prompt: String(q.prompt),
        explanation: q.explanation ? String(q.explanation) : undefined,
        topic: q.topic ? String(q.topic) : undefined,
        imageUrl: q.imageUrl ? String(q.imageUrl) : undefined,
        points: q.points !== undefined ? Number(q.points) : 1,
        negativePoints: q.negativePoints !== undefined ? Number(q.negativePoints) : 0,
        tags: Array.isArray(q.tags) ? q.tags.map(String) : undefined,
        options: Array.isArray(q.options)
          ? q.options.map((o: Record<string, unknown>, i: number) => ({
              label: String(o.label ?? String.fromCharCode(65 + i)),
              text: String(o.text ?? ''),
              isCorrect: Boolean(o.isCorrect),
              sortOrder: o.sortOrder !== undefined ? Number(o.sortOrder) : i,
            }))
          : undefined,
      }));
      importMutation.mutate(mapped);
    } catch {
      toast.error('Invalid JSON file');
    }
  }

  async function handleExport() {
    try {
      const result = await questionBanksService.exportQuestions(bank.id);
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${bank.name.replace(/\s+/g, '-').toLowerCase()}-questions.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Bank exported');
    } catch {
      toast.error('Failed to export questions');
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{bank.name}</h1>
            <p className="text-sm text-muted-foreground">
              {bank.course?.name} · {bank.category?.name} · {questions.length} question(s)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={bank.status === 'PUBLISHED' ? 'success' : 'secondary'}>{bank.status}</Badge>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-1.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Search questions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select className="h-10 rounded-md border bg-background px-3 text-sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          {typeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="h-10 rounded-md border bg-background px-3 text-sm" value={difficultyFilter} onChange={(e) => setDifficultyFilter(e.target.value)}>
          <option value="">All difficulties</option>
          {difficultyOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="h-10 rounded-md border bg-background px-3 text-sm" value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)}>
          <option value="">All topics</option>
          {topics.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={startAdd}>
          <Plus className="mr-1 h-4 w-4" />
          Add Question
        </Button>
        <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
          <Upload className="mr-1 h-4 w-4" />
          Import
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImportFile(f);
            e.target.value = '';
          }}
        />
        <Button size="sm" variant="outline" onClick={handleExport}>
          <Download className="mr-1 h-4 w-4" />
          Export
        </Button>
        {selectedIds.length > 0 && (
          <Button size="sm" variant="destructive" onClick={() => bulkDeleteMutation.mutate(selectedIds)} disabled={bulkDeleteMutation.isPending}>
            <Trash2 className="mr-1 h-4 w-4" />
            Bulk delete ({selectedIds.length})
          </Button>
        )}
      </div>

      {isLoading ? (
        <SkeletonTable />
      ) : error ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/50 bg-destructive/5 py-12 text-center">
          <FileQuestion className="h-12 w-12 text-destructive mb-3" />
          <p className="text-lg font-medium text-destructive">Failed to load questions</p>
          <Button variant="outline" className="mt-4" onClick={() => refetch()}>Retry</Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <FileQuestion className="h-12 w-12 text-muted-foreground mb-3" />
          <p className="text-lg font-medium">No questions found</p>
          <p className="text-sm text-muted-foreground mt-1">Add a question to this bank to get started.</p>
          <Button className="mt-4" onClick={startAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add Question
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={filtered.length > 0 && filtered.every((q) => selectedIds.includes(q.id))}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedIds(filtered.map((q) => q.id));
                      else setSelectedIds([]);
                    }}
                  />
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">#</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Prompt</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Topic</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Difficulty</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Marks</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((q, idx) => (
                <QuestionRow
                  key={q.id}
                  q={q}
                  index={idx}
                  selected={selectedIds.includes(q.id)}
                  expanded={expandedId === q.id}
                  onToggleSelect={() =>
                    setSelectedIds((prev) => prev.includes(q.id) ? prev.filter((x) => x !== q.id) : [...prev, q.id])
                  }
                  onToggleExpand={() => setExpandedId(expandedId === q.id ? null : q.id)}
                  onEdit={() => startEdit(q)}
                  onDelete={() => setDeletingId(q.id)}
                  onDuplicate={() => duplicateMutation.mutate(q.id)}
                  onMoveUp={() => move(idx, -1)}
                  onMoveDown={() => move(idx, 1)}
                  subjects={subjects}
                  isFirst={idx === 0}
                  isLast={idx === filtered.length - 1}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={(open) => { if (!open) closeSheet(); }}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingId ? 'Edit Question' : 'Add Question'}</SheetTitle>
            <SheetDescription>
              {editingId ? 'Update the question details below.' : 'Fill in the details to add a question to this bank.'}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-5">
            <div>
              <label className="mb-1 block text-sm font-medium">Subject</label>
              <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                {bank.category?.name ?? '—'} (from bank)
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Type *</label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value, options: needsOptions(e.target.value) ? defaultOptionsFor(e.target.value) : [] })}
                >
                  {typeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Difficulty</label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.difficulty}
                  onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                >
                  {difficultyOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Question text *</label>
              <textarea
                className="min-h-[100px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={form.prompt}
                onChange={(e) => setForm({ ...form, prompt: e.target.value })}
                placeholder="Enter the question text..."
              />
            </div>

            {needsOptions(form.type) && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium">Answer options</label>
                  {form.type !== 'TRUE_FALSE' && (
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
                  )}
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
                        placeholder={form.type === 'TRUE_FALSE' ? (idx === 0 ? 'True' : 'False') : 'Option text...'}
                        disabled={form.type === 'TRUE_FALSE'}
                      />
                      {hasCorrectAnswer(form.type) && (
                        <label className="flex items-center gap-1 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={opt.isCorrect}
                            onChange={(e) => {
                              const newOpts = [...form.options];
                              if (form.type === 'MULTIPLE_CHOICE' || form.type === 'TRUE_FALSE') {
                                newOpts.forEach((o, i) => { newOpts[i] = { ...o, isCorrect: i === idx }; });
                              } else {
                                newOpts[idx] = { ...newOpts[idx], isCorrect: e.target.checked };
                              }
                              setForm({ ...form, options: newOpts });
                            }}
                          />
                          Correct
                        </label>
                      )}
                      {form.type !== 'TRUE_FALSE' && form.options.length > 1 && (
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

            <div>
              <label className="mb-1 block text-sm font-medium">Explanation</label>
              <textarea
                className="min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={form.explanation}
                onChange={(e) => setForm({ ...form, explanation: e.target.value })}
                placeholder="Explain the correct answer (shown after answering)..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Topic / Chapter</label>
                <input
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.topic}
                  onChange={(e) => setForm({ ...form, topic: e.target.value })}
                  placeholder="e.g. Cell Biology"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Image URL</label>
                <input
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.imageUrl}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  placeholder="Optional image URL"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Marks</label>
                <input
                  type="number"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.points}
                  min={0}
                  onChange={(e) => setForm({ ...form, points: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Negative marks</label>
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
                placeholder="e.g. biology, cells, chapter-1"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button onClick={validateAndSave} disabled={isSaving} className="flex-1">
                {isSaving ? 'Saving...' : editingId ? 'Update Question' : 'Add Question'}
              </Button>
              <Button variant="outline" onClick={closeSheet} disabled={isSaving}>Cancel</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDeletingId(null)}>
          <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">Delete Question</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Are you sure you want to delete this question? It will be removed from the bank and marked as inactive.
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeletingId(null)} disabled={deleteMutation.isPending}>Cancel</Button>
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

function QuestionRow({
  q, index, selected, expanded, onToggleSelect, onToggleExpand, onEdit, onDelete, onDuplicate,
  onMoveUp, onMoveDown, subjects, isFirst, isLast,
}: {
  q: Question;
  index: number;
  selected: boolean;
  expanded: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  subjects?: Subject[];
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <>
      <tr className="border-b hover:bg-muted/50">
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <input type="checkbox" className="h-4 w-4" checked={selected} onChange={onToggleSelect} />
        </td>
        <td className="px-4 py-3 text-sm text-muted-foreground">{index + 1}</td>
        <td className="max-w-xs truncate px-4 py-3 text-sm">
          <button className="text-left font-medium hover:underline" onClick={onToggleExpand}>{q.prompt}</button>
        </td>
        <td className="px-4 py-3 text-sm text-muted-foreground">{q.topic || '—'}</td>
        <td className="px-4 py-3 text-sm">
          <Badge variant="outline">{typeLabels[q.type] ?? q.type}</Badge>
        </td>
        <td className="px-4 py-3 text-sm">
          <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${difficultyColors[q.difficulty] ?? ''}`}>
            {q.difficulty}
          </span>
        </td>
        <td className="px-4 py-3 text-sm">{Number(q.points)}</td>
        <td className="px-4 py-3">
          <Badge variant={q.isActive ? 'success' : 'secondary'}>{q.isActive ? 'Active' : 'Inactive'}</Badge>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveUp} disabled={isFirst} title="Move up">
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveDown} disabled={isLast} title="Move down">
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit} title="Edit">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDuplicate} title="Duplicate">
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete} title="Delete">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </td>
        <td className="px-4 py-3">
          <button onClick={onToggleExpand} aria-label="Expand">
            {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b bg-muted/20">
          <td colSpan={10} className="px-6 py-4">
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-semibold mb-1">Prompt</h4>
                <p className="text-sm whitespace-pre-wrap">{q.prompt}</p>
              </div>
              {q.imageUrl && (
                <div>
                  <h4 className="text-sm font-semibold mb-1">Image</h4>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={q.imageUrl} alt="Question" className="max-h-48 rounded border" />
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
              {q.explanation && (
                <div>
                  <h4 className="text-sm font-semibold mb-1">Explanation</h4>
                  <p className="text-sm text-muted-foreground">{q.explanation}</p>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span>Subject: {q.subject?.name ?? subjects?.find((s) => s.id === q.subjectId)?.name ?? '—'}</span>
                <span>Topic: {q.topic || '—'}</span>
                <span>Tags: {q.tags !== '[]' && q.tags ? q.tags.replace(/[["\]]/g, '') : '—'}</span>
                {q.createdBy && <span>Created by: {q.createdBy.firstName} {q.createdBy.lastName}</span>}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function defaultOptionsFor(type: string) {
  if (type === 'TRUE_FALSE') {
    return [
      { label: 'A', text: 'True', isCorrect: false },
      { label: 'B', text: 'False', isCorrect: false },
    ];
  }
  return [{ label: 'A', text: '', isCorrect: false }];
}

function toQuestionPayload(form: QuestionFormData, subjectId: string) {
  return {
    subjectId,
    type: form.type,
    difficulty: form.difficulty,
    prompt: form.prompt,
    explanation: form.explanation || undefined,
    topic: form.topic || undefined,
    imageUrl: form.imageUrl || undefined,
    points: form.points,
    negativePoints: form.negativePoints,
    tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    options: needsOptions(form.type) ? form.options.map((o, i) => ({ ...o, sortOrder: i })) : undefined,
  };
}

export default function QuestionBanksPage() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<{ type: 'list' } | { type: 'manage'; bankId: string }>({ type: 'list' });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [bankSheetOpen, setBankSheetOpen] = useState(false);
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
  const [deletingBankId, setDeletingBankId] = useState<string | null>(null);
  const [bankForm, setBankForm] = useState<BankFormData>({ ...emptyBankForm });

  const { data: banks, isLoading, error, refetch } = useQuery({
    queryKey: ['question-banks'],
    queryFn: () => questionBanksService.list({ search: searchQuery || undefined, status: statusFilter || undefined }),
  });

  const { data: courses } = useQuery({
    queryKey: ['courses'],
    queryFn: () => coursesService.list(),
  });

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectsService.list(),
  });

  const activeBank = view.type === 'manage' ? banks?.find((b) => b.id === view.bankId) : undefined;

  const invalidateBanks = () => queryClient.invalidateQueries({ queryKey: ['question-banks'] });

  const createBankMutation = useMutation({
    mutationFn: (data: BankFormData) => questionBanksService.create({ ...data, description: data.description || undefined, difficulty: data.difficulty || undefined }),
    onSuccess: () => { invalidateBanks(); toast.success('Question bank created'); closeBankSheet(); },
    onError: (err: Error) => toast.error(err.message || 'Failed to create bank'),
  });

  const updateBankMutation = useMutation({
    mutationFn: (data: BankFormData) => questionBanksService.update(editingBankId!, { ...data, description: data.description || undefined, difficulty: data.difficulty || undefined }),
    onSuccess: () => { invalidateBanks(); toast.success('Question bank updated'); closeBankSheet(); },
    onError: (err: Error) => toast.error(err.message || 'Failed to update bank'),
  });

  const deleteBankMutation = useMutation({
    mutationFn: (id: string) => questionBanksService.remove(id),
    onSuccess: () => {
      invalidateBanks();
      toast.success('Question bank deleted');
      setDeletingBankId(null);
      if (view.type === 'manage' && view.bankId === deletingBankId) setView({ type: 'list' });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete bank'),
  });

  const duplicateBankMutation = useMutation({
    mutationFn: (id: string) => questionBanksService.duplicate(id),
    onSuccess: () => { invalidateBanks(); toast.success('Question bank duplicated'); },
    onError: (err: Error) => toast.error(err.message || 'Failed to duplicate bank'),
  });

  function closeBankSheet() {
    setBankSheetOpen(false);
    setEditingBankId(null);
    setBankForm({ ...emptyBankForm });
  }

  function startCreateBank() {
    setEditingBankId(null);
    setBankForm({ ...emptyBankForm });
    setBankSheetOpen(true);
  }

  function startEditBank(b: QuestionBank) {
    setEditingBankId(b.id);
    setBankForm({
      courseId: b.courseId,
      categoryId: b.categoryId,
      name: b.name,
      description: b.description || '',
      difficulty: b.difficulty || 'MEDIUM',
      status: b.status,
    });
    setBankSheetOpen(true);
  }

  function validateAndSaveBank() {
    if (!bankForm.courseId) { toast.error('Please select a course'); return; }
    if (!bankForm.categoryId) { toast.error('Please select a category'); return; }
    if (!bankForm.name.trim()) { toast.error('Please enter a bank name'); return; }
    if (editingBankId) updateBankMutation.mutate(bankForm);
    else createBankMutation.mutate(bankForm);
  }

  const filteredBanks = useMemo(() => {
    const list = banks ?? [];
    if (!searchQuery && !statusFilter) return list;
    return list;
  }, [banks, searchQuery, statusFilter]);

  const categoriesForCourse = (courseId: string) =>
    (courses ?? []).find((c: Course) => c.id === courseId)?.subjectId ?? '';

  if (view.type === 'manage' && activeBank) {
    return <BankQuestionsView bank={activeBank} subjects={subjects} onBack={() => setView({ type: 'list' })} />;
  }

  if (isLoading) return <SkeletonTable />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Question Banks</h1>
          <p className="text-sm text-muted-foreground">
            Organize questions into reusable banks by course and category.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">Instructor</Badge>
          <Button onClick={startCreateBank}>
            <Plus className="mr-2 h-4 w-4" />
            Create Question Bank
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-1.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Search question banks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select className="h-10 rounded-md border bg-background px-3 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
        </select>
      </div>

      {error ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/50 bg-destructive/5 py-12 text-center">
          <Library className="h-12 w-12 text-destructive mb-3" />
          <p className="text-lg font-medium text-destructive">Failed to load question banks</p>
          <Button variant="outline" className="mt-4" onClick={() => refetch()}>Retry</Button>
        </div>
      ) : filteredBanks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <Library className="h-12 w-12 text-muted-foreground mb-3" />
          <p className="text-lg font-medium">No question banks found</p>
          <p className="text-sm text-muted-foreground mt-1">Create a question bank to organize your questions.</p>
          <Button className="mt-4" onClick={startCreateBank}>
            <Plus className="mr-2 h-4 w-4" />
            Create Question Bank
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium">Question Bank</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Course</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Category</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Questions</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBanks.map((b) => (
                <tr key={b.id} className="border-b hover:bg-muted/50">
                  <td className="max-w-xs truncate px-4 py-3">
                    <button className="text-left text-sm font-medium hover:underline" onClick={() => setView({ type: 'manage', bankId: b.id })}>
                      {b.name}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{b.course?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{b.category?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-sm">{b._count?.questions ?? 0}</td>
                  <td className="px-4 py-3">
                    <Badge variant={b.status === 'PUBLISHED' ? 'success' : 'secondary'}>{b.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" onClick={() => setView({ type: 'manage', bankId: b.id })}>
                        Manage
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEditBank(b)} title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => duplicateBankMutation.mutate(b.id)} title="Duplicate">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeletingBankId(b.id)} title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={bankSheetOpen} onOpenChange={(open) => { if (!open) closeBankSheet(); }}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingBankId ? 'Edit Question Bank' : 'Create Question Bank'}</SheetTitle>
            <SheetDescription>
              {editingBankId ? 'Update the bank details below.' : 'Create one bank that can hold many questions.'}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-5">
            <div>
              <label className="mb-1 block text-sm font-medium">Course *</label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={bankForm.courseId}
                onChange={(e) => {
                  const subjectId = categoriesForCourse(e.target.value);
                  setBankForm({ ...bankForm, courseId: e.target.value, categoryId: subjectId });
                }}
              >
                <option value="">Select a course</option>
                {courses?.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Category / Subject *</label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={bankForm.categoryId}
                onChange={(e) => setBankForm({ ...bankForm, categoryId: e.target.value })}
              >
                <option value="">Select a category</option>
                {subjects?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">Category is auto-set to the selected course&apos;s subject.</p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Question Bank Name *</label>
              <input
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={bankForm.name}
                onChange={(e) => setBankForm({ ...bankForm, name: e.target.value })}
                placeholder="e.g. Biology Final Examination Bank"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Description</label>
              <textarea
                className="min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={bankForm.description}
                onChange={(e) => setBankForm({ ...bankForm, description: e.target.value })}
                placeholder="Describe the purpose of this bank..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Difficulty (optional)</label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={bankForm.difficulty}
                  onChange={(e) => setBankForm({ ...bankForm, difficulty: e.target.value })}
                >
                  {difficultyOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Status</label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={bankForm.status}
                  onChange={(e) => setBankForm({ ...bankForm, status: e.target.value as 'DRAFT' | 'PUBLISHED' })}
                >
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button onClick={validateAndSaveBank} disabled={createBankMutation.isPending || updateBankMutation.isPending} className="flex-1">
                {createBankMutation.isPending || updateBankMutation.isPending ? 'Saving...' : editingBankId ? 'Update Bank' : 'Create Bank'}
              </Button>
              <Button variant="outline" onClick={closeBankSheet} disabled={createBankMutation.isPending || updateBankMutation.isPending}>Cancel</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {deletingBankId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDeletingBankId(null)}>
          <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">Delete Question Bank</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Are you sure you want to delete this bank? Its questions will be unlinked but kept.
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeletingBankId(null)} disabled={deleteBankMutation.isPending}>Cancel</Button>
              <Button variant="destructive" onClick={() => deleteBankMutation.mutate(deletingBankId)} disabled={deleteBankMutation.isPending}>
                {deleteBankMutation.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
