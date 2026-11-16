import { resolve } from 'node:path';

import { config } from 'dotenv';
import { z } from 'zod';

config({ path: resolve(process.cwd(), '../../.env'), quiet: true });
config({ path: resolve(process.cwd(), '.env'), override: true, quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url().default('postgres://studylog:studylog@localhost:5432/studylog'),
  JWT_ACCESS_SECRET: z.string().min(32).default('dev-only-secret-change-me-at-least-32-chars'),
  ACCESS_TOKEN_TTL: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  /**
   * Comma-separated list. Every origin allowed to send a mutable request
   * (CSRF protection). Keep it exact: no wildcards.
   */
  APP_ORIGIN: z.string().default('http://127.0.0.1:5173'),
  REFRESH_REUSE_GRACE_SECONDS: z.coerce.number().int().min(0).default(10),
  AUTH_RATE_LIMIT_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  AUTH_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

if (parsed.data.NODE_ENV === 'production' && parsed.data.JWT_ACCESS_SECRET.startsWith('dev-only')) {
  throw new Error('JWT_ACCESS_SECRET must be configured in production');
}

const allowedOrigins = parsed.data.APP_ORIGIN.split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter((origin) => origin.length > 0);

export const env = {
  ...parsed.data,
  allowedOrigins,
  isProduction: parsed.data.NODE_ENV === 'production',
};
