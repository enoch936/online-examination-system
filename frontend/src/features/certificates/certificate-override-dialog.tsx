'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ShieldAlert } from 'lucide-react';

export type OverrideRequest = {
  /** Which mutation to retry with the justification. */
  action: 'issue' | 'reissue';
  /** Result id for `issue`, certificate id for `reissue`. */
  targetId: string;
  studentName: string;
  examTitle: string;
  /** Human-readable eligibility failure the server reported. */
  ineligibilityReason: string;
  prompt: string;
  minReasonLength: number;
};

/**
 * Collects the written justification the backend requires before it will issue a
 * certificate to an ineligible result. The reason is stored on the certificate
 * as a manual override, so it is deliberately explicit about who and why.
 */
export function CertificateOverrideDialog({
  request,
  pending,
  onCancel,
  onConfirm,
}: {
  request: OverrideRequest;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();
  const tooShort = trimmed.length < request.minReasonLength;

  useEffect(() => {
    setReason('');
  }, [request.targetId, request.action]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pending, onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Justify certificate override"
    >
      <div className="w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div>
            <h2 className="text-lg font-semibold">Manual override required</h2>
            <p className="mt-1 text-sm text-muted-foreground">{request.prompt}</p>
          </div>
        </div>

        <dl className="mt-4 space-y-1 rounded-md border bg-muted/40 p-3 text-sm">
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-muted-foreground">Student</dt>
            <dd className="font-medium">{request.studentName}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-muted-foreground">Exam</dt>
            <dd className="font-medium">{request.examTitle}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-muted-foreground">Reason</dt>
            <dd>{request.ineligibilityReason}</dd>
          </div>
        </dl>

        <div className="mt-4 space-y-1">
          <label htmlFor="override-reason" className="text-sm font-medium">
            Justification
          </label>
          <Textarea
            id="override-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Explain why this certificate should be issued despite the result being ineligible."
            rows={4}
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            {tooShort
              ? `At least ${request.minReasonLength} characters (${trimmed.length} so far).`
              : `${trimmed.length} characters. This will be recorded as a manual override.`}
          </p>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(trimmed)}
            disabled={pending || tooShort}
          >
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Issue with override
          </Button>
        </div>
      </div>
    </div>
  );
}
