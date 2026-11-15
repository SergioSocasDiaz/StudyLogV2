import { logger } from '../lib/logger.js';
import { closeDatabase, pool } from './client.js';

async function seed(): Promise<void> {
  await pool.query('select 1');
  logger.info('Phase 0 seed: database reachable; no demo data yet');
  await closeDatabase();
}

seed().catch((error: unknown) => {
  logger.error({ error }, 'seed failed');
  process.exitCode = 1;
});
