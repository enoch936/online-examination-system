'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { authService } from '@/services/auth.service';

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);

  const handleVerify = async () => {
    if (!token) {
      setError('Missing verification token in URL.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await authService.verifyEmail({ token });
      setVerified(true);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to verify email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Verify email</CardTitle>
        <CardDescription>Confirm your address before high-stakes exam access.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {verified ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-green-600">Email verified successfully!</p>
            <Button onClick={() => router.push('/login')} className="w-full">
              Go to login
            </Button>
          </div>
        ) : (
          <>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" onClick={handleVerify} disabled={loading}>
              {loading ? 'Verifying...' : 'Verify email'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading...</div>}>
        <VerifyEmailForm />
      </Suspense>
    </main>
  );
}
