import type { Express } from 'express';
import express from 'express';

import { logger } from './lib/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFound } from './middleware/not-found.js';
import { requestId } from './middleware/request-id.js';
import { createHealthRouter } from './routes/health.js';

export interface CreateAppOptions {
  checkDatabase?: () => Promise<boolean>;
}

export function createApp(options: CreateAppOptions = {}): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(requestId);
  app.use((req, res, next) => {
    const startedAt = Date.now();

    res.on('finish', () => {
      logger.info(
        {
          requestId: res.locals.requestId,
          method: req.method,
          path: req.originalUrl,
          status: res.statusCode,
          durationMs: Date.now() - startedAt,
        },
        'request completed',
      );
    });

    next();
  });

  app.use(express.json({ limit: '100kb' }));
  app.use('/api/health', createHealthRouter(options.checkDatabase));
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
