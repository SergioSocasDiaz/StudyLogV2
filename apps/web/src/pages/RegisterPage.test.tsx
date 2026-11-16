import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { seedMockUser } from '../mocks/auth-state';
import { renderApp } from '../test/render-app';

const PASSWORD = 'una-contraseña-segura';

async function waitForRegisterForm() {
  await screen.findByRole('heading', { level: 1, name: 'Crea tu cuenta' });
}

async function typeRegistration(fields: { displayName: string; email: string; password: string }) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Nombre visible'), fields.displayName);
  await user.type(screen.getByLabelText('Email'), fields.email);
  await user.type(screen.getByLabelText('Contraseña'), fields.password);
  return user;
}

describe('RegisterPage', () => {
  it('muestra el formulario de alta con sus etiquetas y el requisito de contraseña', async () => {
    renderApp('/register');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Crea tu cuenta' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre visible')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    expect(screen.getByLabelText('Zona horaria')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeInTheDocument();
    expect(screen.getByText('Entre 12 y 128 caracteres.')).toBeInTheDocument();
  });

  it('rechaza una contraseña demasiado corta sin navegar', async () => {
    const { router } = renderApp('/register');

    await waitForRegisterForm();
    const user = await typeRegistration({
      displayName: 'Ana',
      email: 'corta@example.com',
      password: 'abcdef',
    });
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(
      await screen.findByText('La contraseña debe tener al menos 12 caracteres'),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/register');
  });

  it('crea la cuenta y entra directamente en la aplicación', async () => {
    const { router } = renderApp('/register');

    await waitForRegisterForm();
    const user = await typeRegistration({
      displayName: 'Ana',
      email: 'nueva@example.com',
      password: PASSWORD,
    });
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Hola, Ana' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/app');
  });

  it('avisa cuando el email ya está registrado y permanece en el registro', async () => {
    seedMockUser({ email: 'ocupado@example.com', password: PASSWORD });
    const { router } = renderApp('/register');

    await waitForRegisterForm();
    const user = await typeRegistration({
      displayName: 'Ana',
      email: 'ocupado@example.com',
      password: PASSWORD,
    });
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No hemos podido crear la cuenta');
    expect(router.state.location.pathname).toBe('/register');
  });

  it('enlaza con la pantalla de inicio de sesión', async () => {
    renderApp('/register');

    await screen.findByRole('heading', { level: 1, name: 'Crea tu cuenta' });
    expect(screen.getByRole('link', { name: 'Inicia sesión' })).toHaveAttribute('href', '/login');
  });
});
