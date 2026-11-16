import type { RequestHandler } from 'express';

import { AppError } from '../lib/app-error.js';
import { logger } from '../lib/logger.js';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function originOf(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * CSRF defence in depth, on top of `SameSite=Lax`.
 *
 * A browser always attaches `Origin` (or at least `Referer`) to a cross-site
 * mutating request, so an allowlist blocks forged requests from other sites.
 * Requests without either header come from non-browser clients (curl, tests,
 * server-to-server) and cannot carry a victim's cookie, so they are allowed.
 */
export function createOriginCheck(allowedOrigins: string[]): RequestHandler {
  const allowed = new Set(allowedOrigins.map((origin) => origin.replace(/\/$/, '')));

  return (req, res, next) => {
    if (!MUTATING_METHODS.has(req.method)) {
      next();
      return;
    }

    const origin = originOf(req.header('origin')) ?? originOf(req.header('referer'));

    if (!origin) {
      logger.debug({ requestId: res.locals.requestId }, 'mutation without Origin/Referer allowed');
      next();
      return;
    }

    if (!allowed.has(origin)) {
      next(new AppError('FORBIDDEN', 'Origin not allowed'));
      return;
    }

    next();
  };
}
