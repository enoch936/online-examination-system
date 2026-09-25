import { resolve, sep } from 'path';

/**
 * Resolve a caller-supplied storage key to an absolute path that is
 * guaranteed to live inside `baseDir`. Returns `null` for any path-traversal
 * primitive (`..` / `.` segments, backslashes, NUL bytes) or absolute-path
 * escape attempts. Pure — throws nothing, has no I/O.
 */
export function safeJoinWithin(baseDir: string, key: string): string | null {
  if (typeof key !== 'string' || key.length === 0) {
    return null;
  }
  if (
    key.includes('\0') ||
    key.includes('\\') ||
    /%(?:2e|2f|5c|00)/i.test(key) ||
    key.split(/[\\/]/).some((segment) => segment === '..' || segment === '.')
  ) {
    return null;
  }
  const filePath = resolve(baseDir, key);
  const root = resolve(baseDir);
  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
    return null;
  }
  return filePath;
}