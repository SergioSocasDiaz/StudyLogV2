import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { seedMockUser } from '../mocks/auth-state';
import { renderApp } from '../test/render-app';

const EMAIL = 'ana@example.com';
const PASSWORD = 'una-contraseña-segura';

async function waitForLoginForm() {
  await screen.findByRole('heading', { level: 1, name: 'Entra en StudyLog' });
}

async function typeCredentials(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Contraseña'), password);
  return user;
}

describe('LoginPage', () => {
  it('muestra el formulario de acceso con sus campos y el enlace de registro', async () => {
    renderApp('/login');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Entra en StudyLog' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Crear una cuenta' })).toHaveAttribute(
      'href',
      '/register',
    );
  });

  it('alterna la visibilidad de la contraseña entre oculta y visible', async () => {
    const user = userEvent.setup();
    renderApp('/login');

    await screen.findByRole('heading', { level: 1, name: 'Entra en StudyLog' });
    const passwordInput = screen.getByLabelText('Contraseña');
    expect(passwordInput).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));

    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Ocultar contraseña' })).toBeInTheDocument();
  });

  it('avisa de credenciales incorrectas y no cambia de pantalla', async () => {
    seedMockUser({ email: EMAIL, password: PASSWORD });
    const { router } = renderApp('/login');

    await waitForLoginForm();
    const user = await typeCredentials(EMAIL, 'no-es-la-contraseña');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Email o contraseña incorrectos.');
    expect(router.state.location.pathname).toBe('/login');
  });

  it('exige email y contraseña señalando los campos con errores accesibles', async () => {
    const user = userEvent.setup();
    renderApp('/login');

    await screen.findByRole('heading', { level: 1, name: 'Entra en StudyLog' });
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    const emailError = await screen.findByText('Escribe tu email');
    const passwordError = screen.getByText('Escribe tu contraseña');

    expect(emailError.id).toMatch(/-error$/);
    expect(passwordError.id).toMatch(/-error$/);

    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Contraseña');

    expect(emailInput).toHaveAttribute('aria-invalid', 'true');
    expect(passwordInput).toHaveAttribute('aria-invalid', 'true');
    expect(emailInput.getAttribute('aria-describedby')?.split(/\s+/)).toContain(emailError.id);
    expect(passwordInput.getAttribute('aria-describedby')?.split(/\s+/)).toContain(
      passwordError.id,
    );
  });

  it('avisa de que la sesión ha caducado cuando llega reason=expired', async () => {
    renderApp('/login?reason=expired');

    expect(await screen.findByText('Tu sesión ha caducado. Vuelve a entrar.')).toBeInTheDocument();
  });

  it('entra en la aplicación tras un login correcto', async () => {
    seedMockUser({ email: EMAIL, password: PASSWORD });
    const { router } = renderApp('/login');

    await waitForLoginForm();
    const user = await typeCredentials(EMAIL, PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Hola, Ana' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/app');
  });

  it('respeta un destino interno indicado en returnTo tras el login', async () => {
    seedMockUser({ email: EMAIL, password: PASSWORD });
    const { router } = renderApp('/login?returnTo=%2Fapp%3Ftab%3D1');

    await waitForLoginForm();
    const user = await typeCredentials(EMAIL, PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    await screen.findByRole('heading', { level: 1 });
    expect(`${router.state.location.pathname}${router.state.location.search}`).toBe('/app?tab=1');
  });
});
