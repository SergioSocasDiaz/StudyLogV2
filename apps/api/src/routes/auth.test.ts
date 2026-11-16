import { REFRESH_COOKIE_NAME } from '@studylog/shared';
import type { Express } from 'express';
import { SignJWT } from 'jose';
import type { Response as SuperTestResponse } from 'supertest';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { env } from '../config/env.js';
import { closeDatabase } from '../db/client.js';
import { ensureMigrations, resetAuthTables } from '../test/db.js';

const PASSWORD = 'una-contraseña-segura';
const BASE_USER = {
  email: 'ana@example.com',
  password: PASSWORD,
  displayName: 'Ana',
  timezone: 'Europe/Madrid',
};

let app: Express;
let clock: Date;

function buildApp(overrides: NonNullable<Parameters<typeof createApp>[0]>['auth'] = {}): Express {
  return createApp({
    auth: { rateLimitMaxAttempts: 100, now: () => clock, ...overrides },
  });
}

function setCookieHeaders(response: SuperTestResponse): string[] {
  const raw = response.headers['set-cookie'] as unknown;
  if (Array.isArray(raw)) {
    return raw as string[];
  }
  return typeof raw === 'string' ? [raw] : [];
}

function refreshCookie(response: SuperTestResponse): string {
  const header = setCookieHeaders(response).find((cookie) =>
    cookie.startsWith(`${REFRESH_COOKIE_NAME}=`),
  );

  if (!header) {
    throw new Error('Response did not set a refresh cookie');
  }

  return header.split(';')[0] ?? '';
}

function register(overrides: Partial<typeof BASE_USER> = {}): request.Test {
  return request(app)
    .post('/api/v1/auth/register')
    .send({ ...BASE_USER, ...overrides });
}

function login(email = BASE_USER.email, password = PASSWORD): request.Test {
  return request(app).post('/api/v1/auth/login').send({ email, password });
}

beforeAll(async () => {
  await ensureMigrations();
});

beforeEach(async () => {
  await resetAuthTables();
  clock = new Date('2026-01-01T00:00:00.000Z');
  app = buildApp();
});

afterAll(async () => {
  await closeDatabase();
});

describe('POST /api/v1/auth/register', () => {
  it('creates the account, returns the public user and sets an httpOnly cookie', async () => {
    const response = await register();

    expect(response.status).toBe(201);
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.user).toMatchObject({
      email: 'ana@example.com',
      displayName: 'Ana',
      timezone: 'Europe/Madrid',
    });
    expect(response.body.user).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(response.body)).not.toContain(PASSWORD);

    const [cookieHeader] = setCookieHeaders(response);
    expect(cookieHeader).toBeDefined();
    expect(cookieHeader).toContain('HttpOnly');
    expect(cookieHeader).toContain('SameSite=Lax');
    expect(cookieHeader).toContain('Path=/api/v1/auth');
    expect(cookieHeader).not.toContain('Secure');
  });

  it('marks the cookie as Secure when configured for production', async () => {
    const productionApp = buildApp({ secureCookies: true });
    const response = await request(productionApp)
      .post('/api/v1/auth/register')
      .send({ ...BASE_USER, email: 'secure@example.com' });

    expect(response.status).toBe(201);
    expect(setCookieHeaders(response)[0]).toContain('Secure');
  });

  it('normalises the email and rejects a duplicate with a generic conflict', async () => {
    const first = await register();
    expect(first.status).toBe(201);

    const duplicate = await register({ email: 'ANA@Example.com' });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('CONFLICT');
    expect(duplicate.body.error.message).not.toMatch(/already|exists|registrad/i);
  });

  it('rejects an invalid payload with the shared validation envelope', async () => {
    const response = await register({ password: 'corta' });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toBeDefined();
  });
});

