const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', 'passw0rd', 'passwording',
  'admin', 'admin123', 'administrator', 'root', 'toor',
  'superadmin', 'superuser', 'sysadmin', 'manager',
  'qwerty', 'qwerty123', 'qwertyuiop', 'letmein', 'welcome', 'welcome1',
  'monkey', 'dragon', 'football', 'baseball', 'soccer', 'hockey',
  'abc123', '123456', '1234567', '12345678', '123456789', '1234567890',
  '123123', '111111', '000000', '12345', '54321', '987654321',
  'iloveyou', 'trustno1', 'sunshine', 'master', 'shadow', 'princess',
  'google', 'batman', 'starwars', 'cheese', 'hunter', 'ashley', 'michael',
  'football1', 'whatever', 'changeme', '1qaz2wsx', 'qweasdzxc',
  '1q2w3e4r', 'zaq12wsx', '123qwe', 'pass', 'test', 'guest',
]);

const SEQUENCE_PATTERN =
  /(?:012345|123456|234567|345678|456789|567890|abcdef|bcdefg|cdefgh|defghi|efghij|fghijk|ghijkl|hijklm|ijklmn|jklmno|klmnop|lmnopq|qwerty|qwertyuiop|asdfghjkl|zxcvbnm|poiuytrewq|0987654321)/i;

const REPEATED_PATTERN = /(.)\1{3,}/;

const UPPER = /(?=.*[A-Z])/;
const LOWER = /(?=.*[a-z])/;
const DIGIT = /(?=.*\d)/;
const SYMBOL = /(?=.*[^A-Za-z0-9])/;

export const PASSWORD_POLICY = {
  minLength: 12,
  description:
    'at least 12 characters, including uppercase, lowercase, number, and symbol characters, and must not be a common, sequential, or repeated password',
};

/**
 * Validates a candidate password against the shared strong-password policy.
 * Returns a human-readable problem description, or `null` when the password
 * is acceptable.
 */
export function passwordPolicyProblem(password: unknown, context?: { email?: string }): string | null {
  if (typeof password !== 'string' || password.length === 0) {
    return 'password is required';
  }
  // Reject known-weak/common passwords before any other rule so short defaults
  // like "admin123" or "password1" are never accepted at any length.
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return 'password is too common — choose a unique, strong password';
  }
  if (password.length < PASSWORD_POLICY.minLength) {
    return `password must be at least ${PASSWORD_POLICY.minLength} characters long`;
  }
  if (!UPPER.test(password) || !LOWER.test(password) || !DIGIT.test(password) || !SYMBOL.test(password)) {
    return 'password must include uppercase, lowercase, number, and symbol characters';
  }
  if (SEQUENCE_PATTERN.test(password)) {
    return 'password must not contain sequential characters (e.g. 123456, qwerty, abcdef)';
  }
  if (REPEATED_PATTERN.test(password)) {
    return 'password must not contain long runs of repeated characters';
  }
  if (context?.email && password.toLowerCase() === context.email.toLowerCase()) {
    return 'password must not be the same as the account email';
  }
  return null;
}

export function isStrongPassword(password: unknown, context?: { email?: string }): boolean {
  return passwordPolicyProblem(password, context) === null;
}