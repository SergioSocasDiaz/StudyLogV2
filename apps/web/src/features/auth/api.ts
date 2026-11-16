import type { AuthResponse, LoginInput, PublicUser, RegisterInput } from '@studylog/shared';

import { apiFetch } from '../../lib/api';

export const authKeys = {
  me: ['auth', 'me'] as const,
};

/** `GET /auth/me` returns the public user directly, with no envelope. */
export function fetchCurrentUser(): Promise<PublicUser> {
  return apiFetch<PublicUser>('/api/v1/auth/me');
}

export function loginRequest(input: LoginInput): Promise<AuthResponse> {
  return apiFetch<AuthResponse>(
    '/api/v1/auth/login',
    { method: 'POST', body: JSON.stringify(input) },
    { auth: false },
  );
}

export function registerRequest(input: RegisterInput): Promise<AuthResponse> {
  return apiFetch<AuthResponse>(
    '/api/v1/auth/register',
    { method: 'POST', body: JSON.stringify(input) },
    { auth: false },
  );
}

/**
 * Revoking the refresh token is best effort: the cookie lives on the server, so
 * a failed call must not keep the user "logged in" in the browser.
 */
export async function logoutRequest(): Promise<void> {
  await apiFetch<void>('/api/v1/auth/logout', { method: 'POST' }, { skipRefresh: true });
}
