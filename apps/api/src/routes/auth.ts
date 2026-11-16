import type { AuthResponse, RefreshResponse } from '@studylog/shared';
import { loginInputSchema, registerInputSchema } from '@studylog/shared';
import type { Request, Response } from 'express';
import { Router } from 'express';

import { AppError } from '../lib/app-error.js';
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from '../lib/cookies.js';
import type { RateLimitCheck } from '../lib/rate-limit.js';
import { sha256Hex } from '../lib/tokens.js';
import { createRequireAuth, getAuthUserId } from '../middleware/require-auth.js';
import type { AuthService } from '../services/auth.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface AuthRouterDeps {
  service: AuthService;
  accessTokenSecret: string;
  secureCookies: boolean;
  refreshTokenTtlDays: number;
  rateLimit: RateLimitCheck;
}

function clientIp(req: Request): string {
  return req.ip ?? 'unknown';
}

/**
 * Emails become rate-limit keys through a hash: the store must not turn into a
 * list of user emails.
 */
function emailBucket(email: string): string {
  return `email:${sha256Hex(email)}`;
}

function readSubmittedEmail(req: Request): string | null {
  const body: unknown = req.body;
  if (typeof body !== 'object' || body === null || !('email' in body)) {
    return null;
  }
  const email = (body as { email: unknown }).email;
  return typeof email === 'string' ? email.trim().toLowerCase() : null;
}

export function createAuthRouter(deps: AuthRouterDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth(deps.accessTokenSecret);
  const cookieMaxAgeMs = deps.refreshTokenTtlDays * DAY_MS;
  const cookieOptions = { secure: deps.secureCookies, maxAgeMs: cookieMaxAgeMs };

  router.post('/register', async (req: Request, res: Response) => {
    // Rate limit first: a flood of invalid payloads must be throttled too.
    const submittedEmail = readSubmittedEmail(req);
    await deps.rateLimit.check(
      req,
      res,
      'register',
      submittedEmail
        ? [`ip:${clientIp(req)}`, emailBucket(submittedEmail)]
        : [`ip:${clientIp(req)}`],
    );

    const input = registerInputSchema.parse(req.body);
    const result = await deps.service.register(input, {
      userAgent: req.header('user-agent') ?? undefined,
    });

    setRefreshCookie(res, result.tokens.refreshToken, cookieOptions);

    const body: AuthResponse = {
      user: result.user,
      accessToken: result.tokens.accessToken,
    };
    res.status(201).json(body);
  });

  router.post('/login', async (req: Request, res: Response) => {
    const submittedEmail = readSubmittedEmail(req);
    await deps.rateLimit.check(
      req,
      res,
      'login',
      submittedEmail
        ? [`ip:${clientIp(req)}`, emailBucket(submittedEmail)]
        : [`ip:${clientIp(req)}`],
    );

    const input = loginInputSchema.parse(req.body);
    const result = await deps.service.login(input, {
      userAgent: req.header('user-agent') ?? undefined,
    });

    setRefreshCookie(res, result.tokens.refreshToken, cookieOptions);

    const body: AuthResponse = {
      user: result.user,
      accessToken: result.tokens.accessToken,
    };
    res.status(200).json(body);
  });

  router.post('/refresh', async (req: Request, res: Response) => {
    await deps.rateLimit.check(req, res, 'refresh', [`ip:${clientIp(req)}`]);

    const currentToken = readRefreshCookie(req);
    if (!currentToken) {
      throw new AppError('UNAUTHORIZED', 'Invalid session');
    }

    try {
      const tokens = await deps.service.refresh(currentToken, {
        userAgent: req.header('user-agent') ?? undefined,
      });

      setRefreshCookie(res, tokens.refreshToken, cookieOptions);

      const body: RefreshResponse = { accessToken: tokens.accessToken };
      res.status(200).json(body);
    } catch (error) {
      // Any failure means the cookie in the browser is useless: drop it so the
      // client stops retrying with a dead token.
      clearRefreshCookie(res, { secure: deps.secureCookies });
      throw error;
    }
  });

  router.post('/logout', async (req: Request, res: Response) => {
    await deps.service.logout(readRefreshCookie(req));
    clearRefreshCookie(res, { secure: deps.secureCookies });
    res.status(204).send();
  });

  router.get('/me', requireAuth, async (_req: Request, res: Response) => {
    const user = await deps.service.getCurrentUser(getAuthUserId(res));
    res.status(200).json(user);
  });

  return router;
}
