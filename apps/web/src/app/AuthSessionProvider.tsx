import { Outlet } from 'react-router-dom';

import { AuthProvider } from '../features/auth/AuthProvider';

/**
 * Mounts the session only where it is needed (`/login`, `/register`, `/app`).
 *
 * The landing does not pay for a bootstrap request, and anonymous visitors do
 * not consume the API's refresh rate-limit budget.
 */
export function AuthSessionProvider() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}
