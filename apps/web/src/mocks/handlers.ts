import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/health', () =>
    HttpResponse.json({
      status: 'ok',
      database: 'up',
      timestamp: new Date(0).toISOString(),
    }),
  ),
];
