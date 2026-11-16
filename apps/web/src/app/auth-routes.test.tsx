import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { seedMockUser, startMockSession } from '../mocks/auth-state';
import { server } from '../mocks/server';
import { renderApp } from '../test/render-app';

const EMAIL = 'ana@example.com';
const PASSWORD = 'una-contraseña-segura';

function seedSession() {
  const user = seedMockUser({ email: EMAIL, password: PASSWORD });
  startMockSession(user.id);
  return user;
}

describe('rutas protegidas y guardas de sesión', () => {
  it('redirige a /login con returnTo cuando no hay sesión', async () => {
    const { router } = renderApp('/app');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Entra en StudyLog' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(decodeURIComponent(router.state.location.search)).toContain('returnTo=/app');
  });

  it('muestra la pantalla protegida cuando hay sesión', async () => {
    seedSession();
    renderApp('/app');

    expect(await screen.findByRole('heading', { level: 1, name: 'Hola, Ana' })).toBeInTheDocument();
  });

  it('saca a la aplicación si se visita /login con sesión abierta', async () => {
    seedSession();
    const { router } = renderApp('/login');

    expect(await screen.findByRole('heading', { level: 1, name: 'Hola, Ana' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/app');
  });

  it('ignora un returnTo absoluto externo y se queda en la aplicación', async () => {
    seedSession();
    const { router } = renderApp('/login?returnTo=https%3A%2F%2Fevil.example');

    expect(await screen.findByRole('heading', { level: 1, name: 'Hola, Ana' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/app');
  });

  it('ignora un returnTo con doble barra y se queda en la aplicación', async () => {
    seedSession();
    const { router } = renderApp('/login?returnTo=%2F%2Fevil.example');

    expect(await screen.findByRole('heading', { level: 1, name: 'Hola, Ana' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/app');
  });

  it('muestra un error con reintento y no expulsa al usuario si el refresh falla con 429', async () => {
    seedSession();
    server.use(
      http.post('/api/v1/auth/refresh', () =>
        HttpResponse.json(
          { error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
          { status: 429 },
        ),
      ),
    );

    const { router } = renderApp('/app');

    expect(await screen.findByText(/No hemos podido comprobar tu sesión/)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/app');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('no muestra contenido protegido mientras se resuelve la sesión', async () => {
    seedSession();
    renderApp('/app');

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'Hola, Ana' })).not.toBeInTheDocument();

    expect(await screen.findByRole('heading', { level: 1, name: 'Hola, Ana' })).toBeInTheDocument();
  });
});
