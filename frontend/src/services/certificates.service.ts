import { api, unwrap } from './api';
import type { Certificate, PaginatedResponse } from '@/types/api';

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
   */
  async verify(codeOrNumber: string) {
    return unwrap<(Certificate & { expired: boolean }) | null>(
      await api.get(`/certificates/verify/${encodeURIComponent(codeOrNumber)}`),
    );
  },
  async issue(resultId: string) {
    return unwrap<Certificate>(await api.post(`/certificates/${resultId}/issue`));
  },
  async revoke(id: string) {
    return unwrap<{ id: string; revoked: true }>(await api.post(`/certificates/${id}/revoke`));
  },
  async reissue(id: string) {
    return unwrap<Certificate>(await api.post(`/certificates/${id}/reissue`));
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
