const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

/** Parses values like "15m", "7d", "30s", "12h" into milliseconds. */
export function durationToMs(value: string | undefined | null, fallbackMs: number): number {
  if (!value) return fallbackMs;
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) return fallbackMs;
  return Number(match[1]) * UNIT_MS[match[2]];
}
