import { and, eq, isNull } from 'drizzle-orm';

import type { Database } from '../db/client.js';
import type { RefreshTokenRevokedReason } from '../db/schema.js';
import { refreshTokens } from '../db/schema.js';

export type RefreshTokenRow = typeof refreshTokens.$inferSelect;
export type NewRefreshTokenRow = typeof refreshTokens.$inferInsert;

/**
 * Repository functions accept either the pool-backed database or an open
 * transaction, so rotation can be atomic.
 */
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
export type DbExecutor = Database | Transaction;

export async function findRefreshTokenByHash(
  db: DbExecutor,
  tokenHash: string,
): Promise<RefreshTokenRow | undefined> {
  const rows = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash))
    .limit(1);

  return rows[0];
}

export async function insertRefreshToken(
  db: DbExecutor,
  values: NewRefreshTokenRow,
): Promise<void> {
  await db.insert(refreshTokens).values(values);
}

class RotationRaceError extends Error {}

/**
 * Marks the current token as rotated and stores its successor, atomically.
 *
 * The `revoked_at IS NULL` guard makes the operation idempotent under
 * concurrency: if two requests present the same token at the same moment, only
 * one wins and the other is reported as a lost race (it will fall back to the
 * grace-window path). Without the guard, one flow could overwrite a `reuse`
 * revocation with `rotated`.
 */
export async function rotateRefreshToken(
  db: Database,
  input: { currentId: string; next: NewRefreshTokenRow; now: Date },
): Promise<boolean> {
  try {
    await db.transaction(async (tx) => {
      // The successor is inserted first because `replaced_by_id` is a foreign
      // key pointing at it; the whole thing rolls back if the guard fails.
      await tx.insert(refreshTokens).values(input.next);

      const revoked = await tx
        .update(refreshTokens)
        .set({
          revokedAt: input.now,
          revokedReason: 'rotated',
          replacedById: input.next.id,
        })
        .where(and(eq(refreshTokens.id, input.currentId), isNull(refreshTokens.revokedAt)))
        .returning({ id: refreshTokens.id });

      if (revoked.length === 0) {
        throw new RotationRaceError('refresh token was already rotated');
      }
    });

    return true;
  } catch (error) {
    if (error instanceof RotationRaceError) {
      return false;
    }
    throw error;
  }
}

export async function revokeRefreshToken(
  db: DbExecutor,
  input: { id: string; now: Date; reason: RefreshTokenRevokedReason },
): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: input.now, revokedReason: input.reason })
    .where(and(eq(refreshTokens.id, input.id), isNull(refreshTokens.revokedAt)));
}

/** Revokes every still-active token of a family, e.g. after theft detection. */
export async function revokeRefreshTokenFamily(
  db: DbExecutor,
  input: { familyId: string; now: Date; reason: RefreshTokenRevokedReason },
): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: input.now, revokedReason: input.reason })
    .where(and(eq(refreshTokens.familyId, input.familyId), isNull(refreshTokens.revokedAt)));
}
