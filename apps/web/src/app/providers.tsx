import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { queryClient } from '../lib/queryClient';

/**
 * Only the query cache lives here. The session provider is mounted per route
 * tree (`AuthSessionProvider`), so public pages never bootstrap it.
 */
export function Providers({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
