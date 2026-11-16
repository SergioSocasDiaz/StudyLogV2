import { randomUUID } from 'node:crypto';

import type { LoginInput, PublicUser, RegisterInput } from '@studylog/shared';

import type { Database } from '../db/client.js';
import { AppError } from '../lib/app-error.js';
import { hashPassword, verifyPassword, verifyPasswordAgainstDummy } from '../lib/password.js';
import {
  createRefreshToken,
  hashRefreshToken,
  newFamilyId,
  signAccessToken,
} from '../lib/tokens.js';
import type { RefreshTokenRow } from '../repositories/refresh-tokens.js';
import {
  findRefreshTokenByHash,
  insertRefreshToken,
  revokeRefreshToken,
  revokeRefreshTokenFamily,
  rotateRefreshToken,
} from '../repositories/refresh-tokens.js';
import type { UserRow } from '../repositories/users.js';
import { findUserByEmail, findUserById, insertUser } from '../repositories/users.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface AuthServiceConfig {
  accessTokenSecret: string;
  accessTokenTtlMinutes: number;
  refreshTokenTtlDays: number;
  reuseGraceSeconds: number;
  /** Injectable clock; tests use it to walk past the grace window. */
  now?: () => Date;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export interface AuthResult {
  user: PublicUser;
  tokens: SessionTokens;
}

export interface RequestMeta {
  userAgent?: string | undefined;
}

export interface AuthService {
  register(input: RegisterInput, meta?: RequestMeta): Promise<AuthResult>;
  login(input: LoginInput, meta?: RequestMeta): Promise<AuthResult>;
  refresh(rawRefreshToken: string, meta?: RequestMeta): Promise<SessionTokens>;
  logout(rawRefreshToken: string | null): Promise<void>;
  getCurrentUser(userId: string): Promise<PublicUser>;
}

function toPublicUser(user: UserRow): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    timezone: user.timezone,
    createdAt: user.createdAt.toISOString(),
  };
}

/**
 * Postgres reports a unique violation with SQLSTATE `23505`.
 *
 * Drizzle wraps driver errors in `DrizzleQueryError`, so the original `code`
 * lives in the `cause` chain rather than on the thrown object.
 */
function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;

  for (let depth = 0; depth < 5; depth += 1) {
    if (typeof current !== 'object' || current === null) {
      return false;
    }

    if ('code' in current && (current as { code?: unknown }).code === '23505') {
      return true;
    }

    current = (current as { cause?: unknown }).cause;
  }

  return false;
}

export function createAuthService(db: Database, config: AuthServiceConfig): AuthService {
  const now = config.now ?? (() => new Date());
  const graceMs = config.reuseGraceSeconds * 1000;

  async function signAccess(userId: string): Promise<string> {
    return signAccessToken(userId, config.accessTokenSecret, config.accessTokenTtlMinutes);
  }

  function refreshExpiry(current: Date): Date {
    return new Date(current.getTime() + config.refreshTokenTtlDays * DAY_MS);
  }

  async function startSession(
    userId: string,
    current: Date,
    meta: RequestMeta | undefined,
    familyId = newFamilyId(),
  ): Promise<SessionTokens> {
    const refresh = createRefreshToken();
    const expiresAt = refreshExpiry(current);

    await insertRefreshToken(db, {
      id: randomUUID(),
      userId,
      tokenHash: refresh.hash,
      familyId,
      expiresAt,
      userAgent: meta?.userAgent ?? null,
      createdAt: current,
    });

    return {
      accessToken: await signAccess(userId),
      refreshToken: refresh.token,
      refreshExpiresAt: expiresAt,
    };
  }

  /**
   * A sibling is a second live token inside the same family. It is issued when
   * a just-rotated token is replayed inside the grace window: two tabs that
   * refresh at the same instant both end up logged in, and neither loses the
   * session.
   */
  async function issueSibling(
    row: RefreshTokenRow,
    current: Date,
    meta: RequestMeta | undefined,
  ): Promise<SessionTokens> {
    return startSession(row.userId, current, meta, row.familyId);
  }

  return {
    async register(input, meta) {
      const current = now();
      const passwordHash = await hashPassword(input.password);

      let user: UserRow;
      try {
        user = await insertUser(db, {
          email: input.email,
          passwordHash,
          displayName: input.displayName,
          timezone: input.timezone,
          createdAt: current,
          updatedAt: current,
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          // Deliberately generic: the response must not confirm whether the
          // email exists. See docs/security-spec.md §12.
          throw new AppError('CONFLICT', 'Could not create the account with those details');
        }
        throw error;
      }

      const tokens = await startSession(user.id, current, meta);
      return { user: toPublicUser(user), tokens };
    },

    async login(input, meta) {
      const current = now();
      const user = await findUserByEmail(db, input.email);

      if (!user) {
        // Hash anyway so "unknown email" and "wrong password" take the same time.
        await verifyPasswordAgainstDummy(input.password);
        throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password');
      }

      const valid = await verifyPassword(user.passwordHash, input.password);
      if (!valid) {
        throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password');
      }

      const tokens = await startSession(user.id, current, meta);
      return { user: toPublicUser(user), tokens };
    },

    async refresh(rawRefreshToken, meta) {
      const current = now();
      const tokenHash = hashRefreshToken(rawRefreshToken);
      const row = await findRefreshTokenByHash(db, tokenHash);

      if (!row) {
        throw new AppError('UNAUTHORIZED', 'Invalid session');
      }

      if (row.expiresAt.getTime() <= current.getTime()) {
        throw new AppError('UNAUTHORIZED', 'Session expired');
      }

      if (!row.revokedAt) {
        const before = now();
        const refresh = createRefreshToken();
        const expiresAt = refreshExpiry(before);
        const nextId = randomUUID();

        const rotated = await rotateRefreshToken(db, {
          currentId: row.id,
          now: before,
          next: {
            id: nextId,
            userId: row.userId,
            tokenHash: refresh.hash,
            familyId: row.familyId,
            expiresAt,
            userAgent: meta?.userAgent ?? row.userAgent ?? null,
            createdAt: before,
          },
        });

        if (rotated) {
          return {
            accessToken: await signAccess(row.userId),
            refreshToken: refresh.token,
            refreshExpiresAt: expiresAt,
          };
        }

        // Another request won the race microseconds ago: behave as a grace
        // replay instead of failing the user's second tab.
        return issueSibling(row, current, meta);
      }

      const withinGrace =
        graceMs > 0 &&
        row.revokedReason === 'rotated' &&
        row.revokedAt !== null &&
        current.getTime() - row.revokedAt.getTime() <= graceMs;

      if (withinGrace) {
        return issueSibling(row, current, meta);
      }

      // Reuse outside the window is treated as a stolen token: the whole family
      // dies and every device has to log in again.
      await revokeRefreshTokenFamily(db, {
        familyId: row.familyId,
        now: current,
        reason: 'reuse',
      });

      throw new AppError('UNAUTHORIZED', 'Session is no longer valid');
    },

    async logout(rawRefreshToken) {
      if (!rawRefreshToken) {
        return;
      }

      const current = now();
      const row = await findRefreshTokenByHash(db, hashRefreshToken(rawRefreshToken));

      if (row && !row.revokedAt) {
        await revokeRefreshToken(db, { id: row.id, now: current, reason: 'logout' });
      }
    },

    async getCurrentUser(userId) {
      const user = await findUserById(db, userId);
      if (!user) {
        throw new AppError('UNAUTHORIZED', 'Authentication required');
      }
      return toPublicUser(user);
    },
  };
}
