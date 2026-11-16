import type { PublicUser } from '@studylog/shared';

/**
 * In-memory backend used by MSW.
 *
 * jsdom has no cookie jar, so the refresh cookie is modelled as
 * `sessionUserId`: `null` means "the browser has no session", which is exactly
 * what the API reports with a `401`.
 */
export interface MockUserRecord {
  user: PublicUser;
  password: string;
}

export interface AuthMockState {
  users: Map<string, MockUserRecord>;
  sessionUserId: string | null;
  validTokens: Set<string>;
  tokenCounter: number;
  refreshCalls: number;
  meCalls: number;
  loginCalls: number;
}

export const authMockState: AuthMockState = {
  users: new Map(),
  sessionUserId: null,
  validTokens: new Set(),
  tokenCounter: 0,
  refreshCalls: 0,
  meCalls: 0,
  loginCalls: 0,
};

export function resetAuthMockState(): void {
  authMockState.users.clear();
  authMockState.sessionUserId = null;
  authMockState.validTokens.clear();
  authMockState.tokenCounter = 0;
  authMockState.refreshCalls = 0;
  authMockState.meCalls = 0;
  authMockState.loginCalls = 0;
}

export interface SeedUserInput {
  email: string;
  password: string;
  displayName?: string;
  timezone?: string;
}

export function seedMockUser(input: SeedUserInput): PublicUser {
  const email = input.email.trim().toLowerCase();
  const user: PublicUser = {
    id: `00000000-0000-4000-8000-${String(authMockState.users.size + 1).padStart(12, '0')}`,
    email,
    displayName: input.displayName ?? 'Ana',
    timezone: input.timezone ?? 'Europe/Madrid',
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  authMockState.users.set(email, { user, password: input.password });
  return user;
}

export function findMockUser(email: string): MockUserRecord | undefined {
  return authMockState.users.get(email.trim().toLowerCase());
}

/** Issues a token and keeps it valid until it is rotated or the session ends. */
export function issueMockToken(): string {
  authMockState.tokenCounter += 1;
  const token = `mock-access-${authMockState.tokenCounter}`;
  authMockState.validTokens.add(token);
  return token;
}

/** Rotation: everything issued before stops working, like the real refresh. */
export function rotateMockToken(): string {
  authMockState.validTokens.clear();
  return issueMockToken();
}

/** Simulates an expired access token without touching the refresh session. */
export function expireMockAccessTokens(): void {
  authMockState.validTokens.clear();
}

export function startMockSession(userId: string): string {
  authMockState.sessionUserId = userId;
  authMockState.validTokens.clear();
  return issueMockToken();
}

export function endMockSession(): void {
  authMockState.sessionUserId = null;
  authMockState.validTokens.clear();
}

export function currentMockUser(): PublicUser | null {
  if (!authMockState.sessionUserId) {
    return null;
  }

  for (const record of authMockState.users.values()) {
    if (record.user.id === authMockState.sessionUserId) {
      return record.user;
    }
  }

  return null;
}
