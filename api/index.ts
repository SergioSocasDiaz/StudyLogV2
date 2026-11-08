import { createApp } from '../apps/api/src/app.js';

/**
 * Vercel serverless entrypoint.
 *
 * The Express app is exported as the handler; it must stay stateless and must
 * never call `listen()` here. Migrations run in CI/CD, never at cold start.
 */
const app = createApp();

export default app;
