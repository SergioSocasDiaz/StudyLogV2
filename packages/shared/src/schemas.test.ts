import { describe, expect, it } from 'vitest';

import {
  paginationQuerySchema,
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
});
