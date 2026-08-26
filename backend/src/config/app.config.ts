import { z } from 'zod';

function boolEnv(defaultValue: boolean) {
  return z.preprocess((value) => {
    if (value === undefined || value === null || value === '') return defaultValue;
    if (typeof value === 'string') {
      if (['1', 'true', 'yes', 'on'].includes(value.toLowerCase())) return true;
      if (['0', 'false', 'no', 'off'].includes(value.toLowerCase())) return false;
      return defaultValue;
    }
    return Boolean(value);
  }, z.boolean());
}

const PLACEHOLDER_SECRET_PATTERNS = [/change[_-]?me/i, /dev[-_]?only/i, /placeholder/i];
const LOCAL_ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  API_PREFIX: z.string().default('api/v1'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  CORS_ORIGIN: z.string().optional(),
  DATABASE_URL: z.string().url(),
  DIRECT_DATABASE_URL: z.string().url().optional(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: boolEnv(false),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  COOKIE_PATH: z.string().default('/'),
  SWAGGER_ENABLED: boolEnv(true),
  BCRYPT_ROUNDS: z.coerce.number().min(10).default(12),
  RATE_LIMIT_TTL: z.coerce.number().default(60),
  RATE_LIMIT_LIMIT: z.coerce.number().default(120),
  REDIS_URL: z.string().url().optional().default('redis://localhost:6379'),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),
  DB_POOL_SIZE: z.coerce.number().min(1).max(100).default(20),
});

export type AppEnv = z.infer<typeof schema>;

/** Comma-separated env value -> trimmed, de-duplicated list of origins. */
export function parseOrigins(value: string | undefined | null): string[] {
  if (!value) return [];
  const list = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return [...new Set(list)];
}

/**
 * Fails fast when a production deployment is configured unsafely.
 * Called once during bootstrap so misconfiguration never reaches runtime.
 */
function assertProductionReady(config: AppEnv) {
  const problems: string[] = [];

  const frontendOrigins = parseOrigins(config.FRONTEND_URL);
  if (frontendOrigins.length === 0) {
    problems.push('FRONTEND_URL must list at least one public origin');
  } else if (frontendOrigins.some((origin) => LOCAL_ORIGIN_PATTERN.test(origin))) {
    problems.push(`FRONTEND_URL contains a localhost origin (${frontendOrigins.join(', ')})`);
  }

  const corsOrigins = parseOrigins(config.CORS_ORIGIN ?? config.FRONTEND_URL);
  if (corsOrigins.length === 0) {
    problems.push('CORS_ORIGIN must be set for the Socket.IO gateway');
  } else if (corsOrigins.some((origin) => LOCAL_ORIGIN_PATTERN.test(origin))) {
    problems.push(`CORS_ORIGIN contains a localhost origin (${corsOrigins.join(', ')})`);
  }

  for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
    if (PLACEHOLDER_SECRET_PATTERNS.some((pattern) => pattern.test(config[key]))) {
      problems.push(`${key} looks like a placeholder secret — generate a strong random value`);
    }
  }

  if (!config.COOKIE_SECURE) {
    problems.push('COOKIE_SECURE must be enabled in production (auth cookies require HTTPS)');
  }
  if (config.COOKIE_SAME_SITE === 'none' && !config.COOKIE_SECURE) {
    problems.push('COOKIE_SAME_SITE=none requires COOKIE_SECURE=true');
  }

  if (problems.length > 0) {
    throw new Error(
      `Refusing to start with NODE_ENV=production due to unsafe configuration:\n  - ${problems.join('\n  - ')}`,
    );
  }
}

export function validateConfig(config: Record<string, unknown>) {
  const parsed = schema.safeParse(config);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
  }
  const production = parsed.data.NODE_ENV === 'production';
  // Production defaults: secure cookies unless explicitly disabled.
  if (production && config.COOKIE_SECURE === undefined) {
    parsed.data.COOKIE_SECURE = true;
  }
  if (production && config.SWAGGER_ENABLED === undefined) {
    parsed.data.SWAGGER_ENABLED = false;
  }
  if (production) {
    assertProductionReady(parsed.data);
  }
  return parsed.data;
}

export const appConfig = () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
});
