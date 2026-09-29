import { BadRequestException } from '@nestjs/common';

/**
 * The wording layer of a certificate template. Every field is optional at
 * input time; `parseTemplateContent` fills the gaps from the defaults so the
 * PDF builder never has to branch on "was this set".
 */
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

/** The visual layer. Colours are validated as hex so a typo cannot emit junk. */
export type TemplateDesign = {
  accentColor: string;
  textColor: string;
  showBorder: boolean;
  borderWidth: number;
  logoWidth: number;
};

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * Must stay byte-for-byte equivalent to the wording the PDF builder hardcoded
 * before the CMS existed, so seeding this template leaves existing output
 * unchanged and the "no template at all" fallback can use the same values.
 */
export const DEFAULT_TEMPLATE_CONTENT: TemplateContent = {
  title: 'Certificate of Achievement',
  issuerName: 'Online Examination System',
  introText: 'This is to certify that',
  bodyText: 'has successfully completed',
  footerNote: 'Verify this certificate using the verification code at the public verification endpoint.',
  signatoryName: '',
  signatoryTitle: '',
  showRecipientEmail: true,
  showScore: true,
  showValidity: true,
  showSignatory: false,
  logoUrl: null,
  sealText: null,
};

export const DEFAULT_TEMPLATE_DESIGN: TemplateDesign = {
  accentColor: '#1e40af',
  textColor: '#111827',
  showBorder: true,
  borderWidth: 2,
  logoWidth: 120,
};

export type TemplatePlaceholders = {
  recipient: string;
  email: string;
  exam: string;
  score: string;
  maxScore: string;
  percentage: string;
  grade: string;
  issueDate: string;
  expiryDate: string;
  certificateNo: string;
  verificationCode: string;
};

const PLACEHOLDER_PATTERN = /\{\{\s*(\w+)\s*\}\}/g;

const asString = (value: unknown, fallback: string): string =>
  typeof value === 'string' ? value : fallback;

const asBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const asNullableString = (value: unknown, fallback: string | null): string | null =>
  value === null || value === undefined || value === '' ? null : asString(value, fallback ?? '');

/**
 * Unknown keys are ignored rather than rejected so an older client can post a
 * newer shape without a hard failure, but known keys are type-checked strictly.
 */
export function parseTemplateContent(raw: string | null | undefined): TemplateContent {
  let parsed: Record<string, unknown> = {};
  if (raw) {
    try {
      const value: unknown = JSON.parse(raw);
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        parsed = value as Record<string, unknown>;
      }
    } catch {
      // A malformed blob must not be able to break PDF generation; fall back.
      return { ...DEFAULT_TEMPLATE_CONTENT };
    }
  }
  return {
    title: asString(parsed.title, DEFAULT_TEMPLATE_CONTENT.title),
    issuerName: asString(parsed.issuerName, DEFAULT_TEMPLATE_CONTENT.issuerName),
    introText: asString(parsed.introText, DEFAULT_TEMPLATE_CONTENT.introText),
    bodyText: asString(parsed.bodyText, DEFAULT_TEMPLATE_CONTENT.bodyText),
    footerNote: asString(parsed.footerNote, DEFAULT_TEMPLATE_CONTENT.footerNote),
    signatoryName: asString(parsed.signatoryName, DEFAULT_TEMPLATE_CONTENT.signatoryName),
    signatoryTitle: asString(parsed.signatoryTitle, DEFAULT_TEMPLATE_CONTENT.signatoryTitle),
    showRecipientEmail: asBoolean(parsed.showRecipientEmail, DEFAULT_TEMPLATE_CONTENT.showRecipientEmail),
    showScore: asBoolean(parsed.showScore, DEFAULT_TEMPLATE_CONTENT.showScore),
    showValidity: asBoolean(parsed.showValidity, DEFAULT_TEMPLATE_CONTENT.showValidity),
    showSignatory: asBoolean(parsed.showSignatory, DEFAULT_TEMPLATE_CONTENT.showSignatory),
    logoUrl: asNullableString(parsed.logoUrl, DEFAULT_TEMPLATE_CONTENT.logoUrl),
    sealText: asNullableString(parsed.sealText, DEFAULT_TEMPLATE_CONTENT.sealText),
  };
}

