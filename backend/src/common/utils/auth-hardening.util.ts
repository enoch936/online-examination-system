import { createHash } from 'crypto';

/**
 * A valid bcrypt hash of a fixed placeholder password. Used to run an equal
 * amount of bcrypt work for unknown accounts so login/register responses are
 * not distinguishable by timing (user-enumeration resistance).
 */
export const DUMMY_BCRYPT_HASH = '$2b$12$tvfeNXNNFqCEJm9F09PAA.XIH/PBEhyT3XDyOHgcyeA.gVdEQMc.u';

const HIBP_ENDPOINT = 'https://api.pwnedpasswords.com/range';

const EMAIL_DOMAIN_ALIASES: Record<string, string> = {
  googlemail: 'gmail.com',
};

/**
 * Gmail ignores dots and anything after "+" in the local part — canonicalize
 * aliases so account-takeover-by-alias is not possible.
 */
function normalizeGmailLocalPart(local: string): string {
  const [base] = local.split('+');
  return base.replace(/\./g, '');
}

/**
 * Lower-cases, trims, and applies Gmail/googlemail canonicalization.
 * Kept deliberately conservative: no dns resolution, no domain rewriting.
 */
export function normalizeEmail(input: unknown): string {
  if (typeof input !== 'string') return '';
  const trimmed = input.trim().toLowerCase();
  if (!trimmed.includes('@')) return trimmed;
  const [local, domain] = trimmed.split('@');
  const d = domain.toLowerCase();
  const canonicalDomain = EMAIL_DOMAIN_ALIASES[d] ?? d;
  const normalizedLocal = canonicalDomain === 'gmail.com' ? normalizeGmailLocalPart(local) : local;
  const result = `${normalizedLocal}@${canonicalDomain}`;
  return result.slice(0, 254);
}

/**
 * Plain-text normalization for free-form / name fields. Removes control
 * characters, trims surrounding whitespace, and collapses repeated inner
 * whitespace. Never applied to passwords. This is defense-in-depth: React and
 * the frontend escape values on output; this only prevents hostile whitespace/
 * control characters from being persisted.
 */
export function sanitizePlainText(input: unknown, maxLength = 4000): string {
  if (typeof input !== 'string') return '';
  const collapsed = input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
  return collapsed.slice(0, maxLength);
}

/**
 * Have I Been Pwned k-anonymity check. SHA-1 of the password; only the first
 * 5 hex chars are sent over the wire; the returned suffix list is matched
 * locally. Network errors/timeouts fail open (return false) so an outage of
 * the third-party service can never lock out legitimate users.
 */
export async function isPasswordBreached(password: string): Promise<boolean> {
  try {
    const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    const response = await fetch(`${HIBP_ENDPOINT}/${prefix}`, {
      headers: { 'Accept': 'text/plain' },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return false;

    const body = await response.text();
    // Lines are "<SUFFIX>:<count>" (uppercase, \r\n separated).
    return body
      .split(/\r?\n/)
      .some((line) => line.split(':')[0]?.toUpperCase() === suffix);
  } catch {
    return false;
  }
}

/**
 * Verifies a Cloudflare Turnstile token against the siteverify endpoint.
 * - No secret configured  -> returns true (feature disabled; dev/test).
 * - Secret configured, missing/invalid/unsuccessful token -> false.
 */
export async function verifyTurnstile(token: string | undefined, secretKey: string | undefined): Promise<boolean> {
  if (!secretKey) return true;
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret: secretKey, response: token });
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return false;
    const data = (await response.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}