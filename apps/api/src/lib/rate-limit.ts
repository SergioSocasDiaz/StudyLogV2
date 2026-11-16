import type { Request, Response } from 'express';

import { AppError } from './app-error.js';
import { logger } from './logger.js';

export interface RateLimitResult {
  /** Requests seen in the current window, including this one. */
  count: number;
  /** Epoch milliseconds at which the window resets. */
  resetAt: number;
}

export interface RateLimitStore {
  hit(key: string, windowMs: number): Promise<RateLimitResult>;
}

export interface RateLimitSettings {
  store: RateLimitStore;
  maxAttempts: number;
  windowMs: number;
}

/**
 * In-process store: good for local development, CI and tests. In serverless it
 * only sees the requests that happen to land on the same instance, so it is a
 * speed bump, not a real limit. Production should point `UPSTASH_*` at Redis.
 */
export function createMemoryRateLimitStore(now: () => number = Date.now): RateLimitStore {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  const MAX_BUCKETS = 10_000;

  function prune(current: number): void {
    if (buckets.size < MAX_BUCKETS) {
      return;
    }
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= current) {
        buckets.delete(key);
      }
    }
  }

  return {
    async hit(key: string, windowMs: number): Promise<RateLimitResult> {
      const current = now();
      const existing = buckets.get(key);

      if (!existing || existing.resetAt <= current) {
        prune(current);
        const bucket = { count: 1, resetAt: current + windowMs };
        buckets.set(key, bucket);
        return { count: bucket.count, resetAt: bucket.resetAt };
      }

      existing.count += 1;
      return { count: existing.count, resetAt: existing.resetAt };
    },
  };
}

interface UpstashOptions {
  url: string;
  token: string;
  fetchImpl?: typeof fetch;
}

interface UpstashPipelineEntry {
  result?: number | string | null;
  error?: string;
}

/**
 * Distributed store backed by Upstash's REST API.
 *
 * No SDK: the protocol is a JSON array of Redis commands. `INCR` counts,
 * `PEXPIRE ... NX` sets the window only the first time, and `PTTL` reports how
 * long is left so `Retry-After` can be accurate. One round trip per check.
 */
export function createUpstashRateLimitStore(options: UpstashOptions): RateLimitStore {
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    async hit(key: string, windowMs: number): Promise<RateLimitResult> {
      const response = await fetchImpl(`${options.url}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          ['INCR', key],
          ['PEXPIRE', key, String(windowMs), 'NX'],
          ['PTTL', key],
        ]),
      });

      if (!response.ok) {
        throw new Error(`Upstash rate limit failed with status ${response.status}`);
      }

      const body = (await response.json()) as UpstashPipelineEntry[];
      const count = Number(body[0]?.result ?? 0);
      const ttl = Number(body[2]?.result ?? windowMs);
      const effectiveTtl = Number.isFinite(ttl) && ttl > 0 ? ttl : windowMs;

      return { count, resetAt: Date.now() + effectiveTtl };
    },
  };
}

export interface RateLimitCheck {
  /** Applies every key and throws `RATE_LIMITED` when one of them is exhausted. */
  check(req: Request, res: Response, scope: string, identifiers: string[]): Promise<void>;
}

/**
 * Builds the checker used by the auth routes.
 *
 * Each identifier is a bucket on its own (`ip:1.2.3.4`, `email:<sha256>`), so a
 * request is rejected as soon as any bucket is full. Emails are hashed before
 * they become keys: a Redis dump should not be a list of user emails.
 */
export function createRateLimit(settings: RateLimitSettings): RateLimitCheck {
  return {
    async check(req, res, scope, identifiers): Promise<void> {
      for (const identifier of identifiers) {
        const key = `ratelimit:auth:${scope}:${identifier}`;
        let result: RateLimitResult;

        try {
          result = await settings.store.hit(key, settings.windowMs);
        } catch (error) {
          // Fail open: an unreachable cache must not take login down. The
          // failure is logged so it is visible in monitoring.
          logger.warn({ error, scope, requestId: res.locals.requestId }, 'rate limit store failed');
          return;
        }

        if (result.count > settings.maxAttempts) {
          const retryAfterSeconds = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
          res.setHeader('Retry-After', String(retryAfterSeconds));
          throw new AppError('RATE_LIMITED', 'Too many attempts. Try again later.', {
            retryAfterSeconds,
          });
        }
      }

      logger.debug(
        { scope, method: req.method, requestId: res.locals.requestId },
        'rate limit passed',
      );
    },
  };
}
