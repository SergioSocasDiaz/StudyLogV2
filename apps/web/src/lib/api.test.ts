import type { PublicUser } from '@studylog/shared';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import {
  authMockState,
  expireMockAccessTokens,
  seedMockUser,
  startMockSession,
} from '../mocks/auth-state';
import { server } from '../mocks/server';
import { apiFetch, ApiRequestError, AUTH_EXPIRED_EVENT } from './api';
import { getAccessToken, setAccessToken } from './auth-store';

const PASSWORD = 'supersecret123';

async function captureRejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => null,
    (error: unknown) => error,
  );
}

describe('apiFetch', () => {
  it('adjunta el token en memoria como Bearer', async () => {
    let authorization: string | null = null;

    server.use(
      http.get('/api/v1/eco', ({ request }) => {
        authorization = request.headers.get('authorization');
        return HttpResponse.json({ ok: true });
      }),
    );

    setAccessToken('token-en-memoria');

    await apiFetch('/api/v1/eco');

    expect(authorization).toBe('Bearer token-en-memoria');
  });

  it('no adjunta Authorization cuando auth es false', async () => {
    let authorization: string | null = null;

    server.use(
      http.get('/api/v1/eco', ({ request }) => {
        authorization = request.headers.get('authorization');
        return HttpResponse.json({ ok: true });
      }),
    );

    setAccessToken('token-en-memoria');

    await apiFetch('/api/v1/eco', undefined, { auth: false });

    expect(authorization).toBeNull();
  });

  it('añade un x-request-id no vacío', async () => {
    let requestId: string | null = null;

    server.use(
      http.get('/api/v1/eco', ({ request }) => {
        requestId = request.headers.get('x-request-id');
        return HttpResponse.json({ ok: true });
      }),
    );

    await apiFetch('/api/v1/eco');

    expect(requestId).toEqual(expect.any(String));
    expect(requestId).not.toBe('');
  });

  it('conserva el mismo x-request-id en el reintento posterior a un 401', async () => {
    const requestIds: Array<string | null> = [];
    let calls = 0;

    server.use(
      http.get('/api/v1/eco', ({ request }) => {
        calls += 1;
        requestIds.push(request.headers.get('x-request-id'));

        if (calls === 1) {
          return HttpResponse.json(
            { error: { code: 'UNAUTHORIZED', message: 'Expired token' } },
            { status: 401 },
          );
        }

        return HttpResponse.json({ ok: true });
      }),
    );

    const user = seedMockUser({ email: 'ana@example.com', password: PASSWORD });
    const token = startMockSession(user.id);
    expireMockAccessTokens();
    setAccessToken(token);

    await apiFetch('/api/v1/eco');

    expect(calls).toBe(2);
    expect(requestIds).toHaveLength(2);
    expect(requestIds[0]).toEqual(expect.any(String));
    expect(requestIds[0]).not.toBe('');
    expect(requestIds[1]).toBe(requestIds[0]);
  });

  it('comparte un único refresh entre cinco peticiones simultáneas a /me', async () => {
    const user = seedMockUser({ email: 'ana@example.com', password: PASSWORD });
    const token = startMockSession(user.id);
    expireMockAccessTokens();
    setAccessToken(token);

    const users = await Promise.all(
      Array.from({ length: 5 }, () => apiFetch<PublicUser>('/api/v1/auth/me')),
    );

    expect(users).toHaveLength(5);
    for (const me of users) {
      expect(me.id).toBe(user.id);
    }
    expect(authMockState.refreshCalls).toBe(1);
  });

  it('reintenta la petición original y devuelve los datos tras refrescar', async () => {
    const user = seedMockUser({ email: 'ana@example.com', password: PASSWORD });
    const token = startMockSession(user.id);
    expireMockAccessTokens();
    setAccessToken(token);

    const me = await apiFetch<PublicUser>('/api/v1/auth/me');

    expect(me.email).toBe(user.email);
    expect(authMockState.refreshCalls).toBe(1);
  });

  it('si el refresh responde 401 borra el token, emite AUTH_EXPIRED_EVENT y propaga el 401', async () => {
    seedMockUser({ email: 'ana@example.com', password: PASSWORD });
    setAccessToken('token-caducado');

    const onExpired = vi.fn();
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);

    const error = await captureRejection(apiFetch('/api/v1/auth/me'));

    window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);

    expect(error).toBeInstanceOf(ApiRequestError);
    expect((error as ApiRequestError).status).toBe(401);
    expect(getAccessToken()).toBeNull();
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('si el refresh responde 429 conserva el token, no emite el evento y propaga 429 con retryAfterSeconds', async () => {
    setAccessToken('token-caducado');

    server.use(
      http.post('/api/v1/auth/refresh', () =>
        HttpResponse.json(
          {
            error: {
              code: 'RATE_LIMITED',
              message: 'Too many refresh attempts',
              details: { retryAfterSeconds: 30 },
            },
          },
          { status: 429 },
        ),
      ),
    );

    const onExpired = vi.fn();
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);

    const error = await captureRejection(apiFetch('/api/v1/auth/me'));

    window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);

    expect(error).toBeInstanceOf(ApiRequestError);
    expect((error as ApiRequestError).status).toBe(429);
    expect((error as ApiRequestError).retryAfterSeconds).toBe(30);
    expect(getAccessToken()).toBe('token-caducado');
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('un 401 en /auth/login no dispara refresh y propaga INVALID_CREDENTIALS', async () => {
    const error = await captureRejection(
      apiFetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'nadie@example.com', password: 'incorrecta' }),
      }),
    );

    expect(error).toBeInstanceOf(ApiRequestError);
    expect((error as ApiRequestError).status).toBe(401);
    expect((error as ApiRequestError).code).toBe('INVALID_CREDENTIALS');
    expect(authMockState.refreshCalls).toBe(0);
  });

  it('un 409 CONFLICT llega con su code y su message', async () => {
    seedMockUser({ email: 'ana@example.com', password: PASSWORD });

    const error = await captureRejection(
      apiFetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'ana@example.com',
          password: PASSWORD,
          displayName: 'Ana',
          timezone: 'Europe/Madrid',
        }),
      }),
    );

    expect(error).toBeInstanceOf(ApiRequestError);
    expect((error as ApiRequestError).status).toBe(409);
    expect((error as ApiRequestError).code).toBe('CONFLICT');
    expect((error as ApiRequestError).message).toBe(
      'Could not create the account with those details',
    );
  });

  it('convierte un fallo de red en ApiRequestError status 0 y code NETWORK_ERROR', async () => {
    server.use(http.get('/api/v1/eco', () => HttpResponse.error()));

    const error = await captureRejection(apiFetch('/api/v1/eco'));

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).not.toBeInstanceOf(TypeError);
    expect((error as ApiRequestError).status).toBe(0);
    expect((error as ApiRequestError).code).toBe('NETWORK_ERROR');
  });
});
