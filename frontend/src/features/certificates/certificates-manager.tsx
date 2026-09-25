'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { certificatesService } from '@/services/certificates.service';
import { examsService } from '@/services/exams.service';
import { resultsService } from '@/services/results.service';
import { toast } from 'sonner';
import { Award, Loader2, RotateCcw, ShieldOff } from 'lucide-react';

const PAGE_SIZE = 20;

function studentName(student?: { firstName: string; lastName: string }) {
  return student ? `${student.firstName} ${student.lastName}` : null;
}

export function CertificatesManager({ role }: { role: 'Instructor' | 'Admin' }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'issued' | 'eligible'>('issued');
  const [examFilter, setExamFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data: exams } = useQuery({
    queryKey: ['exams'],
    queryFn: () => examsService.list(),
  });

  const certificatesQuery = useQuery({
    queryKey: ['certificates', examFilter, page],
    queryFn: () =>
      certificatesService.list({
        page,
        limit: PAGE_SIZE,
        ...(examFilter ? { examId: examFilter } : {}),
      }),
    enabled: tab === 'issued',
  });

  const eligibleQuery = useQuery({
    queryKey: ['certificates', 'eligible', examFilter, page],
    queryFn: () =>
      resultsService.list({
        page,
        limit: PAGE_SIZE,
        passed: true,
        certificateStatus: 'none',
        ...(examFilter ? { examId: examFilter } : {}),
      }),
    enabled: tab === 'eligible',
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['certificates'] });
    queryClient.invalidateQueries({ queryKey: ['results'] });
  };

  const issueMutation = useMutation({
    mutationFn: (resultId: string) => certificatesService.issue(resultId),
    onSuccess: () => {
      invalidate();
      toast.success('Certificate issued');
    },
    onError: (err: Error) => toast.error(err?.message || 'Failed to issue certificate'),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => certificatesService.revoke(id),
    onSuccess: () => {
      invalidate();
      toast.success('Certificate revoked');
    },
    onError: (err: Error) => toast.error(err?.message || 'Failed to revoke certificate'),
  });

  const reissueMutation = useMutation({
    mutationFn: (id: string) => certificatesService.reissue(id),
    onSuccess: () => {
      invalidate();
      toast.success('Certificate reissued with a new verification code');
    },
    onError: (err: Error) => toast.error(err?.message || 'Failed to reissue certificate'),
  });

  const certificates = certificatesQuery.data?.data ?? [];
  const eligible = eligibleQuery.data?.data ?? [];
  const pagination =
    tab === 'issued' ? certificatesQuery.data?.pagination : eligibleQuery.data?.pagination;
  const isLoading = tab === 'issued' ? certificatesQuery.isLoading : eligibleQuery.isLoading;
  const error = tab === 'issued' ? certificatesQuery.error : eligibleQuery.error;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Certificates</h1>
          <p className="text-sm text-muted-foreground">
            Issue certificates for passed results, reissue replacements, or revoke invalid ones.
          </p>
        </div>
        <Badge variant="secondary">{role}</Badge>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-md border p-0.5">
          <button
            type="button"
            onClick={() => {
              setTab('issued');
              setPage(1);
            }}
            className={`rounded px-3 py-1.5 text-sm font-medium ${
              tab === 'issued' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
            }`}
          >
            Issued
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('eligible');
              setPage(1);
            }}
            className={`rounded px-3 py-1.5 text-sm font-medium ${
              tab === 'eligible' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
            }`}
          >
            Awaiting issue
          </button>
        </div>
        <select
          className="h-10 w-full max-w-xs rounded-md border bg-background px-3 text-sm"
          value={examFilter}
          onChange={(e) => {
            setExamFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All exams</option>
          {exams?.map((exam) => (
            <option key={exam.id} value={exam.id}>
              {exam.title}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="space-y-4 p-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm font-medium text-destructive">Failed to load certificates</p>
            <p className="text-sm text-muted-foreground">Please try again later.</p>
          </CardContent>
        </Card>
      ) : tab === 'issued' ? (
        certificates.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <Award className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-medium">No certificates issued yet</p>
              <p className="text-sm text-muted-foreground">
                Switch to &ldquo;Awaiting issue&rdquo; to issue one for a passed result.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-sm font-medium">Student</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Exam</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Score</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Certificate no</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Issued</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {certificates.map((certificate) => {
                    const student = certificate.result?.submission?.session?.student;
                    return (
                      <tr key={certificate.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="px-4 py-3 text-sm">{studentName(student) ?? 'Unknown'}</td>
                        <td className="px-4 py-3 text-sm font-medium">{certificate.result?.exam.title}</td>
                        <td className="px-4 py-3 text-sm">
                          {certificate.result?.score}
                          <span className="text-muted-foreground"> / {certificate.result?.maxScore}</span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className="font-medium">{certificate.certificateNo}</span>
                          <span className="block font-mono text-[10px] text-muted-foreground">
                            {certificate.verificationCode}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {new Date(certificate.issuedAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Reissue with a new verification code"
                              onClick={() => reissueMutation.mutate(certificate.id)}
                              disabled={reissueMutation.isPending}
                            >
                              {reissueMutation.isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <RotateCcw className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              title="Revoke"
                              onClick={() => revokeMutation.mutate(certificate.id)}
                              disabled={revokeMutation.isPending}
                            >
                              {revokeMutation.isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <ShieldOff className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )
      ) : eligible.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Award className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium">Nothing awaiting a certificate</p>
            <p className="text-sm text-muted-foreground">
              Passed results without a certificate will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left text-sm font-medium">Student</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Exam</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Score</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Percentage</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {eligible.map((result) => {
                  const student = result.submission?.session?.student;
                  return (
                    <tr key={result.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="px-4 py-3 text-sm">{studentName(student) ?? 'Unknown'}</td>
                      <td className="px-4 py-3 text-sm font-medium">{result.exam.title}</td>
                      <td className="px-4 py-3 text-sm">
                        {result.score}
                        <span className="text-muted-foreground"> / {result.maxScore}</span>
                      </td>
                      <td className="px-4 py-3 text-sm">{Number(result.percentage).toFixed(1)}%</td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          onClick={() => issueMutation.mutate(result.id)}
                          disabled={issueMutation.isPending}
                        >
                          {issueMutation.isPending ? (
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Award className="mr-2 h-3.5 w-3.5" />
                          )}
                          Issue
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(p - 1, 1))} disabled={page <= 1}>
            Previous
          </Button>
          <span>
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= pagination.totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
