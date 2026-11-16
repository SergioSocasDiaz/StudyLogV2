import { eq } from 'drizzle-orm';

import type { Database } from '../db/client.js';
import { users } from '../db/schema.js';

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;

/**
 * Emails are compared lowercase because that is how they are stored (the Zod
 * contract normalises them and the database enforces the invariant).
 */
export async function findUserByEmail(db: Database, email: string): Promise<UserRow | undefined> {
  const rows = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);

  return rows[0];
}

export async function findUserById(db: Database, id: string): Promise<UserRow | undefined> {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0];
}

export async function insertUser(db: Database, values: NewUserRow): Promise<UserRow> {
  const rows = await db.insert(users).values(values).returning();
  const user = rows[0];

  if (!user) {
    throw new Error('Insert returned no user');
  }

  return user;
}
