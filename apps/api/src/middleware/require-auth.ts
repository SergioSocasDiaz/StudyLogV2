import type { RequestHandler } from 'express';

import { AppError } from '../lib/app-error.js';
import { verifyAccessToken } from '../lib/tokens.js';

/**
 * Protects a route with the short-lived access token.
 *
 * The verified user id is stored in `res.locals.authUserId`. Handlers must use
 * that and never a `userId` coming from the request.
 */
export function createRequireAuth(secret: string): RequestHandler {
  return async (req, res, next) => {
    try {
      const header = req.header('authorization');

      if (!header?.startsWith('Bearer ')) {
        throw new AppError('UNAUTHORIZED', 'Authentication required');
      }

      const token = header.slice('Bearer '.length).trim();
      if (!token) {
        throw new AppError('UNAUTHORIZED', 'Authentication required');
      }

      try {
        const claims = await verifyAccessToken(token, secret);
        res.locals.authUserId = claims.userId;
        next();
      } catch {
        throw new AppError('UNAUTHORIZED', 'Access token is invalid or expired');
      }
    } catch (error) {
      next(error);
    }
  };
}

export function getAuthUserId(res: { locals: Record<string, unknown> }): string {
  const userId = res.locals.authUserId;
  if (typeof userId !== 'string') {
    throw new AppError('UNAUTHORIZED', 'Authentication required');
  }
  return userId;
}
