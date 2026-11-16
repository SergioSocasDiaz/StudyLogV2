import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router-dom';

import { SessionUnavailable } from '../../components/SessionUnavailable';
import { FullPageLoader } from '../../components/ui/FullPageLoader';
import { useAuth } from './auth-context';
import { safeReturnTo } from './return-to';

/** Blocks `/app` until the session is known, so protected content never flashes. */
export function RequireAuth() {
  const { status, retry, sessionExpired } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <FullPageLoader />;
  }

  if (status === 'unavailable') {
    return <SessionUnavailable onRetry={retry} />;
  }

  if (status === 'anonymous') {
    const params = new URLSearchParams({
      returnTo: `${location.pathname}${location.search}`,
    });

    if (sessionExpired) {
      params.set('reason', 'expired');
    }

    return <Navigate replace to={`/login?${params.toString()}`} />;
  }

  return <Outlet />;
}

/**
 * Keeps a logged-in user away from the login and register forms.
 *
 * Unlike `RequireAuth`, it does **not** block while the session is unknown: the
 * form is the useful thing here, and hiding it behind a spinner punishes the
 * common case (an anonymous visitor) for a check that almost always says "not
 * logged in". If the session turns out to be valid, the redirect happens a
 * moment later and no protected content was ever rendered.
 */
export function RedirectIfAuthenticated() {
  const { status } = useAuth();
  const [searchParams] = useSearchParams();

  if (status === 'authenticated') {
    return <Navigate replace to={safeReturnTo(searchParams.get('returnTo'))} />;
  }

  return <Outlet />;
}
