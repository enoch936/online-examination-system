import { PASSWORD_POLICY, isStrongPassword, passwordPolicyProblem } from './password.util';

describe('passwordPolicyProblem', () => {
  it('exposes the documented strong-password policy', () => {
    expect(PASSWORD_POLICY.minLength).toBe(12);
  });

  it.each([
    ['non-string value', 12345],
    ['empty string', ''],
  ])('rejects %s as missing', (_label, value) => {
    expect(passwordPolicyProblem(value)).toBe('password is required');
  });

  it.each([
    ['a12_Short', 'password must be at least 12 characters long'],
    ['Abcdefgh1!', 'password must be at least 12 characters long'],
  ])('rejects too-short password %s', (password, expected) => {
    expect(passwordPolicyProblem(password)).toBe(expected);
  });

  it.each([
    ['no uppercase', 'abcdefgh13!@'],
    ['no lowercase', 'ABCDEFGH13!@'],
    ['no digit', 'Abcdefgh!@#x'],
    ['no symbol', 'Abcdefgh1234'],
  ])('rejects %s', (_label, password) => {
    expect(passwordPolicyProblem(password)).toMatch(/must include uppercase, lowercase, number, and symbol/);
  });

  it.each(['password123', 'admin123', 'Password1', 'qwerty123', 'letmein'])(
    'rejects common password %s',
    (password) => {
      expect(passwordPolicyProblem(password)).toMatch(/too common/);
    },
  );

  it('rejects sequential-character passwords', () => {
    expect(passwordPolicyProblem('Abcdef!0123456')).toMatch(/sequential/);
    expect(passwordPolicyProblem('Qwerty@123456')).toMatch(/sequential/);
  });

  it('rejects long runs of repeated characters', () => {
    expect(passwordPolicyProblem('AaaaabXy!9@Kz')).toMatch(/repeated/);
  });

  it('rejects a password that equals the account email', () => {
    const password = 'Super@Admin2026!';
    expect(passwordPolicyProblem(password, { email: password })).toMatch(/must not be the same as the account email/);
  });

  it('accepts a strong, unique password', () => {
    expect(passwordPolicyProblem('Kx9#mQ2v$Lw8')).toBeNull();
    expect(isStrongPassword('Kx9#mQ2v$Lw8')).toBe(true);
  });
});