import { API_PREFIX } from '@studylog/shared';
import type { Express } from 'express';
import express from 'express';

import { env } from './config/env.js';
import type { Database } from './db/client.js';
import { db } from './db/client.js';
import { logger } from './lib/logger.js';
import type { RateLimitStore } from './lib/rate-limit.js';
import {
  createMemoryRateLimitStore,
  createRateLimit,
  createUpstashRateLimitStore,
} from './lib/rate-limit.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFound } from './middleware/not-found.js';
import { createOriginCheck } from './middleware/origin-check.js';
import { requestId } from './middleware/request-id.js';
import { createAuthRouter } from './routes/auth.js';
import { createHealthRouter } from './routes/health.js';
import { createAuthService } from './services/auth.js';

export interface AuthOverrides {
  db?: Database;
  now?: () => Date;
  rateLimitStore?: RateLimitStore;
  rateLimitMaxAttempts?: number;
  rateLimitWindowMs?: number;
  secureCookies?: boolean;
}

export interface CreateAppOptions {
  checkDatabase?: () => Promise<boolean>;
  auth?: AuthOverrides;
}

function defaultRateLimitStore(): RateLimitStore {
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    return createUpstashRateLimitStore({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
  }

  if (env.NODE_ENV !== 'test') {
    logger.warn(
      'UPSTASH_REDIS_REST_URL is not configured; auth rate limiting uses in-memory buckets (per instance only)',
    );
  }
  return createMemoryRateLimitStore();
}

export function createApp(options: CreateAppOptions = {}): Express {
  const app = express();
  const authOptions = options.auth ?? {};
  const database = authOptions.db ?? db;

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(requestId);
  app.use((req, res, next) => {
    const startedAt = Date.now();

    res.on('finish', () => {
      logger.info(
        {
          requestId: res.locals.requestId,
          method: req.method,
          path: req.originalUrl,
          status: res.statusCode,
          durationMs: Date.now() - startedAt,
        },
        'request completed',
      );
    });

    next();
  });

  app.use(express.json({ limit: '100kb' }));
  app.use('/api/health', createHealthRouter(options.checkDatabase));

  const authService = createAuthService(database, {
    accessTokenSecret: env.JWT_ACCESS_SECRET,
    accessTokenTtlMinutes: env.ACCESS_TOKEN_TTL,
    refreshTokenTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
    reuseGraceSeconds: env.REFRESH_REUSE_GRACE_SECONDS,
    ...(authOptions.now ? { now: authOptions.now } : {}),
  });

  const rateLimit = createRateLimit({
    store: authOptions.rateLimitStore ?? defaultRateLimitStore(),
    maxAttempts: authOptions.rateLimitMaxAttempts ?? env.AUTH_RATE_LIMIT_MAX_ATTEMPTS,
    windowMs: authOptions.rateLimitWindowMs ?? env.AUTH_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  });

  app.use(API_PREFIX, createOriginCheck(env.allowedOrigins));
  app.use(
    `${API_PREFIX}/auth`,
    createAuthRouter({
      service: authService,
      accessTokenSecret: env.JWT_ACCESS_SECRET,
      secureCookies: authOptions.secureCookies ?? env.isProduction,
      refreshTokenTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
      rateLimit,
    }),
  );

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
