'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { useState, useRef, useCallback } from 'react';
import { subjectsService } from '@/services/subjects.service';
import { coursesService } from '@/services/courses.service';
import { api, unwrap } from '@/services/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Upload, FileText, Download, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

function SkeletonForm() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96 mt-2" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full rounded-lg border-2 border-dashed" />
          <Skeleton className="h-10 w-48" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function QuestionImportPage() {
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: subjects, isLoading: subjectsLoading } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectsService.list(),
  });

  const { data: courses, isLoading: coursesLoading } = useQuery({
    queryKey: ['courses'],
    queryFn: () => coursesService.list(),
    enabled: !!selectedSubjectId,
  });

  const filteredCourses = selectedSubjectId
    ? (courses ?? []).filter((c) => c.subjectId === selectedSubjectId)
    : courses ?? [];

  const importMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return unwrap(await api.post('/questions/bulk-import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }));
    },
    onSuccess: () => {
      toast.success('Questions imported successfully');
      setFile(null);
      setSelectedSubjectId('');
      setSelectedCourseId('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Failed to import questions');
    },
  });

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && (droppedFile.type === 'application/json' || droppedFile.name.endsWith('.csv') || droppedFile.name.endsWith('.json'))) {
      setFile(droppedFile);
    } else {
      toast.error('Please upload a JSON or CSV file');
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) setFile(selected);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error('Please select a file to import');
      return;
    }
    if (!selectedSubjectId) {
      toast.error('Please select a subject');
      return;
    }
    if (!selectedCourseId) {
      toast.error('Please select a course');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('subjectId', selectedSubjectId);
    formData.append('courseId', selectedCourseId);
    importMutation.mutate(formData);
  };

  if (subjectsLoading || coursesLoading) return <SkeletonForm />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Question import</h1>
          <p className="text-sm text-muted-foreground">
            Bulk import structured question sets with validation, preview, and error reporting.
          </p>
        </div>
        <Badge variant="secondary">Instructor</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Import questions</CardTitle>
          <CardDescription>
            Upload a JSON or CSV file containing your questions. Each question must have a prompt, type, difficulty, and points.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <select
                id="subject"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={selectedSubjectId}
                onChange={(e) => {
                  setSelectedSubjectId(e.target.value);
                  setSelectedCourseId('');
                }}
                required
              >
                <option value="">Select a subject</option>
                {subjects?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="course">Course</Label>
              <select
                id="course"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                disabled={!selectedSubjectId}
                required
              >
                <option value="">Select a course</option>
                {filteredCourses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {!selectedSubjectId && (
                <p className="text-xs text-muted-foreground">Select a subject first</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>File</Label>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : file
                      ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
                      : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                }`}
              >
                {file ? (
                  <>
                    <CheckCircle className="mb-2 h-10 w-10 text-emerald-500" />
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={() => {
                        setFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                    >
                      Remove
                    </Button>
                  </>
                ) : (
                  <>
                    <Upload className="mb-2 h-10 w-10 text-muted-foreground" />
                    <p className="text-sm font-medium">
                      Drag & drop your file here, or click to browse
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Supports JSON and CSV formats
                    </p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {!file && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Browse files
                  </Button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Download the template file for the correct format.
              </p>
              <Button type="submit" disabled={importMutation.isPending}>
                {importMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {importMutation.isPending ? 'Importing...' : 'Import questions'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Format guide</CardTitle>
          <CardDescription>
            Your file should contain an array of question objects with these fields:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">prompt</code> — The question text</p>
          <p><code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">type</code> — <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">MCQ</code>, <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">TRUE_FALSE</code>, <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">SHORT_ANSWER</code>, or <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">ESSAY</code></p>
          <p><code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">difficulty</code> — <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">EASY</code>, <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">MEDIUM</code>, or <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">HARD</code></p>
          <p><code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">points</code> — Number of points for the question</p>
          <p><code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">options</code> — Array of option objects (required for MCQ type)</p>
        </CardContent>
      </Card>
    </div>
  );
}
