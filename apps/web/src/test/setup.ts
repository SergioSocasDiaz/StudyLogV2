import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { setAccessToken } from '../lib/auth-store';
import { queryClient } from '../lib/queryClient';
import { resetAuthMockState } from '../mocks/auth-state';
import { server } from '../mocks/server';

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();

  // Both are singletons: without a reset, a session from one test leaks into
  // the next one and the failure looks like a flaky test.
  resetAuthMockState();
  setAccessToken(null);
  queryClient.clear();
});

afterAll(() => {
  server.close();
});
