import { Prisma } from '@prisma/client';
import { normalizeNumbers } from './normalize-numbers.util';

describe('normalizeNumbers', () => {
  it('turns a Prisma Decimal into a number', () => {
    const result = normalizeNumbers({ percentage: new Prisma.Decimal('85.5') });
    expect(result.percentage).toBe(85.5);
    expect(typeof result.percentage).toBe('number');
  });

  it('makes decimal fields safe for arithmetic, which is the actual failure', () => {
    // The bug this prevents: a string on the wire makes .toFixed undefined.
    const result = normalizeNumbers({ result: { percentage: new Prisma.Decimal('0') } });
    expect(result.result.percentage.toFixed(1)).toBe('0.0');
  });

  it('walks nested objects and arrays', () => {
    const result = normalizeNumbers({
      data: [{ result: { score: new Prisma.Decimal('40'), maxScore: new Prisma.Decimal('45') } }],
    });
    expect(result.data[0].result.score).toBe(40);
    expect(result.data[0].result.maxScore).toBe(45);
  });

  it('converts bigint counts, which would otherwise throw during serialization', () => {
    const result = normalizeNumbers({ _count: { all: 7n } });
    expect(result._count.all).toBe(7);
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it('preserves null and undefined', () => {
    expect(normalizeNumbers({ a: null, b: undefined })).toEqual({ a: null, b: undefined });
  });

  it('leaves dates and buffers to their own serialization', () => {
    const date = new Date('2026-09-29T00:00:00.000Z');
    const buffer = Buffer.from('logo');
    const result = normalizeNumbers({ date, buffer });
    expect(result.date).toBe(date);
    expect(result.buffer).toBe(buffer);
  });

  it('does not descend into class instances', () => {
    class Custom {
      value = new Prisma.Decimal('1.5');
    }
    const instance = new Custom();
    expect(normalizeNumbers({ instance }).instance).toBe(instance);
  });

  it('survives a JSON round trip with numeric types intact', () => {
    const wire = JSON.parse(JSON.stringify(normalizeNumbers({ percentage: new Prisma.Decimal('12.34') })));
    expect(typeof wire.percentage).toBe('number');
    expect(wire.percentage).toBe(12.34);
  });
});
