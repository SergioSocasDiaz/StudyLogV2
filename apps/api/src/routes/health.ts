import { Router } from 'express';

import { checkDatabase } from '../db/client.js';

export type DatabaseCheck = () => Promise<boolean>;

export function createHealthRouter(databaseCheck: DatabaseCheck = checkDatabase): Router {
  const router = Router();

  router.get('/live', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
    });
  });

  router.get('/', async (_req, res, next) => {
    try {
      const database = await databaseCheck();

      if (!database) {
        res.status(503).json({ status: 'error', database: 'down' });
        return;
      }

      res.status(200).json({
        status: 'ok',
        database: 'up',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
