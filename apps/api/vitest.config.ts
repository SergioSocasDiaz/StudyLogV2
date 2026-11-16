import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Tests always exercise the contract from source, so they do not depend on
    // `@studylog/shared` having been built first.
    alias: {
      '@studylog/shared': fileURLToPath(
        new URL('../../packages/shared/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Integration tests share one Postgres database and truncate between tests,
    // so files must not run in parallel against it.
    fileParallelism: false,
  },
});
