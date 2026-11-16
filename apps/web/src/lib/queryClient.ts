import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        const status = (error as { status?: number }).status;
        // 401/403/404 are final answers; 422 and 429 would fail the same way,
        // and a 429 should wait for `Retry-After` instead of hammering.
        if (
          status === 401 ||
          status === 403 ||
          status === 404 ||
          status === 422 ||
          status === 429
        ) {
          return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});
