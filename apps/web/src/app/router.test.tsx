import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { Providers } from './providers';
import { routes } from './router';

describe('router', () => {
  it('renders the landing page at /', () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/'] });

    render(
      <Providers>
        <RouterProvider router={router} />
      </Providers>,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: /sabes cuánto estudias/i }),
    ).toBeInTheDocument();
  });

  it('renders the 404 page for unknown routes', () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/ruta-inexistente'] });

    render(
      <Providers>
        <RouterProvider router={router} />
      </Providers>,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: /esa página no existe/i }),
    ).toBeInTheDocument();
  });
});
