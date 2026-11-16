import type { LoginInput, PublicUser, RegisterInput } from '@studylog/shared';
import { createContext, useContext } from 'react';

/**
 * `unavailable` means "we do not know": the API could not answer (rate limited
 * or offline). It is deliberately different from `anonymous`, because guessing
 * "no session" there would log people out for a transient error.
 */
export type AuthStatus = 'loading' | 'authenticated' | 'anonymous' | 'unavailable';

export interface AuthContextValue {
  user: PublicUser | null;
  status: AuthStatus;
  /** True when the session was active and the API rejected the refresh. */
  sessionExpired: boolean;
  signIn: (input: LoginInput) => Promise<PublicUser>;
  signUp: (input: RegisterInput) => Promise<PublicUser>;
  signOut: () => Promise<void>;
  /** Retries the session bootstrap after an `unavailable` state. */
  retry: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
