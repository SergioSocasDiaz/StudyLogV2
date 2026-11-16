import { relations, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/**
 * Emails are stored lowercase and compared case-insensitively.
 *
 * The reference model used `citext`, but that needs `postgresql-contrib`, which
 * is not guaranteed to exist in every environment (it is missing in a stock
 * local install). A unique index on `lower(email)` plus a lowercase check gives
 * the same guarantees with plain Postgres: `Ana@Example.com` and
 * `ana@example.com` cannot coexist. See `docs/database-spec.md` §3.1.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    displayName: text('display_name').notNull(),
    timezone: text('timezone').notNull().default('UTC'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('users_email_lower_unique').on(sql`lower(${table.email})`),
    check('users_email_lowercase', sql`${table.email} = lower(${table.email})`),
    check('users_display_name_not_blank', sql`length(btrim(${table.displayName})) > 0`),
  ],
);

export const refreshTokenRevokedReasons = ['rotated', 'logout', 'reuse'] as const;
export type RefreshTokenRevokedReason = (typeof refreshTokenRevokedReasons)[number];

/**
 * One row per refresh token ever issued.
 *
 * `family_id` groups every token produced by a single login (one family per
 * device/session). `replaced_by_id` records the rotation chain so a replay can
 * be traced. `revoked_reason` separates a normal rotation from theft detection,
 * which is what makes the multi-tab grace window possible.
 */
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    familyId: uuid('family_id').notNull(),
    replacedById: uuid('replaced_by_id').references((): AnyPgColumn => refreshTokens.id, {
      onDelete: 'set null',
    }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedReason: text('revoked_reason', { enum: refreshTokenRevokedReasons }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('refresh_tokens_user_id_idx').on(table.userId),
    index('refresh_tokens_family_id_idx').on(table.familyId),
    index('refresh_tokens_expires_at_idx').on(table.expiresAt),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  refreshTokens: many(refreshTokens),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, { fields: [refreshTokens.userId], references: [users.id] }),
}));
