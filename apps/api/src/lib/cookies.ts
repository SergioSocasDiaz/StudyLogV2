import { REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH } from '@studylog/shared';
import type { Request, Response } from 'express';

export interface CookieOptions {
  /** `true` in production: the cookie never travels over plain HTTP. */
  secure: boolean;
  maxAgeMs: number;
}

/**
 * The refresh cookie is scoped to `/api/v1/auth`, so the browser never sends it
 * to subjects, sessions or stats. That shrinks the surface of a CSRF attack and
 * keeps the long-lived secret away from ordinary requests.
 */
function baseOptions(options: CookieOptions) {
  return {
    httpOnly: true,
    secure: options.secure,
    sameSite: 'lax' as const,
    path: REFRESH_COOKIE_PATH,
  };
}

export function setRefreshCookie(res: Response, token: string, options: CookieOptions): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...baseOptions(options),
    maxAge: options.maxAgeMs,
  });
}

export function clearRefreshCookie(res: Response, options: Pick<CookieOptions, 'secure'>): void {
  res.clearCookie(REFRESH_COOKIE_NAME, baseOptions({ secure: options.secure, maxAgeMs: 0 }));
}

/**
 * Express only parses cookies with `cookie-parser`; a single well-known cookie
 * does not justify a dependency, so it is parsed here.
 */
export function readRefreshCookie(req: Request): string | null {
  const header = req.headers.cookie;
  if (!header) {
    return null;
  }

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) {
      continue;
    }

    const name = part.slice(0, separator).trim();
    if (name !== REFRESH_COOKIE_NAME) {
      continue;
    }

    const rawValue = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }

  return null;
}
