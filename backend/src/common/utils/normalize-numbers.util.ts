import { Prisma } from '@prisma/client';

/**
 * Recursively converts Prisma `Decimal` and `BigInt` values into plain numbers.
 *
 * Prisma maps PostgreSQL `numeric` to `Decimal`, and `JSON.stringify` has no
 * native representation for one, so it emits a STRING instead. A client that
 * reads `result.percentage.toFixed(1)` then throws `toFixed is not a function`
 * at runtime, even though the generated TypeScript type claims `number`. Every
 * such field must be normalized before it reaches the wire.
 *
 * BigInt is handled here too because `JSON.stringify` throws outright on it, so
 * a raw `_count` would fail the whole request rather than degrade one field.
 *
 * Values that JSON already handles natively (Date, Buffer) and class instances
 * are returned untouched, so serialization semantics are unchanged for them.
 */
export function normalizeNumbers<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'bigint') {
    return Number(value) as unknown as T;
  }

  // Checked before the plain-object branch: Decimal is an object with a
  // toNumber() method, and it must not be walked as a record.
  if (Prisma.Decimal.isDecimal(value)) {
    return value.toNumber() as unknown as T;
  }

  if (value instanceof Date || Buffer.isBuffer(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeNumbers(item)) as unknown as T;
  }

  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    // Only walk plain objects. A class instance is left alone so its own
    // toJSON (if any) keeps controlling how it is serialized.
    if (prototype !== Object.prototype && prototype !== null) {
      return value;
    }
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      output[key] = normalizeNumbers(item);
    }
    return output as unknown as T;
  }

  return value;
}
