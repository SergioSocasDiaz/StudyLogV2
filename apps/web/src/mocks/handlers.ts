import type { AuthResponse, ErrorCode, PublicUser } from '@studylog/shared';
import { http, HttpResponse } from 'msw';

import {
  authMockState,
  currentMockUser,
  endMockSession,
  findMockUser,
  rotateMockToken,
  seedMockUser,
  startMockSession,
} from './auth-state';

const AUTH_PATH = '/api/v1/auth';

function errorResponse(status: number, code: ErrorCode, message: string): Response {
  return HttpResponse.json({ error: { code, message } }, { status });
}

function readBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) {
    return null;
  }
  return header.slice('Bearer '.length).trim();
}

interface Credentials {
  email?: unknown;
  password?: unknown;
  displayName?: unknown;
  timezone?: unknown;
}

async function readBody(request: Request): Promise<Credentials> {
  const body: unknown = await request.json().catch(() => ({}));
  return typeof body === 'object' && body !== null ? (body as Credentials) : {};
}

export const handlers = [
  http.get('/api/health', () =>
    HttpResponse.json({
      status: 'ok',
      database: 'up',
      timestamp: new Date(0).toISOString(),
    }),
  ),

  http.post(`${AUTH_PATH}/register`, async ({ request }) => {
    const body = await readBody(request);
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const displayName = typeof body.displayName === 'string' ? body.displayName : '';
    const timezone = typeof body.timezone === 'string' ? body.timezone : 'UTC';

    if (!email || !password || password.length < 12 || !displayName) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Invalid request');
    }

    if (findMockUser(email)) {
      return errorResponse(409, 'CONFLICT', 'Could not create the account with those details');
    }

    const user = seedMockUser({ email, password, displayName, timezone });
    const response: AuthResponse = { user, accessToken: startMockSession(user.id) };
    return HttpResponse.json(response, { status: 201 });
  }),

  http.post(`${AUTH_PATH}/login`, async ({ request }) => {
    authMockState.loginCalls += 1;

    const body = await readBody(request);
    const email = typeof body.email === 'string' ? body.email : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const record = findMockUser(email);

    if (!record || record.password !== password) {
      return errorResponse(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const response: AuthResponse = {
      user: record.user,
      accessToken: startMockSession(record.user.id),
    };
    return HttpResponse.json(response, { status: 200 });
  }),

  http.post(`${AUTH_PATH}/refresh`, () => {
    authMockState.refreshCalls += 1;

    if (!currentMockUser()) {
      return errorResponse(401, 'UNAUTHORIZED', 'Invalid session');
    }

    return HttpResponse.json({ accessToken: rotateMockToken() }, { status: 200 });
  }),

  http.post(`${AUTH_PATH}/logout`, () => {
    endMockSession();
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${AUTH_PATH}/me`, ({ request }) => {
    authMockState.meCalls += 1;

    const token = readBearerToken(request);
    if (!token || !authMockState.validTokens.has(token)) {
      return errorResponse(401, 'UNAUTHORIZED', 'Authentication required');
    }

    const user: PublicUser | null = currentMockUser();
    if (!user) {
      return errorResponse(401, 'UNAUTHORIZED', 'Authentication required');
    }

    return HttpResponse.json(user);
  }),
];
