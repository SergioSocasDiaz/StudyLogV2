import type { ApiError } from '@studylog/shared';
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import { AppError } from '../lib/app-error.js';
import { logger } from '../lib/logger.js';

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (res.headersSent) {
    return;
  }

  const requestId = typeof res.locals.requestId === 'string' ? res.locals.requestId : undefined;

  if (error instanceof ZodError) {
    const body: ApiError = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        details: error.flatten(),
      },
    };
    res.status(422).json(body);
    return;
  }

  if (error instanceof AppError) {
    const body: ApiError = {
      error: {
        code: error.code,
        message: error.message,
      },
    };
    if (error.details !== undefined) {
      body.error.details = error.details;
    }
    res.status(error.status).json(body);
    return;
  }

  logger.error(
    { error, requestId, method: req.method, path: req.originalUrl },
    'unhandled request error',
  );

  const body: ApiError = {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    },
  };
  res.status(500).json(body);
}
