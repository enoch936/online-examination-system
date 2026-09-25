import { safeJoinWithin } from './path.util';

const norm = (p: string) => p.replace(/\\/g, '/');

describe('safeJoinWithin', () => {
  const base = 'C:/online-examination-system-main/backend/uploads';

  it.each([
    '../.env',
    '..%2F..%2F.env',
    '..\\..\\.env',
    'foo/../../.env',
    '..%2fpackage.json',
    '%2e%2e/escape',
    '/etc/passwd',
    'C:\\Windows\\win.ini',
    './.env',
    'nul\0byte.env',
    'a/../../../outside',
  ])('rejects traversal key %s', (key) => {
    expect(safeJoinWithin(base, key)).toBeNull();
  });

  it('rejects empty and non-string keys', () => {
    expect(safeJoinWithin(base, '')).toBeNull();
    expect(safeJoinWithin(base, null as unknown as string)).toBeNull();
    expect(safeJoinWithin(base, undefined as unknown as string)).toBeNull();
  });

  it('resolves benign relative keys inside the base dir', () => {
    expect(norm(safeJoinWithin(base, 'avatars/user-1.png') as string)).toBe(
      'C:/online-examination-system-main/backend/uploads/avatars/user-1.png',
    );
    expect(norm(safeJoinWithin(base, 'a') as string).startsWith(base)).toBe(true);
  });

  it('keeps nested relative keys inside the base dir', () => {
    const nested = norm(safeJoinWithin('C:/base', 'nested/key') as string);
    expect(nested.startsWith('C:/base')).toBe(true);
    expect(nested).toMatch(/nested\/key$/);
  });
});