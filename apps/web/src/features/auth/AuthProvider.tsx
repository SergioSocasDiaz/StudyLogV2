import type { LoginInput, PublicUser, RegisterInput } from '@studylog/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { AUTH_EXPIRED_EVENT } from '../../lib/api';
import { setAccessToken } from '../../lib/auth-store';
import { authKeys, loginRequest, logoutRequest, registerRequest } from './api';
import type { AuthContextValue, AuthStatus } from './auth-context';
import { AuthContext } from './auth-context';
import { bootstrapSession } from './session';

/**
 * Owns the session for the routes that need it.
 *
 * It is mounted around `/login`, `/register` and `/app`, not around the whole
 * app: the public landing does not need a session, and bootstrapping there would
 * spend refresh rate-limit budget on visitors who are not logged in.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [sessionExpired, setSessionExpired] = useState(false);

  const session = useQuery({
    queryKey: authKeys.me,
    queryFn: bootstrapSession,
    // The token lives in memory and the user object changes only on login or
    // logout, so there is nothing to revalidate while the tab is open.
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { refetch } = session;

  useEffect(() => {
    const handleExpired = () => {
      setAccessToken(null);
      queryClient.clear();
      queryClient.setQueryData(authKeys.me, null);
      // Lets the guard send the user to /login with an explanation instead of
      // a silent redirect.
      setSessionExpired(true);
    };

    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpired);
  }, [queryClient]);

  const signIn = useCallback(
    async (input: LoginInput): Promise<PublicUser> => {
      const result = await loginRequest(input);
      setAccessToken(result.accessToken);
      setSessionExpired(false);
      // Seed the cache with the user the API already returned: no extra /me.
      queryClient.setQueryData(authKeys.me, result.user);
      return result.user;
    },
    [queryClient],
  );

  const signUp = useCallback(
    async (input: RegisterInput): Promise<PublicUser> => {
      const result = await registerRequest(input);
      setAccessToken(result.accessToken);
      setSessionExpired(false);
      queryClient.setQueryData(authKeys.me, result.user);
      return result.user;
    },
    [queryClient],
  );

  const signOut = useCallback(async (): Promise<void> => {
    try {
      await logoutRequest();
    } catch {
      // The local session is closed either way; the server will expire the
      // cookie on its own if the call never arrived.
    }

    setAccessToken(null);
    queryClient.clear();
  }, [queryClient]);

  const retry = useCallback(() => {
    void refetch();
  }, [refetch]);

  const status: AuthStatus = session.isPending
    ? 'loading'
    : session.isError
      ? 'unavailable'
      : session.data
        ? 'authenticated'
        : 'anonymous';

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session.data ?? null,
      status,
      sessionExpired,
      signIn,
      signUp,
      signOut,
      retry,
    }),
    [session.data, status, sessionExpired, signIn, signUp, signOut, retry],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
