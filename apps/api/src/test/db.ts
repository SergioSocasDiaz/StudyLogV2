import { fileURLToPath } from 'node:url';

import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { db } from '../db/client.js';

let migrated = false;

/**
 * Applies every pending migration to the local test database.
 *
 * Integration tests run against a **real** Postgres, never a mock: constraints,
 * unique indexes and transactions are part of what the tests must prove.
 */
export async function ensureMigrations(): Promise<void> {
  if (migrated) {
    return;
  }

  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)),
  });
  migrated = true;
}

/** Empties the auth tables between tests, keeping the schema in place. */
export async function resetAuthTables(): Promise<void> {
  await db.execute(sql.raw('truncate table refresh_tokens, users restart identity cascade'));
}
