import type { ApiError } from '@studylog/shared';
import type { Request, Response } from 'express';

export function notFound(req: Request, res: Response): void {
  const body: ApiError = {
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`,
    },
  };
  res.status(404).json(body);
}
