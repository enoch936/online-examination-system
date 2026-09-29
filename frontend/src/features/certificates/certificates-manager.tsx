'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { certificatesService, overrideRequiredFrom } from '@/services/certificates.service';
import { examsService } from '@/services/exams.service';
import { resultsService } from '@/services/results.service';
import { toast } from 'sonner';
import { Award, Loader2, RotateCcw, ShieldAlert, ShieldOff } from 'lucide-react';
import { CertificateOverrideDialog, type OverrideRequest } from './certificate-override-dialog';

const PAGE_SIZE = 20;

function studentName(student?: { firstName: string; lastName: string }) {
  return student ? `${student.firstName} ${student.lastName}` : null;
}

export function CertificatesManager({ role }: { role: 'Instructor' | 'Admin' }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'issued' | 'eligible'>('issued');
  const [examFilter, setExamFilter] = useState('');
  const [page, setPage] = useState(1);
  // Off by default so the awaiting-issue list stays a to-do queue; turning it on
  // surfaces students who can only be certified through a documented override.
  const [showIneligible, setShowIneligible] = useState(false);
  const [override, setOverride] = useState<OverrideRequest | null>(null);

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
    queryKey: ['certificates', 'eligible', examFilter, page, showIneligible],
    queryFn: () =>
      resultsService.list({
        page,
        limit: PAGE_SIZE,
        // Omitting `passed` once ineligible students are shown is what makes
        // manual assignment to a failed result possible.
        ...(showIneligible ? {} : { passed: true }),
        certificateStatus: 'none',
        ...(examFilter ? { examId: examFilter } : {}),
      }),
    enabled: tab === 'eligible',
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['certificates'] });
    queryClient.invalidateQueries({ queryKey: ['results'] });
  };

  type IssueVars = { resultId: string; studentName: string; examTitle: string; overrideReason?: string };
  type ReissueVars = { id: string; studentName: string; examTitle: string; overrideReason?: string };

  // The server owns the eligibility decision. A plain request either succeeds or
  // comes back asking for a justification, at which point the dialog is opened
  // with the server's own wording rather than a guess made in the browser.
  const issueMutation = useMutation({
    mutationFn: ({ resultId, overrideReason }: IssueVars) =>
      certificatesService.issue(resultId, overrideReason),
    onSuccess: () => {
      invalidate();
      setOverride(null);
      toast.success('Certificate issued');
    },
    onError: (err: Error, vars: IssueVars) => {
      const required = overrideRequiredFrom(err);
      if (required) {
        setOverride({
          action: 'issue',
          targetId: vars.resultId,
          studentName: vars.studentName,
          examTitle: vars.examTitle,
          ineligibilityReason: required.message,
          prompt: required.overridePrompt,
          minReasonLength: required.minReasonLength,
        });
        return;
      }
      toast.error(err?.message || 'Failed to issue certificate');
    },
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
    mutationFn: ({ id, overrideReason }: ReissueVars) =>
      certificatesService.reissue(id, overrideReason),
    onSuccess: () => {
      invalidate();
      setOverride(null);
      toast.success('Certificate reissued with a new verification code');
    },
    onError: (err: Error, vars: ReissueVars) => {
      const required = overrideRequiredFrom(err);
      if (required) {
        setOverride({
          action: 'reissue',
          targetId: vars.id,
          studentName: vars.studentName,
          examTitle: vars.examTitle,
          ineligibilityReason: required.message,
          prompt: required.overridePrompt,
          minReasonLength: required.minReasonLength,
        });
        return;
      }
      toast.error(err?.message || 'Failed to reissue certificate');
    },
  });

  const confirmOverride = (reason: string) => {
    if (!override) return;
    if (override.action === 'issue') {
      issueMutation.mutate({
        resultId: override.targetId,
        studentName: override.studentName,
        examTitle: override.examTitle,
        overrideReason: reason,
      });
    } else {
      reissueMutation.mutate({
        id: override.targetId,
        studentName: override.studentName,
        examTitle: override.examTitle,
        overrideReason: reason,
      });
    }
  };

  // Bulk issuance is idempotent, so this doubles as "pick up anything that
  // became eligible since last time" — no confirmation of partial risk needed.
  const generateMutation = useMutation({
    mutationFn: (examId: string) => certificatesService.generateForExam(examId),
    onSuccess: (summary) => {
      invalidate();
      const parts = [`${summary.created} issued`];
      if (summary.alreadyIssued > 0) parts.push(`${summary.alreadyIssued} already had one`);
      if (summary.notPublished > 0) parts.push(`${summary.notPublished} awaiting publication`);
      if (summary.ineligible > 0) parts.push(`${summary.ineligible} not eligible`);
      if (summary.created === 0) {
        toast.warning(`No new certificates. ${parts.join(', ')}.`);
      } else {
        toast.success(`Certificates generated: ${parts.join(', ')}.`);
      }
    },
    onError: (err: Error) => toast.error(err?.message || 'Failed to generate certificates'),
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
        {tab === 'eligible' && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch
              checked={showIneligible}
              onCheckedChange={(checked) => {
                setShowIneligible(checked);
                setPage(1);
              }}
            />
            Include ineligible
          </label>
        )}
        <Button
          variant="outline"
          className="gap-2"
          disabled={!examFilter || generateMutation.isPending}
          onClick={() => generateMutation.mutate(examFilter)}
          title={
            examFilter
              ? 'Issue a certificate for every eligible result of this exam'
              : 'Select an exam to generate certificates for it'
          }
        >
          {generateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Award className="h-4 w-4" />
          )}
          Generate for exam
        </Button>
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
                    <th className="px-4 py-3 text-left text-sm font-medium">Source</th>
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
                        <td className="px-4 py-3 text-sm">
                          {certificate.overrideReason ? (
                            <span
                              className="inline-flex items-center gap-1 font-medium text-destructive"
                              title={`Manual override: ${certificate.overrideReason}`}
                            >
                              <ShieldAlert className="h-3.5 w-3.5" />
                              Override
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              {certificate.assignment === 'MANUAL'
                                ? 'Manual'
                                : certificate.assignment === 'AUTO'
                                  ? 'Automatic'
                                  : 'Bulk'}
                            </span>
                          )}
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
                              onClick={() =>
                                reissueMutation.mutate({
                                  id: certificate.id,
                                  studentName: studentName(student) ?? 'Unknown',
                                  examTitle: certificate.result?.exam.title ?? 'Exam',
                                })
                              }
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
                  <th className="px-4 py-3 text-left text-sm font-medium">Result</th>
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
                      <td className="px-4 py-3 text-sm">
                        {result.passed ? (
                          <Badge variant="secondary">Passed</Badge>
                        ) : (
                          <Badge variant="outline" className="text-destructive">
                            Failed
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          onClick={() =>
                            issueMutation.mutate({
                              resultId: result.id,
                              studentName: studentName(student) ?? 'Unknown',
                              examTitle: result.exam.title,
                            })
                          }
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

      {override && (
        <CertificateOverrideDialog
          request={override}
          pending={issueMutation.isPending || reissueMutation.isPending}
          onCancel={() => setOverride(null)}
          onConfirm={confirmOverride}
        />
      )}
    </div>
  );
}
