'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FileText, SearchX } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { resultsService } from '@/services/results.service';
import type { Result } from '@/types/api';

function ResultDetailCard({ result, onBack }: { result: Result; onBack: () => void }) {
  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        Back to results
      </Button>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">{result.exam.title}</CardTitle>
              <CardDescription>
                {result.exam.course.subject.name} &middot; {result.exam.course.name}
              </CardDescription>
            </div>
            <Badge variant={result.passed ? 'success' : 'warning'}>
              {result.passed ? 'PASS' : 'FAIL'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border p-4 text-center">
              <p className="text-sm text-muted-foreground">Score</p>
              <p className="text-2xl font-semibold">
                {result.score} / {result.maxScore}
              </p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-sm text-muted-foreground">Percentage</p>
              <p className="text-2xl font-semibold">{Number(result.percentage).toFixed(1)}%</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-sm text-muted-foreground">Grade</p>
              <p className="text-2xl font-semibold">{result.grade ?? 'N/A'}</p>
            </div>
          </div>
          {result.feedback && (
            <div>
              <p className="mb-1 text-sm font-medium">Feedback</p>
              <p className="text-sm text-muted-foreground">{result.feedback}</p>
            </div>
          )}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Published: {result.publishedAt ? new Date(result.publishedAt).toLocaleDateString() : 'Not published'}</span>
            <span>Completed: {new Date(result.createdAt).toLocaleDateString()}</span>
          </div>
          {result.certificate && (
            <div className="flex items-center gap-2 text-sm text-emerald-600">
              <FileText className="h-4 w-4" />
              Certificate issued: {result.certificate.certificateNo}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ResultsTable({ results, onSelect }: { results: Result[]; onSelect: (r: Result) => void }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-left font-medium">Exam</th>
            <th className="px-4 py-3 text-left font-medium">Subject</th>
            <th className="px-4 py-3 text-right font-medium">Score</th>
            <th className="px-4 py-3 text-right font-medium">%</th>
            <th className="px-4 py-3 text-center font-medium">Grade</th>
            <th className="px-4 py-3 text-center font-medium">Status</th>
            <th className="px-4 py-3 text-right font-medium">Date</th>
          </tr>
        </thead>
        <tbody>
          {results.map((result) => (
            <tr
              key={result.id}
              className="cursor-pointer border-b transition-colors hover:bg-muted/30"
              onClick={() => onSelect(result)}
            >
              <td className="px-4 py-3 font-medium">{result.exam.title}</td>
              <td className="px-4 py-3 text-muted-foreground">{result.exam.course.subject.name}</td>
              <td className="px-4 py-3 text-right">
                {result.score} / {result.maxScore}
              </td>
              <td className="px-4 py-3 text-right">{Number(result.percentage).toFixed(1)}%</td>
              <td className="px-4 py-3 text-center">{result.grade ?? '—'}</td>
              <td className="px-4 py-3 text-center">
                <Badge variant={result.passed ? 'success' : 'warning'} className="text-xs">
                  {result.passed ? 'Pass' : 'Fail'}
                </Badge>
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground">
                {new Date(result.createdAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function StudentResultsPage() {
  const [selectedResult, setSelectedResult] = useState<Result | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ['student-results'],
    queryFn: () => resultsService.list(),
  });

  if (selectedResult) {
    return (
      <div className="space-y-6">
        <div>
          <Badge variant="outline">Student</Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">Results</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Published marks, grades, pass status, and downloadable transcripts.
          </p>
        </div>
        <ResultDetailCard result={selectedResult} onBack={() => setSelectedResult(null)} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Badge variant="outline">Student</Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">Results</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Published marks, grades, pass status, and downloadable transcripts.
          </p>
        </div>
        <Card>
          <CardContent className="space-y-4 py-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <Badge variant="outline">Student</Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">Results</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <SearchX className="h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium">Failed to load results</p>
            <p className="text-sm text-muted-foreground">Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const results = data?.data ?? [];

  if (results.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <Badge variant="outline">Student</Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">Results</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Published marks, grades, pass status, and downloadable transcripts.
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <FileText className="h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium">No results yet</p>
            <p className="text-sm text-muted-foreground">
              Your exam results will appear here once they are published.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Badge variant="outline">Student</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal">Results</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Published marks, grades, pass status, and downloadable transcripts.
        </p>
      </div>
      <ResultsTable results={results} onSelect={setSelectedResult} />
    </div>
  );
}
