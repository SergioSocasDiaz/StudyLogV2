import type { PublicUser } from '@studylog/shared';
import { createContext, useContext } from 'react';

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'anonymous';

export interface AuthContextValue {
  user: PublicUser | null;
  status: AuthStatus;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
