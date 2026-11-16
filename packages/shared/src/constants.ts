export const API_PREFIX = '/api/v1';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const MAX_SESSION_HOURS = 12;
export const MAX_SESSION_SECONDS = MAX_SESSION_HOURS * 60 * 60;

export const SUBJECT_COLORS = [
  '#2563EB',
  '#0891B2',
  '#0D9488',
  '#16A34A',
  '#65A30D',
  '#CA8A04',
  '#EA580C',
  '#DC2626',
  '#DB2777',
  '#475569',
] as const;

export type SubjectColor = (typeof SUBJECT_COLORS)[number];

/**
 * Auth contract (Phase 1).
 *
 * The refresh cookie is scoped to the auth router so it is never sent to the
 * rest of the API; a leaked access token is the only thing that can travel with
 * normal requests.
 */
export const REFRESH_COOKIE_NAME = 'studylog_refresh';
export const REFRESH_COOKIE_PATH = `${API_PREFIX}/auth`;

/** Attempts allowed per window, per IP and per email, on sensitive auth routes. */
export const AUTH_RATE_LIMIT = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
} as const;

/**
 * A rotated refresh token that is replayed inside this window is treated as a
 * multi-tab race, not as theft: the family is kept alive and a sibling token is
 * issued. Outside the window, replay revokes the whole family.
 */
export const REFRESH_REUSE_GRACE_SECONDS = 10;

export const ACCESS_TOKEN_TYPE = 'access';
