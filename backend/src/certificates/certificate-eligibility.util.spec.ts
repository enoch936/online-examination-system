import {
  certificateExpiry,
  evaluateCertificateEligibility,
} from './certificate-eligibility.util';

describe('evaluateCertificateEligibility', () => {
  it('accepts a passed result with no extra configuration', () => {
    expect(evaluateCertificateEligibility({ passed: true, percentage: 55 })).toEqual({ eligible: true });
  });

  it('rejects a failed result regardless of percentage', () => {
    const result = evaluateCertificateEligibility({ passed: false, percentage: 99 });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('NOT_PASSED');
  });

  it('enforces an optional minimum percentage gate', () => {
    const base = { passed: true, minPercentage: 80 };
    expect(evaluateCertificateEligibility({ ...base, percentage: 79.99 }).reason).toBe('BELOW_MIN_PERCENTAGE');
    expect(evaluateCertificateEligibility({ ...base, percentage: 80 }).eligible).toBe(true);
  });

  it('treats a null minimum percentage as "no extra gate"', () => {
    expect(evaluateCertificateEligibility({ passed: true, percentage: 41, minPercentage: null }).eligible).toBe(true);
  });

  it('ignores a zero minimum percentage rather than failing everyone', () => {
    expect(evaluateCertificateEligibility({ passed: true, percentage: 0, minPercentage: 0 }).eligible).toBe(true);
  });

  it('allows hand-issued certificates even when bulk issuance is disabled', () => {
    const input = { passed: true, percentage: 90, enabled: false };
    expect(evaluateCertificateEligibility(input, false).eligible).toBe(true);
    expect(evaluateCertificateEligibility(input, true).reason).toBe('CERTIFICATES_DISABLED');
  });

  it('requires a published result for unattended issuance only', () => {
    const input = { passed: true, percentage: 90, enabled: true, requirePublished: true, publishedAt: null };
    expect(evaluateCertificateEligibility(input, true).reason).toBe('RESULT_NOT_PUBLISHED');
    expect(evaluateCertificateEligibility({ ...input, publishedAt: new Date() }, true).eligible).toBe(true);
    // A staff member issuing by hand does not need the result published.
    expect(evaluateCertificateEligibility(input, false).eligible).toBe(true);
  });

  it('reports the pass gate before the percentage gate', () => {
    expect(evaluateCertificateEligibility({ passed: false, percentage: 10, minPercentage: 80 }).reason).toBe('NOT_PASSED');
  });

  it('reports the disabled gate before the published gate', () => {
    const out = evaluateCertificateEligibility(
      { passed: true, percentage: 90, enabled: false, requirePublished: true, publishedAt: null },
      true,
    );
    expect(out.reason).toBe('CERTIFICATES_DISABLED');
  });

  it('handles string-typed decimals coming straight from Prisma', () => {
    expect(evaluateCertificateEligibility({ passed: true, percentage: 90, minPercentage: '80' as never }).eligible).toBe(true);
    expect(evaluateCertificateEligibility({ passed: true, percentage: '70' as never, minPercentage: 80 }).reason).toBe(
      'BELOW_MIN_PERCENTAGE',
    );
  });
});

describe('certificateExpiry', () => {
  const from = new Date('2026-01-01T00:00:00.000Z');

  it('returns null when validity is not configured (never expires)', () => {
    expect(certificateExpiry(null, from)).toBeNull();
    expect(certificateExpiry(undefined, from)).toBeNull();
  });

  it('returns null for a non-positive validity', () => {
    expect(certificateExpiry(0, from)).toBeNull();
    expect(certificateExpiry(-5, from)).toBeNull();
  });

  it('adds whole days', () => {
    expect(certificateExpiry(30, from)?.toISOString()).toBe('2026-01-31T00:00:00.000Z');
  });

  it('truncates a fractional day count', () => {
    expect(certificateExpiry(1.9, from)?.toISOString()).toBe('2026-01-02T00:00:00.000Z');
  });
});
