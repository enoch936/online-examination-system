import validator from 'validator';
import DOMPurify from 'dompurify';

/**
 * Client-side input hygiene that mirrors the backend DTO transforms
 * (backend/src/common/utils/auth-hardening.util.ts). Sanitization happens on
 * read/submit so React state never renders user-controlled markup.
 */

export function sanitizeText(value: string, maxLength = 120): string {
  const cleaned = DOMPurify.sanitize(value.trim(), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).slice(0, maxLength);
  return cleaned;
}

export function sanitizeEmail(value: string): string {
  return value.trim().toLowerCase().slice(0, 254);
}

export function isValidEmail(value: string): boolean {
  return validator.isEmail(value);
}

export function isValidStrongPassword(value: string): boolean {
  return (
    value.length >= 12 &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}

const HIBP_SUFFIX_RE = /^[a-fA-F0-9]{5}$/;

/**
 * HIBP k-anonymity breach lookup (client-side, using only the first 5 hex chars
 * of the SHA-1 so the full hash never leaves the browser). Fails open on
 * network errors so a lookup outage never blocks registration.
 */
export async function isPasswordBreached(password: string): Promise<boolean> {
  try {
    const digest: string = await crypto.subtle
      .digest('SHA-1', new TextEncoder().encode(password))
      .then((buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join(''));
    const prefix = digest.slice(0, 5);
    const suffix = digest.slice(5).toUpperCase();
    if (!HIBP_SUFFIX_RE.test(prefix)) return true;

    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
    });
    if (!res.ok) return false;
    const body = await res.text();
    return body.split('\r\n').some((line) => {
      const [candidate] = line.split(':');
      return candidate?.toUpperCase() === suffix;
    });
  } catch {
    return false;
  }
}