/**
 * Certificate eligibility is a single pure decision so the manual "issue"
 * button, the bulk generator, the auto-issue hook and the public verifier can
 * never disagree about whether a result qualifies.
 *
 * Two independent gates, both always enforced:
 *   1. the result must have passed (driven by `Exam.passingMarks`)
 *   2. if the exam sets a `certificateMinPercentage`, the result must reach it
 *
 * `certificateEnabled` is deliberately *not* one of those gates: it only decides
 * whether unattended issuance (bulk generate / auto-issue) is permitted for an
 * exam. A staff member issuing one certificate by hand is an explicit override
 * and keeps working on every exam, exactly as before this module existed.
 */

export type CertificateIneligibilityReason =
  | 'NOT_PASSED'
  | 'BELOW_MIN_PERCENTAGE'
  | 'CERTIFICATES_DISABLED'
  | 'RESULT_NOT_PUBLISHED';

export interface CertificateEligibilityInput {
  passed: boolean;
  percentage: number;
  /** `Exam.certificateMinPercentage`; null/undefined means "no extra gate". */
  minPercentage?: number | null;
  /** `Exam.certificateEnabled`; gates unattended issuance only. */
  enabled?: boolean;
  /** Set for unattended flows that must not hand out unpublished results. */
  requirePublished?: boolean;
  publishedAt?: Date | null;
}

export interface CertificateEligibility {
  eligible: boolean;
  reason?: CertificateIneligibilityReason;
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * @param forUnattended true for bulk generate / auto-issue, which additionally
 *   require the exam to have opted in via `certificateEnabled`.
 */
export function evaluateCertificateEligibility(
  input: CertificateEligibilityInput,
  forUnattended = false,
): CertificateEligibility {
  if (!input.passed) return { eligible: false, reason: 'NOT_PASSED' };

  const min = input.minPercentage === null || input.minPercentage === undefined ? null : toNumber(input.minPercentage);
  if (min !== null && min > 0 && toNumber(input.percentage) < min) {
    return { eligible: false, reason: 'BELOW_MIN_PERCENTAGE' };
  }

  if (forUnattended) {
    if (!input.enabled) return { eligible: false, reason: 'CERTIFICATES_DISABLED' };
    if (input.requirePublished && !input.publishedAt) {
      return { eligible: false, reason: 'RESULT_NOT_PUBLISHED' };
    }
  }

  return { eligible: true };
}

export const CERTIFICATE_INELIGIBILITY_MESSAGES: Record<CertificateIneligibilityReason, string> = {
  NOT_PASSED: 'Certificate can only be issued for passed results',
  BELOW_MIN_PERCENTAGE: 'Result does not meet the certificate minimum percentage for this exam',
  CERTIFICATES_DISABLED: 'Certificate generation is not enabled for this exam',
  RESULT_NOT_PUBLISHED: 'Result has not been published yet',
};

/**
 * `Certificate.expiresAt` for a freshly issued certificate, or null when the
 * certificate never expires.
 */
export function certificateExpiry(validityDays?: number | null, from: Date = new Date()): Date | null {
  const days = validityDays === null || validityDays === undefined ? Number.NaN : toNumber(validityDays);
  if (!Number.isFinite(days) || days <= 0) return null;
  return new Date(from.getTime() + Math.floor(days) * 24 * 60 * 60 * 1000);
}
