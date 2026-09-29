import { BadRequestException } from '@nestjs/common';
import {
  assertValidTemplateContent,
  assertValidTemplateDesign,
  DEFAULT_TEMPLATE_CONTENT,
  DEFAULT_TEMPLATE_DESIGN,
  interpolate,
  parseTemplateContent,
} from './template-content.util';

describe('parseTemplateContent', () => {
  it('returns the built-in wording for a null or missing blob', () => {
    expect(parseTemplateContent(null)).toEqual(DEFAULT_TEMPLATE_CONTENT);
    expect(parseTemplateContent(undefined)).toEqual(DEFAULT_TEMPLATE_CONTENT);
  });

  it('falls back rather than throwing on malformed JSON', () => {
    expect(parseTemplateContent('{not json')).toEqual(DEFAULT_TEMPLATE_CONTENT);
  });

  it('falls back when the JSON is an array instead of an object', () => {
    expect(parseTemplateContent('[1,2,3]')).toEqual(DEFAULT_TEMPLATE_CONTENT);
  });

  it('keeps provided values and fills only the gaps', () => {
    const parsed = parseTemplateContent(JSON.stringify({ title: 'Award', showScore: false }));
    expect(parsed.title).toBe('Award');
    expect(parsed.showScore).toBe(false);
    expect(parsed.issuerName).toBe(DEFAULT_TEMPLATE_CONTENT.issuerName);
  });

  it('ignores unknown keys instead of failing', () => {
    const parsed = parseTemplateContent(JSON.stringify({ title: 'Award', somethingNew: 'x' }));
    expect(parsed).not.toHaveProperty('somethingNew');
  });
});

describe('assertValidTemplateContent', () => {
  it('accepts an empty object and applies defaults', () => {
    expect(assertValidTemplateContent({}).title).toBe(DEFAULT_TEMPLATE_CONTENT.title);
  });

  it('rejects a non-object', () => {
    expect(() => assertValidTemplateContent('nope')).toThrow(BadRequestException);
    expect(() => assertValidTemplateContent([])).toThrow(BadRequestException);
  });

  it('rejects a wrongly typed known field', () => {
    expect(() => assertValidTemplateContent({ title: 5 })).toThrow(/title must be a string/);
    expect(() => assertValidTemplateContent({ showScore: 'yes' })).toThrow(/showScore must be a boolean/);
  });

  it('rejects an over-long string that would overflow the page', () => {
    expect(() => assertValidTemplateContent({ title: 'x'.repeat(501) })).toThrow(/500 characters/);
  });

  it('rejects a logo URL using a non-https scheme', () => {
    expect(() => assertValidTemplateContent({ logoUrl: 'javascript:alert(1)' })).toThrow(/relative path or an https URL/);
    expect(() => assertValidTemplateContent({ logoUrl: 'http://insecure.test/x.png' })).toThrow(/relative path or an https URL/);
  });

  it('accepts a relative path and an https logo URL', () => {
    expect(assertValidTemplateContent({ logoUrl: '/uploads/logo.png' }).logoUrl).toBe('/uploads/logo.png');
    expect(assertValidTemplateContent({ logoUrl: 'https://cdn.test/logo.png' }).logoUrl).toBe('https://cdn.test/logo.png');
  });

  it('treats an empty logo as absent', () => {
    expect(assertValidTemplateContent({ logoUrl: '' }).logoUrl).toBeNull();
  });
});

describe('assertValidTemplateDesign', () => {
  it('accepts an empty object and applies defaults', () => {
    expect(assertValidTemplateDesign({})).toEqual(DEFAULT_TEMPLATE_DESIGN);
  });

  it('rejects a non-hex colour', () => {
    expect(() => assertValidTemplateDesign({ accentColor: 'blue' })).toThrow(/hex colour/);
    expect(() => assertValidTemplateDesign({ accentColor: '#zzzzzz' })).toThrow(/hex colour/);
  });

  it('accepts a 3 and a 6 digit hex colour', () => {
    expect(assertValidTemplateDesign({ accentColor: '#abc' }).accentColor).toBe('#abc');
    expect(assertValidTemplateDesign({ accentColor: '#AABBCC' }).accentColor).toBe('#AABBCC');
  });

  it('rejects an out-of-range border width', () => {
    expect(() => assertValidTemplateDesign({ borderWidth: -1 })).toThrow(/between 0 and 40/);
    expect(() => assertValidTemplateDesign({ borderWidth: 999 })).toThrow(/between 0 and 40/);
  });
});

describe('interpolate', () => {
  const values = {
    recipient: 'Jane Doe',
    exam: 'Algorithms',
    percentage: '91%',
    score: '91',
    maxScore: '100',
    grade: 'A',
    email: 'jane@test',
    issueDate: '2026-01-01',
    expiryDate: '2027-01-01',
    certificateNo: 'OES-1',
    verificationCode: 'code-1',
  };

  it('replaces a known placeholder', () => {
    expect(interpolate('Awarded to {{recipient}}', values)).toBe('Awarded to Jane Doe');
  });

  it('tolerates whitespace inside the braces', () => {
    expect(interpolate('{{ recipient }}', values)).toBe('Jane Doe');
  });

  it('replaces several placeholders in one string', () => {
    expect(interpolate('{{exam}}: {{percentage}}', values)).toBe('Algorithms: 91%');
  });

  // Silently blanking a typo would hide the mistake from the template author.
  it('leaves an unknown placeholder visible', () => {
    expect(interpolate('Hello {{nope}}', values)).toBe('Hello {{nope}}');
  });

  it('returns an empty string for empty input', () => {
    expect(interpolate('', values)).toBe('');
  });
});
