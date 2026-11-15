import type { ApiError } from '@studylog/shared';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, body: ApiError | null) {
    super(body?.error.message ?? `Request failed with status ${status}`);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = body?.error.code ?? 'INTERNAL_ERROR';
    this.details = body?.error.details;
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiError | null;
    throw new ApiRequestError(response.status, body);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
