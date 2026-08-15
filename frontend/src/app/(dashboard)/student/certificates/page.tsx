'use client';

import { useQueries, useQuery } from '@tanstack/react-query';
import { Award, Download, SearchX, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { certificatesService } from '@/services/certificates.service';
import { resultsService } from '@/services/results.service';
import type { Certificate, Result } from '@/types/api';

function CertificateCard({ certificate }: { certificate: Certificate }) {
  return (
    <Card className="transition-colors hover:border-primary/50">
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-500" />
            <CardTitle>{certificate.result?.exam.title ?? 'Certificate'}</CardTitle>
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
          {certificate.fileUrl && (
            <Button variant="outline" size="sm" className="mt-2 w-full gap-2" asChild>
              <a href={certificate.fileUrl} target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4" />
                Download certificate
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function CertificatesPage() {
  const certificatesQuery = useQuery({
    queryKey: ['student-certificates'],
    queryFn: certificatesService.list,
    retry: false,
  });

  const resultsQuery = useQuery({
    queryKey: ['student-results-for-certificates'],
    queryFn: () => resultsService.list(),
    retry: false,
    enabled: certificatesQuery.isError,
  });

  const isLoading = certificatesQuery.isLoading || resultsQuery.isLoading;
  const hasError = certificatesQuery.isError && resultsQuery.isError;

  let certificates: Certificate[] = [];

  if (certificatesQuery.data && Array.isArray(certificatesQuery.data)) {
    certificates = certificatesQuery.data;
  } else if (resultsQuery.data?.data) {
    certificates = resultsQuery.data.data
      .filter((r: Result) => r.certificate)
      .map((r: Result) => r.certificate!);
  }

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
    return (
      <div className="space-y-6">
        <div>
          <Badge variant="outline" className="border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400">Student</Badge>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Certificates</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <SearchX className="h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium">Could not load certificates</p>
            <p className="text-sm text-muted-foreground">
              The certificates service is currently unavailable.
            </p>
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
