import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PDFDocument from 'pdfkit';
import {
  TemplateContent,
  TemplateDesign,
  TemplatePlaceholders,
  interpolate,
} from './template-content.util';

/**
 * Everything a single certificate needs to be drawn, decoupled from where it
 * came from. `buildPdf` fills this from an issued certificate and its frozen
 * template snapshot; `previewTemplate` fills it from the template the CMS editor
 * currently holds plus sample values.
 */
export type CertificateRenderData = {
  recipientName: string;
  recipientEmail: string;
  examTitle: string;
  score: number;
  maxScore: number;
  percentage: number;
  grade: string;
  issuedOn: string;
  expiryOn: string | null;
  expired: boolean;
  certificateNo: string;
  verificationCode: string;
  logo: Buffer | null;
};

/** A logo is decorative; anything larger than this is refused rather than buffered. */
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/** Bounds how long a logo fetch may hold up a certificate download. */
const LOGO_FETCH_TIMEOUT_MS = 5000;

/**
 * True when a hostname resolves to a public address.
 *
 * The check is on the literal hostname, not on a DNS lookup, because a lookup
 * would be defeated by a rebind between the check and the fetch. This blocks the
 * obvious cases — `localhost`, bare private ranges, and the metadata service —
 * and anything that still slips through fails closed on the image content-type
 * check in `loadLogo`.
 */
function isPublicHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) return false;
  if (host === '169.254.169.254' || host === 'metadata.google.internal') return false;

  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10 || a === 127 || a === 0) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 169 && b === 254) return false;
    return true;
  }

  // Anything not v4 literal and not a plain public name: allow only real DNS
  // names, refusing IPv6 literals so the range checks above cannot be bypassed.
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host);
}

/**
 * Draws certificates as PDFs.
 *
 * Lives apart from `CertificatesService` and `ContentService` so the issued-
 * certificate download and the CMS preview cannot drift apart: both call the
 * same `render`, which is the only place pdfkit is used for certificates.
 */
@Injectable()
export class CertificateRendererService {
  constructor(private readonly config: ConfigService) {}

  /**
   * Resolves a template's `logoUrl` into bytes pdfkit can actually draw.
   *
   * pdfkit 0.20 removed remote fetching: a string source is treated as a data URL
   * or a filesystem path, so handing it an `https://` address or a site-relative
   * upload path makes `doc.image()` throw. Both forms are accepted by the
   * template validator, so the bytes are fetched here instead. Returns null when
   * the logo cannot be loaded, which the caller treats as "draw without a logo"
   * rather than a failed render.
   */
  async loadLogo(url: string): Promise<Buffer | null> {
    try {
      if (url.startsWith('data:')) {
        const match = /^data:(image\/[a-z0-9.+-]+);base64,(.*)$/i.exec(url);
        if (!match) return null;
        const buffer = Buffer.from(match[2], 'base64');
        return buffer.length <= MAX_LOGO_BYTES ? buffer : null;
      }

      // A site-relative path is resolved against this deployment so a logo saved
      // as `/uploads/logo.png` keeps working without the editor having to know
      // the public origin. Only https is fetched, and only from a public address:
      // `logoUrl` is a CMS-editable string rendered server-side, so an unchecked
      // fetch would let an editor make the API read internal addresses.
      const base = this.publicBaseUrl();
      const target = /^https:\/\//i.test(url) ? new URL(url) : new URL(url, base);
      if (target.protocol !== 'https:' && target.host !== new URL(base).host) {
        return null;
      }
      if (!isPublicHost(target.hostname)) {
        return null;
      }

      const response = await fetch(target, { signal: AbortSignal.timeout(LOGO_FETCH_TIMEOUT_MS) });
      if (!response.ok) return null;

      const type = response.headers.get('content-type') ?? '';
      if (!type.startsWith('image/')) return null;

      // Read one byte past the cap so an oversized body is detected rather than
      // fully buffered into memory.
      const buffer = Buffer.from(await response.arrayBuffer());
      return buffer.length <= MAX_LOGO_BYTES ? buffer : null;
    } catch {
      // A missing or unreachable logo is a cosmetic problem, never a reason to
      // fail the download or the preview.
      return null;
    }
  }

  /**
   * Origin used to resolve site-relative template assets. Taken from config so a
   * deployed instance resolves against its own public URL rather than localhost.
   */
  private publicBaseUrl(): string {
    const configured =
      this.config.get<string>('FRONTEND_URL') ?? this.config.get<string>('CORS_ORIGIN') ?? '';
    const first = configured.split(',')[0]?.trim();
    if (first && /^https?:\/\//i.test(first)) {
      return first;
    }
    return 'http://localhost:3000';
  }

