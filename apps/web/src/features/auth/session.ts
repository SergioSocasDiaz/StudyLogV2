import type { PublicUser } from '@studylog/shared';

import { refreshAccessToken } from '../../lib/api';
import { getAccessToken } from '../../lib/auth-store';
import { fetchCurrentUser } from './api';

/**
 * Resolves the session once per app load.
 *
 * The order is **refresh first**: after a reload the access token only lives in
 * memory, so asking `/auth/me` first would guarantee a `401` on every cold load.
 *
 * - No token and no valid cookie → `null` (anonymous), after one request.
 * - Valid cookie → new access token, then `/auth/me` → user.
 * - Rate limited or server error → throws, so the UI can offer a retry instead
 *   of silently logging the user out.
 */
export async function bootstrapSession(): Promise<PublicUser | null> {
  if (!getAccessToken()) {
    const refreshed = await refreshAccessToken();

    if (refreshed === null) {
      return null;
    }
  }

  return fetchCurrentUser();
}
