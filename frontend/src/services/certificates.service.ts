import { api, unwrap } from './api';
import type { Certificate, CertificateVerification, PaginatedResponse } from '@/types/api';

/** Summary returned by the bulk issuance endpoint. */
export type CertificateGenerationSummary = {
  examId: string;
  created: number;
  alreadyIssued: number;
  ineligible: number;
  notPublished: number;
};

export const certificatesService = {
  async list(params?: { examId?: string; page?: number; limit?: number }) {
    return unwrap<PaginatedResponse<Certificate>>(await api.get('/certificates', { params }));
  },
  /**
   * Accepts either the verification code or the certificate number — a printed
   * certificate shows both, and an employer will try the shorter one first.
   * An unknown code resolves to `{ valid: false }`, not an error.
   */
  async verify(codeOrNumber: string) {
    return unwrap<CertificateVerification>(
      await api.get(`/certificates/verify/${encodeURIComponent(codeOrNumber)}`),
    );
  },
  /**
   * Assigns a certificate to a result. A result that meets the eligibility rules
   * issues immediately. One that does not is rejected with the
   * `CERTIFICATE_OVERRIDE_REASON_REQUIRED` code, and the caller must retry with
   * a justification, which is stored on the certificate as a manual override.
   */
  async issue(resultId: string, overrideReason?: string) {
    return unwrap<Certificate>(
      await api.post(`/certificates/${resultId}/issue`, overrideReason ? { overrideReason } : {}),
    );
  },
  async revoke(id: string) {
    return unwrap<{ id: string; revoked: true }>(await api.post(`/certificates/${id}/revoke`));
  },
  async reissue(id: string, overrideReason?: string) {
    return unwrap<Certificate>(
      await api.post(`/certificates/${id}/reissue`, overrideReason ? { overrideReason } : {}),
    );
  },
  /**
   * Issues a certificate for every eligible, not-yet-certified result of an exam.
   * Idempotent, so it is safe to re-run to pick up results that were not yet
   * published the first time round.
   */
  async generateForExam(examId: string) {
    return unwrap<CertificateGenerationSummary>(
      await api.post(`/certificates/exams/${examId}/generate`),
    );
  },
  /**
   * The PDF route is authenticated, so it must be fetched as a blob and saved
   * via an object URL — a plain <a href> would not carry the bearer token.
   */
  async downloadPdf(id: string) {
    const response = await api.get(`/certificates/${id}/pdf`, { responseType: 'blob' });
    return response.data as Blob;
  },
};

/** Shared blob-save helper, mirroring the reports pages. */
export function saveBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}

/**
 * The structured body the backend sends when a certificate can only be issued
 * with a written justification. The global exception filter nests the raw
 * `HttpException` payload under `error`.
 */
export type CertificateOverrideRequired = {
  code: 'CERTIFICATE_OVERRIDE_REASON_REQUIRED';
  message: string;
  ineligibilityReason: string;
  minReasonLength: number;
  overridePrompt: string;
};

/**
 * Returns the override payload when the server rejected a request specifically
 * because it needs a justification, and `null` for any other failure. Detecting
 * this by a stable code — not by matching a message — is what makes the UI
 * robust to wording changes.
 */
export function overrideRequiredFrom(error: unknown): CertificateOverrideRequired | null {
  const body = (error as { response?: { data?: { error?: Record<string, unknown> } } })?.response?.data?.error;
  if (body && body.code === 'CERTIFICATE_OVERRIDE_REASON_REQUIRED') {
    return body as unknown as CertificateOverrideRequired;
  }
  return null;
}
