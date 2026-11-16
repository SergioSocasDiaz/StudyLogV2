import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { ApiRequestError } from '../../lib/api';
import { getAccessToken, setAccessToken } from '../../lib/auth-store';
import { authMockState, seedMockUser, startMockSession } from '../../mocks/auth-state';
import { server } from '../../mocks/server';
import { bootstrapSession } from './session';

const PASSWORD = 'supersecret123';

async function captureRejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => null,
    (error: unknown) => error,
  );
}

describe('bootstrapSession', () => {
  it('sin sesión resuelve null, refresca una vez y no llama a /me', async () => {
    const user = await bootstrapSession();

    expect(user).toBeNull();
    expect(authMockState.refreshCalls).toBe(1);
    expect(authMockState.meCalls).toBe(0);
  });

  it('con sesión válida resuelve el usuario con un refresh y una llamada a /me', async () => {
    const seeded = seedMockUser({ email: 'ana@example.com', password: PASSWORD });
    startMockSession(seeded.id);

    const user = await bootstrapSession();

    expect(user?.id).toBe(seeded.id);
    expect(user?.email).toBe(seeded.email);
    expect(authMockState.refreshCalls).toBe(1);
    expect(authMockState.meCalls).toBe(1);
  });

  it('con token ya en memoria no refresca y va directo a /me', async () => {
    const seeded = seedMockUser({ email: 'ana@example.com', password: PASSWORD });
    const token = startMockSession(seeded.id);
    setAccessToken(token);

    const user = await bootstrapSession();

    expect(user?.id).toBe(seeded.id);
    expect(authMockState.refreshCalls).toBe(0);
    expect(authMockState.meCalls).toBe(1);
  });

  it('rechaza con status 429 si el refresh está limitado y deja el token en null', async () => {
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

    const error = await captureRejection(bootstrapSession());

    expect(error).toBeInstanceOf(ApiRequestError);
    expect((error as ApiRequestError).status).toBe(429);
    expect(getAccessToken()).toBeNull();
  });

  it('resuelve null sin lanzar cuando el refresh responde 401', async () => {
    const user = await bootstrapSession();

    expect(user).toBeNull();
    expect(authMockState.refreshCalls).toBe(1);
    expect(authMockState.meCalls).toBe(0);
  });
});