export function parseTemplateDesign(raw: string | null | undefined): TemplateDesign {
  let parsed: Record<string, unknown> = {};
  if (raw) {
    try {
      const value: unknown = JSON.parse(raw);
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        parsed = value as Record<string, unknown>;
      }
    } catch {
      return { ...DEFAULT_TEMPLATE_DESIGN };
    }
  }
  return {
    accentColor: asString(parsed.accentColor, DEFAULT_TEMPLATE_DESIGN.accentColor),
    textColor: asString(parsed.textColor, DEFAULT_TEMPLATE_DESIGN.textColor),
    showBorder: asBoolean(parsed.showBorder, DEFAULT_TEMPLATE_DESIGN.showBorder),
    borderWidth: typeof parsed.borderWidth === 'number' ? parsed.borderWidth : DEFAULT_TEMPLATE_DESIGN.borderWidth,
    logoWidth: typeof parsed.logoWidth === 'number' ? parsed.logoWidth : DEFAULT_TEMPLATE_DESIGN.logoWidth,
  };
}

/**
 * Rejects values that would produce a broken or unsafe render. Called on write
 * so a bad template can never reach the PDF builder, which trusts its input.
 */
export function assertValidTemplateContent(content: unknown): TemplateContent {
  if (!content || typeof content !== 'object' || Array.isArray(content)) {
    throw new BadRequestException('content must be an object');
  }
  const record = content as Record<string, unknown>;

  for (const key of ['title', 'issuerName', 'introText', 'bodyText', 'footerNote', 'signatoryName', 'signatoryTitle'] as const) {
    if (record[key] !== undefined && typeof record[key] !== 'string') {
      throw new BadRequestException(`content.${key} must be a string`);
    }
  }
  for (const key of ['showRecipientEmail', 'showScore', 'showValidity', 'showSignatory'] as const) {
    if (record[key] !== undefined && typeof record[key] !== 'boolean') {
      throw new BadRequestException(`content.${key} must be a boolean`);
    }
  }
  for (const key of ['logoUrl', 'sealText'] as const) {
    const value = record[key];
    if (value !== undefined && value !== null && typeof value !== 'string') {
      throw new BadRequestException(`content.${key} must be a string or null`);
    }
    // Only same-origin-relative paths or https URLs, so a template cannot be
    // used to make the server fetch or embed an arbitrary scheme.
    if (typeof value === 'string' && value !== '' && !/^\/(?!\/)/.test(value) && !/^https:\/\//i.test(value)) {
      throw new BadRequestException(`content.${key} must be a relative path or an https URL`);
    }
  }

  // Wording is embedded in a PDF; a very long string would overflow the page.
  for (const key of ['title', 'issuerName', 'introText', 'bodyText', 'footerNote', 'signatoryName', 'signatoryTitle'] as const) {
    const value = record[key];
    if (typeof value === 'string' && value.length > 500) {
      throw new BadRequestException(`content.${key} must be 500 characters or fewer`);
    }
  }

  return parseTemplateContent(JSON.stringify({ ...DEFAULT_TEMPLATE_CONTENT, ...record }));
}

export function assertValidTemplateDesign(design: unknown): TemplateDesign {
  if (!design || typeof design !== 'object' || Array.isArray(design)) {
    throw new BadRequestException('design must be an object');
  }
  const record = design as Record<string, unknown>;

  for (const key of ['accentColor', 'textColor'] as const) {
    const value = record[key];
    if (value !== undefined && (typeof value !== 'string' || !HEX_COLOR.test(value))) {
      throw new BadRequestException(`design.${key} must be a hex colour such as #1e40af`);
    }
  }
  for (const key of ['borderWidth', 'logoWidth'] as const) {
    const value = record[key];
    if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 40)) {
      throw new BadRequestException(`design.${key} must be a number between 0 and 40`);
    }
  }
  if (record.showBorder !== undefined && typeof record.showBorder !== 'boolean') {
    throw new BadRequestException('design.showBorder must be a boolean');
  }

  return parseTemplateDesign(JSON.stringify({ ...DEFAULT_TEMPLATE_DESIGN, ...record }));
}

/**
 * Unknown placeholders are left as-is rather than blanked, so a typo in a
 * template is visible to the author instead of silently disappearing.
 */
export function interpolate(text: string, values: TemplatePlaceholders): string {
  if (!text) return '';
  return text.replace(PLACEHOLDER_PATTERN, (match, key: string) => {
    const value = values[key as keyof TemplatePlaceholders];
    return value === undefined || value === '' ? match : value;
  });
}
