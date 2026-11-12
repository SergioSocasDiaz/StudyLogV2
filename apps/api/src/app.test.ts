import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from './app';

describe('HTTP app', () => {
  it('responds to the liveness probe and echoes a request id', async () => {
    const response = await request(createApp()).get('/api/health/live');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.headers['x-request-id']).toBeTruthy();
  });

  it('reports the database as available', async () => {
    const app = createApp({ checkDatabase: async () => true });
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok', database: 'up' });
  });

  it('returns 503 when the database is unavailable', async () => {
    const app = createApp({ checkDatabase: async () => false });
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'error', database: 'down' });
  });

  it('returns the shared 404 envelope for unknown routes', async () => {
    const response = await request(createApp()).get('/api/unknown');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Route GET /api/unknown not found',
      },
    });
  });
});
