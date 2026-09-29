'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Award, Download, Loader2, RefreshCw, SearchX, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { certificatesService, saveBlob } from '@/services/certificates.service';
import type { Certificate } from '@/types/api';

function CertificateCard({ certificate }: { certificate: Certificate }) {
  const [downloading, setDownloading] = useState(false);
  const isExpired = certificate.expired === true;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob = await certificatesService.downloadPdf(certificate.id);
      saveBlob(blob, `certificate-${certificate.certificateNo}.pdf`);
      toast.success('Certificate downloaded');
    } catch {
      toast.error('Failed to download certificate');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card className="transition-colors hover:border-primary/50">
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-500" />
            <CardTitle>{certificate.result?.exam?.title ?? 'Certificate'}</CardTitle>
          </div>
          <CardDescription>No. {certificate.certificateNo}</CardDescription>
        </div>
        <ShieldCheck className="h-5 w-5 text-emerald-500" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Verification code</span>
            <span className="font-mono text-xs">{certificate.verificationCode}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Issued</span>
            <span>{new Date(certificate.issuedAt).toLocaleDateString()}</span>
          </div>
          {certificate.expiresAt && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Expires</span>
              <span className={isExpired ? 'font-medium text-destructive' : undefined}>
                {new Date(certificate.expiresAt).toLocaleDateString()}
                {isExpired ? ' (expired)' : ''}
              </span>
            </div>
          )}
          {certificate.result && (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Score</span>
                <span>
                  {certificate.result.score} ({certificate.result.percentage.toFixed(1)}%)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Grade</span>
                <span>{certificate.result.grade ?? 'N/A'}</span>
              </div>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            className="mt-2 w-full gap-2"
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {downloading ? 'Preparing PDF...' : 'Download certificate'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CertificatesPage() {
  const certificatesQuery = useQuery({
    queryKey: ['certificates', 'student'],
    queryFn: () => certificatesService.list({ limit: 100 }),
    // A dead page is worse than a slow one: a cold Render instance or a dropped
    // TLS handshake answers 5xx/network errors, so retry before surfacing them.
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });

  const isLoading = certificatesQuery.isLoading;
  const hasError = certificatesQuery.isError;
  const certificates: Certificate[] = certificatesQuery.data?.data ?? [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Badge variant="outline" className="border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400">Student</Badge>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Certificates</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Download verified certificates and share verification codes with institutions.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (hasError) {
    // The generic "service unavailable" this used to show hid the actual cause.
    // A 401/403 means the session is not usable on THIS hostname (auth cookies
    // are host-only, so a session never carries between Vercel domains), while
    // anything else is a real API or connectivity fault. Naming it turns an
    // unactionable dead end into a one-step fix.
    const status = axios.isAxiosError(certificatesQuery.error)
      ? (certificatesQuery.error.response?.status ?? null)
      : null;
    const apiMessage = axios.isAxiosError(certificatesQuery.error)
      ? certificatesQuery.error.response?.data?.error?.message
      : undefined;
    const sessionProblem = status === 401 || status === 403;

    return (
      <div className="space-y-6">
        <div>
          <Badge variant="outline" className="border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400">Student</Badge>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Certificates</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <SearchX className="h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium">
              {sessionProblem ? 'Your session is no longer valid' : 'Could not load certificates'}
            </p>
            <p className="max-w-md text-sm text-muted-foreground">
              {sessionProblem
                ? 'Certificates are served per signed-in account. Sign in again on this site to continue.'
                : 'The certificates service did not respond as expected.'}
            </p>
            {(status !== null || apiMessage) && (
              <p className="font-mono text-xs text-muted-foreground">
                {status !== null ? `HTTP ${status}` : 'No response'}
                {apiMessage ? ` — ${apiMessage}` : ''}
              </p>
            )}
            <div className="flex gap-2">
              {sessionProblem ? (
                <Button asChild>
                  <Link href="/login">Sign in</Link>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => void certificatesQuery.refetch()}
                  disabled={certificatesQuery.isFetching}
                >
                  {certificatesQuery.isFetching ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Try again
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (certificates.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <Badge variant="outline" className="border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400">Student</Badge>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Certificates</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Download verified certificates and share verification codes with institutions.
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Award className="h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium">No certificates yet</p>
            <p className="text-sm text-muted-foreground">
              Certificates are awarded for passed exams. Complete and pass an exam to receive one.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Badge variant="outline" className="border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400">Student</Badge>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Certificates</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Download verified certificates and share verification codes with institutions.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {certificates.map((cert) => (
          <CertificateCard key={cert.id} certificate={cert} />
        ))}
      </div>
    </div>
  );
}
