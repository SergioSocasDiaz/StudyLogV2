const DEFAULT_DESTINATION = '/app';

/**
 * Only internal `/app` routes are valid redirect targets.
 *
 * `returnTo` arrives through the URL, so treating it as trusted would be an open
 * redirect: `//evil.example` or `https://evil.example` would send the user off
 * site right after typing their password.
 */
export function safeReturnTo(value: string | null | undefined, origin?: string): string {
  if (!value) {
    return DEFAULT_DESTINATION;
  }

  const base = origin ?? (typeof window === 'undefined' ? undefined : window.location.origin);
  if (!base) {
    return DEFAULT_DESTINATION;
  }

  let url: URL;
  try {
    url = new URL(value, base);
  } catch {
    return DEFAULT_DESTINATION;
  }

  if (url.origin !== base) {
    return DEFAULT_DESTINATION;
  }

  const isAppRoute = url.pathname === '/app' || url.pathname.startsWith('/app/');
  if (!isAppRoute) {
    return DEFAULT_DESTINATION;
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