describe('POST /api/v1/auth/login', () => {
  beforeEach(async () => {
    await register();
  });

  it('returns a new access token and refresh cookie', async () => {
    const response = await login();

    expect(response.status).toBe(200);
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.user.email).toBe('ana@example.com');
    expect(refreshCookie(response)).toContain(`${REFRESH_COOKIE_NAME}=`);
  });

  it('rejects a wrong password with INVALID_CREDENTIALS', async () => {
    const response = await login(BASE_USER.email, 'otra-contraseña-larga');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns the same error for an unknown email', async () => {
    const response = await login('nadie@example.com', PASSWORD);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('POST /api/v1/auth/refresh', () => {
  it('rotates the token on every use', async () => {
    const registration = await register();
    const firstCookie = refreshCookie(registration);

    const refreshed = await request(app).post('/api/v1/auth/refresh').set('Cookie', firstCookie);

    expect(refreshed.status).toBe(200);
    expect(refreshed.body.accessToken).toEqual(expect.any(String));
    const secondCookie = refreshCookie(refreshed);
    expect(secondCookie).not.toBe(firstCookie);
  });

  it('accepts a replay inside the grace window as a multi-tab race', async () => {
    const registration = await register();
    const firstCookie = refreshCookie(registration);

    await request(app).post('/api/v1/auth/refresh').set('Cookie', firstCookie);

    clock = new Date(clock.getTime() + 5_000);
    const replay = await request(app).post('/api/v1/auth/refresh').set('Cookie', firstCookie);

    expect(replay.status).toBe(200);
    expect(refreshCookie(replay)).not.toBe(firstCookie);
  });

  it('revokes the whole family when a rotated token is reused outside the window', async () => {
    const registration = await register();
    const firstCookie = refreshCookie(registration);

    const rotated = await request(app).post('/api/v1/auth/refresh').set('Cookie', firstCookie);
    const successorCookie = refreshCookie(rotated);

    clock = new Date(clock.getTime() + 11_000);
    const replay = await request(app).post('/api/v1/auth/refresh').set('Cookie', firstCookie);
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('UNAUTHORIZED');

    // The successor dies too: reuse means the family is compromised.
    const successor = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', successorCookie);
    expect(successor.status).toBe(401);
  });

  it('rejects a request without the cookie and clears it', async () => {
    const response = await request(app).post('/api/v1/auth/refresh');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('revokes the current token, clears the cookie and is idempotent', async () => {
    const registration = await register();
    const cookie = refreshCookie(registration);

    const first = await request(app).post('/api/v1/auth/logout').set('Cookie', cookie);
    expect(first.status).toBe(204);
    expect(setCookieHeaders(first).join('; ')).toContain(`${REFRESH_COOKIE_NAME}=;`);

    const again = await request(app).post('/api/v1/auth/logout').set('Cookie', cookie);
    expect(again.status).toBe(204);

    const refreshAfterLogout = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie);
    expect(refreshAfterLogout.status).toBe(401);
  });
});

describe('GET /api/v1/auth/me', () => {
  it('returns the current user for a valid access token', async () => {
    const registration = await register();
    const accessToken = registration.body.accessToken as string;

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ email: 'ana@example.com', displayName: 'Ana' });
    expect(response.body.createdAt).toEqual(expect.any(String));
  });

  it('returns 401 with the shared envelope when the token is missing', async () => {
    const response = await request(app).get('/api/v1/auth/me');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    });
  });

  it('rejects an expired token and a token of the wrong type', async () => {
    const registration = await register();
    const userId = registration.body.user.id as string;
    const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
    const issuedAt = Math.floor(Date.now() / 1000);

    const expired = await new SignJWT({ type: 'access' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuedAt(issuedAt - 3600)
      .setExpirationTime(issuedAt - 1800)
      .sign(secret);

    const wrongType = await new SignJWT({ type: 'refresh' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(secret);

    for (const token of [expired, wrongType]) {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    }
  });
});

describe('rate limiting and CSRF checks', () => {
  it('returns 429 with Retry-After once the window is exhausted', async () => {
    app = buildApp({ rateLimitMaxAttempts: 2, rateLimitWindowMs: 60_000 });

    await login('nadie@example.com', 'contraseña-larga-1');
    await login('nadie@example.com', 'contraseña-larga-2');
    const blocked = await login('nadie@example.com', 'contraseña-larga-3');

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('separates the buckets per IP and per email', async () => {
    app = buildApp({ rateLimitMaxAttempts: 1, rateLimitWindowMs: 60_000 });

    await login('ana@example.com', 'contraseña-larga-1');
    // Same IP, different email: still blocked because the IP bucket is full.
    const otherEmail = await login('bea@example.com', 'contraseña-larga-2');

    expect(otherEmail.status).toBe(429);
  });

  it('rejects a mutation coming from a foreign origin', async () => {
    const response = await register().set('Origin', 'http://attacker.example');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('accepts a mutation coming from an allowed origin', async () => {
    const allowedOrigin = env.allowedOrigins[0] ?? 'http://127.0.0.1:5173';
    const response = await register().set('Origin', allowedOrigin);

    expect(response.status).toBe(201);
  });
});
