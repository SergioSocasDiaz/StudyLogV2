import { describe, expect, it } from 'vitest';

import {
  authResponseSchema,
  ERROR_STATUS,
  paginationQuerySchema,
  REFRESH_COOKIE_PATH,
  refreshResponseSchema,
  studySessionInputSchema,
  subjectInputSchema,
  timezoneSchema,
} from './index';

describe('shared schemas', () => {
  it('applies pagination defaults and coerces query strings', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(paginationQuerySchema.parse({ page: '2', pageSize: '50' })).toEqual({
      page: 2,
      pageSize: 50,
    });
  });

  it('rejects page sizes above the limit', () => {
    expect(() => paginationQuerySchema.parse({ pageSize: '101' })).toThrow();
  });

  it('accepts a valid subject color and rejects an invalid one', () => {
    expect(subjectInputSchema.parse({ name: 'Cálculo', colorHex: '#2563EB' }).name).toBe('Cálculo');
    expect(() => subjectInputSchema.parse({ name: 'Cálculo', colorHex: 'blue' })).toThrow();
  });

  it('requires endedAt to be after startedAt', () => {
    const base = {
      subjectId: '0f8fad5b-d9cb-469f-a165-70867728950e',
      startedAt: '2026-01-01T18:00:00.000Z',
      endedAt: '2026-01-01T18:50:00.000Z',
    };

    expect(studySessionInputSchema.parse(base).source).toBe('manual');
    expect(() =>
      studySessionInputSchema.parse({ ...base, endedAt: '2026-01-01T17:59:59.000Z' }),
    ).toThrow();
  });

  it('validates IANA timezones', () => {
    expect(timezoneSchema.parse('Europe/Madrid')).toBe('Europe/Madrid');
    expect(() => timezoneSchema.parse('Mars/Olympus')).toThrow();
  });

  it('validates the auth response envelope', () => {
    const parsed = authResponseSchema.parse({
      user: {
        id: '0f8fad5b-d9cb-469f-a165-70867728950e',
        email: 'ana@example.com',
        displayName: 'Ana',
        timezone: 'Europe/Madrid',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      accessToken: 'jwt',
    });

    expect(parsed.user.email).toBe('ana@example.com');
    expect(() => authResponseSchema.parse({ user: {}, accessToken: 'jwt' })).toThrow();
    expect(refreshResponseSchema.parse({ accessToken: 'jwt' })).toEqual({ accessToken: 'jwt' });
  });

  it('keeps the refresh cookie scoped to the auth routes', () => {
    expect(REFRESH_COOKIE_PATH).toBe('/api/v1/auth');
  });

  it('maps every error code to an HTTP status', () => {
    expect(ERROR_STATUS.INVALID_CREDENTIALS).toBe(401);
  });
});
