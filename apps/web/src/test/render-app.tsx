import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { Providers } from '../app/providers';
import { routes } from '../app/router';

/**
 * Renders the real route tree (guards, layouts and pages) at a given URL.
 *
 * The whole tree matters here: the session provider is mounted by
 * `AuthSessionProvider`, so rendering a page in isolation would not exercise
 * the bootstrap or the redirects.
 */
export function renderApp(initialPath: string) {
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] });

  return {
    ...render(
      <Providers>
        <RouterProvider router={router} />
      </Providers>,
    ),
    router,
  };
}
