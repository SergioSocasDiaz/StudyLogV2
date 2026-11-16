/**
 * Access token storage.
 *
 * The token lives in a module variable, never in `localStorage` or
 * `sessionStorage`: an XSS payload cannot read it from web storage, and it
 * disappears when the tab is reloaded (the httpOnly refresh cookie restores it).
 *
 * It lives outside React because the fetch interceptor needs it and is not a
 * component. React learns about changes through the `auth:expired` event and
 * through TanStack Query, so no subscription list is needed here.
 */
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}
