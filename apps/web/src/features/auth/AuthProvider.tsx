import type { ReactNode } from 'react';
import { useMemo } from 'react';

import type { AuthContextValue } from './auth-context';
import { AuthContext } from './auth-context';

/**
 * Phase 0 placeholder: authentication arrives in Phase 1.
 * The provider already owns the shape the rest of the app will consume.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const value = useMemo<AuthContextValue>(
    () => ({
      user: null,
      status: 'anonymous',
      logout: () => undefined,
    }),
    [],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
