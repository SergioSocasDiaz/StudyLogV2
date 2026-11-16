import type { ApiError, ErrorCode } from '@studylog/shared';

import { getAccessToken, setAccessToken } from './auth-store';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

const REFRESH_PATH = '/api/v1/auth/refresh';

/**
 * Routes that must never trigger a refresh.
 *
 * Login and register answer `401` for wrong credentials, and refresh/logout
 * answer `401` for a dead session: retrying them would hide the real error or
 * loop forever.
 */
const REFRESH_EXEMPT_PATHS: ReadonlySet<string> = new Set([
  '/api/v1/auth/register',
  '/api/v1/auth/login',
  REFRESH_PATH,
  '/api/v1/auth/logout',
]);

/**
 * Fired when the session cannot be recovered (the refresh token was rejected).
 * The network layer never navigates; `AuthProvider` reacts to this event.
 */
export const AUTH_EXPIRED_EVENT = 'auth:expired';

export type ApiErrorCode = ErrorCode | 'NETWORK_ERROR';

export interface ApiRequestErrorInit {
  status: number;
  code: ApiErrorCode;
  message: string;
  details?: unknown;
  requestId?: string | null;
  retryAfterSeconds?: number | null;
}

export class ApiRequestError extends Error {
  /** HTTP status, or `0` when the request never reached the server. */
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details: unknown;
  /** Correlation id echoed by the API, useful when reading server logs. */
  readonly requestId: string | null;
  /** Seconds to wait, taken from a `429` response. */
  readonly retryAfterSeconds: number | null;

  constructor(init: ApiRequestErrorInit) {
    super(init.message);
    this.name = 'ApiRequestError';
    this.status = init.status;
    this.code = init.code;
    this.details = init.details;
    this.requestId = init.requestId ?? null;
    this.retryAfterSeconds = init.retryAfterSeconds ?? null;
  }
}

export interface ApiRequestOptions {
  /** Send the access token when one exists. Defaults to `true`. */
  auth?: boolean;
  /** Do not try to refresh after a `401`. */
  skipRefresh?: boolean;
  /** Reuse an id: the retry keeps the one from the original request. */
  requestId?: string;
  /** Internal: the request already went through one refresh. */
  retried?: boolean;
}

function newRequestId(): string {
  const cryptoRef = globalThis.crypto;
  if (typeof cryptoRef?.randomUUID === 'function') {
    return cryptoRef.randomUUID();
  }
  // jsdom and very old browsers may not expose randomUUID.
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function retryAfterSecondsFrom(response: Response, details: unknown): number | null {
  if (typeof details === 'object' && details !== null && 'retryAfterSeconds' in details) {
    const value = (details as { retryAfterSeconds?: unknown }).retryAfterSeconds;
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }

  const header = response.headers.get('retry-after');
  if (!header) {
    return null;
  }

  const seconds = Number(header);
  return Number.isFinite(seconds) ? seconds : null;
}

async function toApiRequestError(response: Response): Promise<ApiRequestError> {
  const body = (await response.json().catch(() => null)) as ApiError | null;
  const details = body?.error.details;

  return new ApiRequestError({
    status: response.status,
    code: body?.error.code ?? 'INTERNAL_ERROR',
    message: body?.error.message ?? `Request failed with status ${response.status}`,
    details,
    requestId: response.headers.get('x-request-id'),
    retryAfterSeconds: retryAfterSecondsFrom(response, details),
  });
}

async function send(
  path: string,
  init: RequestInit,
  requestId: string,
  token: string | null,
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  headers.set('x-request-id', requestId);

  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      credentials: 'include',
    });
  } catch {
    throw new ApiRequestError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'No pudimos conectar con el servidor.',
      requestId,
    });
  }
}

/**
 * One refresh per burst of `401`s.
 *
 * Every caller awaits the same promise, so five requests failing at once still
 * produce a single `POST /auth/refresh` (no refresh storm, and no rotation race
 * between tabs of the same page).
 */
let refreshPromise: Promise<string | null> | null = null;

export function refreshAccessToken(): Promise<string | null> {
  refreshPromise ??= performRefresh().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

async function performRefresh(): Promise<string | null> {
  const response = await send(REFRESH_PATH, { method: 'POST' }, newRequestId(), null);

  if (response.status === 401) {
    // The cookie is dead (expired, revoked, or replayed outside the grace
    // window). Drop the in-memory token so nothing keeps using it.
    setAccessToken(null);
    return null;
  }

  if (!response.ok) {
    // 429 and 5xx are recoverable: the session must survive them.
    throw await toApiRequestError(response);
  }

  const body = (await response.json().catch(() => null)) as { accessToken?: unknown } | null;
  const token = typeof body?.accessToken === 'string' ? body.accessToken : null;

  if (!token) {
    setAccessToken(null);
    return null;
  }

  setAccessToken(token);
  return token;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  const requestId = options.requestId ?? newRequestId();
  const withAuth = options.auth !== false;
  const token = withAuth ? getAccessToken() : null;

  const response = await send(path, init, requestId, token);

  if (response.status === 401) {
    if (options.retried === true) {
      // A token that was just issued is rejected: the session is unusable.
      setAccessToken(null);
      dispatchAuthExpired();
      throw await toApiRequestError(response);
    }

    const canRefresh = withAuth && options.skipRefresh !== true && !REFRESH_EXEMPT_PATHS.has(path);

    if (canRefresh) {
      const refreshed = await refreshAccessToken();

      if (refreshed === null) {
        dispatchAuthExpired();
        throw await toApiRequestError(response);
      }

      return apiFetch<T>(path, init, { ...options, requestId, retried: true });
    }
  }

  if (!response.ok) {
    throw await toApiRequestError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function dispatchAuthExpired(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  }
}