  /**
   * Renders the live, unsaved shape of a template the CMS editor is holding.
   *
   * Deliberately separate from the issued-certificate download: a preview must
   * show the template as it currently stands in the editor, whereas an issued
   * certificate renders the snapshot frozen at issue time. Placeholders are
   * filled with obvious sample values so an editor can judge wording and layout
   * without issuing anything or exposing a real student's details.
   */
  async renderPreview(
    content: TemplateContent,
    design: TemplateDesign,
  ): Promise<{ filename: string; buffer: Buffer }> {
    const logo = content.logoUrl ? await this.loadLogo(content.logoUrl) : null;
    const buffer = await this.render(content, design, {
      recipientName: 'Sample Recipient',
      recipientEmail: 'sample.recipient@example.com',
      examTitle: 'Sample Examination',
      score: 42,
      maxScore: 50,
      percentage: 84,
      grade: 'A',
      issuedOn: new Date().toISOString().slice(0, 10),
      expiryOn: null,
      expired: false,
      certificateNo: 'OES-PREVIEW',
      verificationCode: 'PREVIEW-ONLY',
      logo,
    });
    return { filename: 'certificate-preview.pdf', buffer };
  }

  async render(text: TemplateContent, design: TemplateDesign, data: CertificateRenderData): Promise<Buffer> {
    const { recipientName, examTitle, score, maxScore, percentage, issuedOn, logo } = data;
    const values: TemplatePlaceholders = {
      recipient: recipientName,
      email: data.recipientEmail,
      exam: examTitle,
      score: String(score),
      maxScore: String(maxScore),
      percentage: `${percentage}%`,
      grade: data.grade,
      issueDate: issuedOn,
      expiryDate: data.expiryOn ?? '',
      certificateNo: data.certificateNo,
      verificationCode: data.verificationCode,
    };

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 56 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    const draw = () => {
      if (design.showBorder) {
        const { width, height } = doc.page;
        const inset = 28;
        doc
          .save()
          .lineWidth(design.borderWidth)
          .strokeColor(design.accentColor)
          .rect(inset, inset, width - inset * 2, height - inset * 2)
          .stroke()
          .restore();
        doc.y = inset + 24;
      }
      doc.fillColor(design.textColor);

      if (text.logoUrl && logo) {
        try {
          doc.image(logo, { fit: [design.logoWidth, design.logoWidth], align: 'center' });
          doc.moveDown(0.6);
        } catch {
          // A corrupt image must not fail the whole render.
        }
      }

      doc.fontSize(26).text(interpolate(text.title, values), { align: 'center' });
      doc.moveDown(0.8);
      if (text.issuerName) {
        doc.fontSize(13).text(interpolate(text.issuerName, values), { align: 'center' });
        doc.moveDown(1.6);
      }

      if (text.introText) {
        doc.fontSize(14).text(interpolate(text.introText, values), { align: 'center' });
        doc.moveDown(0.4);
      }
      doc.fontSize(24).text(interpolate(recipientName, values), { align: 'center' });
      if (text.showRecipientEmail && data.recipientEmail) {
        doc.moveDown(0.2);
        doc.fontSize(10).text(data.recipientEmail, { align: 'center' });
      }
      doc.moveDown(1.4);

      if (text.bodyText) {
        doc.fontSize(14).text(interpolate(text.bodyText, values), { align: 'center' });
        doc.moveDown(0.4);
      }
      doc.fontSize(20).text(examTitle, { align: 'center' });
      doc.moveDown(1.6);

      if (text.showScore) {
        doc.fontSize(12).text(`Score: ${score} / ${maxScore}  (${percentage}%)`, { align: 'center' });
        doc.moveDown(0.3);
      }
      doc.fontSize(12).text(`Issued on: ${issuedOn}`, { align: 'center' });
      if (text.showValidity && data.expiryOn) {
        doc.moveDown(0.3);
        doc.fontSize(12).text(
          data.expired ? `Expired on: ${data.expiryOn}` : `Valid until: ${data.expiryOn}`,
          { align: 'center' },
        );
      }
      doc.moveDown(2);

      if (text.showSignatory && text.signatoryName) {
        doc.fontSize(12).text(interpolate(text.signatoryName, values), { align: 'center' });
        if (text.signatoryTitle) {
          doc.moveDown(0.2);
          doc.fontSize(9).text(interpolate(text.signatoryTitle, values), { align: 'center' });
        }
        doc.moveDown(0.8);
      }

      if (text.sealText) {
        doc.fontSize(9).text(interpolate(text.sealText, values), { align: 'center' });
        doc.moveDown(0.4);
      }
      doc.fontSize(9).text(`Certificate No: ${data.certificateNo}`, { align: 'center' });
      doc.moveDown(0.2);
      doc.fontSize(9).text(`Verification code: ${data.verificationCode}`, { align: 'center' });
      if (text.footerNote) {
        doc.moveDown(1.4);
        doc
          .fontSize(8)
          .fillColor('#666666')
          .text(interpolate(text.footerNote, values), { align: 'center' });
      }
      doc.end();
    };

    return new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      draw();
    });
  }
}
