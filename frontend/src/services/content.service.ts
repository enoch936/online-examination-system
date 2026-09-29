import { api, unwrap } from './api';

/** The wording layer of a certificate template. Mirrors the backend contract. */
export type TemplateContent = {
  title: string;
  issuerName: string;
  introText: string;
  bodyText: string;
  footerNote: string;
  signatoryName: string;
  signatoryTitle: string;
  showRecipientEmail: boolean;
  showScore: boolean;
  showValidity: boolean;
  showSignatory: boolean;
  logoUrl: string | null;
  sealText: string | null;
};

/** The visual layer. Colours are hex and validated server-side. */
export type TemplateDesign = {
  accentColor: string;
  textColor: string;
  showBorder: boolean;
  borderWidth: number;
  logoWidth: number;
};

export type TemplateStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type ContentStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export type CertificateTemplate = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: TemplateStatus;
  isDefault: boolean;
  version: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  content: TemplateContent;
  design: TemplateDesign;
};

export type ContentDocument = {
  id: string;
  key: string;
  title: string;
  description: string | null;
  /** Opaque JSON blob; this client only ever stores a `{ body }` shape. */
  content: string;
  status: ContentStatus;
  version: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TemplateRevision = {
  id: string;
  version: number;
  note: string | null;
  createdAt: string;
  createdById: string | null;
};

export type ContentRevision = {
  id: string;
  version: number;
  note: string | null;
  createdAt: string;
  createdById: string | null;
};

export type TemplateInput = {
  slug: string;
  name: string;
  description?: string | null;
  content?: TemplateContent;
  design?: TemplateDesign;
  note?: string | null;
};

export type DocumentInput = {
  key: string;
  title: string;
  description?: string | null;
  content?: { body: string };
  note?: string | null;
};

/**
 * Placeholders the PDF renderer substitutes. They are intentionally left in
 * place when unknown, so a typo is visible in the output rather than silently
 * blanking a line.
 */
export const TEMPLATE_PLACEHOLDERS = [
  'recipient',
  'email',
  'exam',
  'score',
  'maxScore',
  'percentage',
  'grade',
  'issueDate',
  'expiryDate',
  'certificateNo',
  'verificationCode',
] as const;

export const contentService = {
  async listTemplates(includeArchived = false) {
    return unwrap<CertificateTemplate[]>(
      await api.get('/content/templates', {
        params: includeArchived ? { includeArchived: 'true' } : {},
      }),
    );
  },

  async getTemplate(idOrSlug: string) {
    return unwrap<CertificateTemplate>(await api.get(`/content/templates/${idOrSlug}`));
  },

  async createTemplate(input: TemplateInput) {
    return unwrap<CertificateTemplate>(await api.post('/content/templates', input));
  },

  async updateTemplate(id: string, input: TemplateInput) {
    return unwrap<CertificateTemplate>(await api.patch(`/content/templates/${id}`, input));
  },

  async publishTemplate(id: string, note?: string) {
    return unwrap<CertificateTemplate>(await api.post(`/content/templates/${id}/publish`, { note }));
  },

  async setDefaultTemplate(id: string) {
    return unwrap<CertificateTemplate>(await api.post(`/content/templates/${id}/default`));
  },

  async archiveTemplate(id: string) {
    return unwrap<CertificateTemplate>(await api.delete(`/content/templates/${id}`));
  },

  /**
   * Renders the template as it currently stands in the editor and returns the
   * PDF bytes. Nothing is persisted, so this reflects unsaved edits.
   *
   * The response is the raw PDF rather than the usual JSON envelope, hence
   * `responseType: 'blob'` and no `unwrap`.
   */
  async previewTemplate(content?: TemplateContent, design?: TemplateDesign) {
    const response = await api.post('/content/templates/preview', { content, design }, { responseType: 'blob' });
    return response.data as Blob;
  },

  async listTemplateRevisions(id: string) {
    return unwrap<TemplateRevision[]>(await api.get(`/content/templates/${id}/revisions`));
  },

  async listDocuments() {
    return unwrap<ContentDocument[]>(await api.get('/content/documents'));
  },

  async getDocument(key: string) {
    return unwrap<ContentDocument>(await api.get(`/content/documents/${key}`));
  },

  async createDocument(input: DocumentInput) {
    return unwrap<ContentDocument>(await api.post('/content/documents', input));
  },

  async updateDocument(key: string, input: DocumentInput) {
    return unwrap<ContentDocument>(await api.patch(`/content/documents/${key}`, input));
  },

  async publishDocument(key: string, note?: string) {
    return unwrap<ContentDocument>(await api.post(`/content/documents/${key}/publish`, { note }));
  },

  async archiveDocument(key: string) {
    return unwrap<ContentDocument>(await api.delete(`/content/documents/${key}`));
  },

  async listDocumentRevisions(key: string) {
    return unwrap<ContentRevision[]>(await api.get(`/content/documents/${key}/revisions`));
  },

  async revertDocument(key: string, version: number) {
    return unwrap<ContentDocument>(
      await api.post(`/content/documents/${key}/revisions/${version}/revert`),
    );
  },
};

/** Reads the `{ body }` blob, tolerating anything else the API might return. */
export function readDocumentBody(document: ContentDocument | null | undefined): string {
  if (!document) return '';
  try {
    const parsed = JSON.parse(document.content) as { body?: unknown };
    return typeof parsed.body === 'string' ? parsed.body : '';
  } catch {
    // A pre-CMS row stored raw text; show it rather than losing the content.
    return document.content;
  }
}
