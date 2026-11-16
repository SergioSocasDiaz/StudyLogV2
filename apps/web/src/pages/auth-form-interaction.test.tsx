import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { seedMockUser } from '../mocks/auth-state';
import { server } from '../mocks/server';
import { renderApp } from '../test/render-app';

const EMAIL = 'ana@example.com';
const PASSWORD = 'una-contraseña-segura';

describe('Auth form interactions and security guarantees', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  describe('Keyboard submission', () => {
    it('submits the login form when pressing Enter inside the password input without a mouse click', async () => {
      seedMockUser({ email: EMAIL, password: PASSWORD });
      const { router } = renderApp('/login');
      const user = userEvent.setup();

      await screen.findByRole('heading', { level: 1, name: 'Entra en StudyLog' });

      await user.type(screen.getByLabelText('Email'), EMAIL);
      await user.type(screen.getByLabelText('Contraseña'), `${PASSWORD}{Enter}`);

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Hola, Ana' }),
      ).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/app');
    });

    it('submits the login form when pressing Enter inside the email input without a mouse click', async () => {
      seedMockUser({ email: EMAIL, password: PASSWORD });
      const { router } = renderApp('/login');
      const user = userEvent.setup();

      await screen.findByRole('heading', { level: 1, name: 'Entra en StudyLog' });

      await user.type(screen.getByLabelText('Contraseña'), PASSWORD);
      await user.type(screen.getByLabelText('Email'), `${EMAIL}{Enter}`);

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Hola, Ana' }),
      ).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/app');
    });
  });

  describe('422 VALIDATION_ERROR mapping and accessible error attributes', () => {
    const validationErrorPayload = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: {
          formErrors: ['Error general de validación'],
          fieldErrors: {
            email: ['Formato de correo no admitido'],
            password: ['Contraseña demasiado predecible'],
          },
        },
      },
    };

    it('maps 422 VALIDATION_ERROR to aria-invalid, aria-describedby and alert role on login', async () => {
      server.use(
        http.post('/api/v1/auth/login', () =>
          HttpResponse.json(validationErrorPayload, { status: 422 }),
        ),
      );

      renderApp('/login');
      const user = userEvent.setup();

      await screen.findByRole('heading', { level: 1, name: 'Entra en StudyLog' });
      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Contraseña');

      await user.type(emailInput, 'formato-invalido@example.com');
      await user.type(passwordInput, 'contraseña-segura-1234');
      await user.click(screen.getByRole('button', { name: 'Entrar' }));

      // Form errors must be announced via role="alert"
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('Error general de validación');

      // Email field marked with aria-invalid="true" and linked to error message via aria-describedby
      const emailError = await screen.findByText('Formato de correo no admitido');
      expect(emailError.id).toMatch(/-error$/);
      expect(emailInput).toHaveAttribute('aria-invalid', 'true');
      const emailDescribedBy = emailInput.getAttribute('aria-describedby')?.split(/\s+/) ?? [];
      expect(emailDescribedBy).toContain(emailError.id);

      // Password field marked with aria-invalid="true" and linked to error message via aria-describedby
      const passwordError = await screen.findByText('Contraseña demasiado predecible');
      expect(passwordError.id).toMatch(/-error$/);
      expect(passwordInput).toHaveAttribute('aria-invalid', 'true');
      const passwordDescribedBy =
        passwordInput.getAttribute('aria-describedby')?.split(/\s+/) ?? [];
      expect(passwordDescribedBy).toContain(passwordError.id);

      // When root form errors are present, the alert element receives focus
      expect(alert).toHaveFocus();
    });

    it('maps 422 VALIDATION_ERROR to aria-invalid, aria-describedby and alert role on registration', async () => {
      server.use(
        http.post('/api/v1/auth/register', () =>
          HttpResponse.json(validationErrorPayload, { status: 422 }),
        ),
      );

      renderApp('/register');
      const user = userEvent.setup();

      await screen.findByRole('heading', { level: 1, name: 'Crea tu cuenta' });
      const displayNameInput = screen.getByLabelText('Nombre visible');
      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Contraseña');

      await user.type(displayNameInput, 'Ana');
      await user.type(emailInput, 'valido@example.com');
      await user.type(passwordInput, 'contraseña-larga-1234');
      await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

      // Form errors in alert role
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('Error general de validación');

      // Invalid fields aria attributes
      const emailError = await screen.findByText('Formato de correo no admitido');
      expect(emailError.id).toMatch(/-error$/);
      expect(emailInput).toHaveAttribute('aria-invalid', 'true');
      expect(emailInput.getAttribute('aria-describedby')?.split(/\s+/)).toContain(emailError.id);

      const passwordError = await screen.findByText('Contraseña demasiado predecible');
      expect(passwordError.id).toMatch(/-error$/);
      expect(passwordInput).toHaveAttribute('aria-invalid', 'true');
      expect(passwordInput.getAttribute('aria-describedby')?.split(/\s+/)).toContain(
        passwordError.id,
      );

      // When root form errors are present, the alert element receives focus
      expect(alert).toHaveFocus();
    });

    it('focuses the first invalid field when 422 has only fieldErrors and no formErrors', async () => {
      server.use(
        http.post('/api/v1/auth/login', () =>
          HttpResponse.json(
            {
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Validation failed',
                details: {
                  formErrors: [],
                  fieldErrors: {
                    email: ['Formato de correo no admitido'],
                    password: ['Contraseña demasiado predecible'],
                  },
                },
              },
            },
            { status: 422 },
          ),
        ),
      );

      renderApp('/login');
      const user = userEvent.setup();

      await screen.findByRole('heading', { level: 1, name: 'Entra en StudyLog' });
      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Contraseña');

      await user.type(emailInput, 'formato-invalido@example.com');
      await user.type(passwordInput, 'contraseña-segura-1234');
      await user.click(screen.getByRole('button', { name: 'Entrar' }));

      await screen.findByText('Formato de correo no admitido');
      expect(emailInput).toHaveFocus();
    });
  });

  describe('Timezone auto-detection', () => {
    it('autodetects user timezone, selects it by default, and includes it in POST /register body', async () => {
      const mockDetectedTimezone = 'Atlantic/Canary';
      const dateTimeFormatSpy = vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
        () =>
          ({
            resolvedOptions: () => ({ timeZone: mockDetectedTimezone }),
          }) as unknown as Intl.DateTimeFormat,
      );

      let capturedBody: Record<string, unknown> | null = null;
      server.use(
        http.post('/api/v1/auth/register', async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>;
          const user = seedMockUser({
            displayName: (capturedBody.displayName as string) ?? 'Usuario Canarias',
            email: (capturedBody.email as string) ?? 'canarias@example.com',
            password: PASSWORD,
            timezone: (capturedBody.timezone as string) ?? 'UTC',
          });
          return HttpResponse.json(
            { user, accessToken: 'mock-access-token-canarias' },
            { status: 201 },
          );
        }),
      );

      renderApp('/register');
      const user = userEvent.setup();

      await screen.findByRole('heading', { level: 1, name: 'Crea tu cuenta' });

      // Check timezone dropdown defaulted to autodetected timezone
      const timezoneSelect = screen.getByLabelText('Zona horaria') as HTMLSelectElement;
      expect(timezoneSelect.value).toBe(mockDetectedTimezone);

      // Fill remaining fields and submit
      await user.type(screen.getByLabelText('Nombre visible'), 'Usuario Canarias');
      await user.type(screen.getByLabelText('Email'), 'canarias@example.com');
      await user.type(screen.getByLabelText('Contraseña'), PASSWORD);
      await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

      await screen.findByRole('heading', { level: 1, name: 'Hola, Usuario Canarias' });

      // Assert that the POST request body included the detected timezone
      expect(capturedBody).not.toBeNull();
      const body = capturedBody as unknown as Record<string, unknown>;
      expect(body.timezone).toBe(mockDetectedTimezone);

      dateTimeFormatSpy.mockRestore();
    });
  });

  describe('Security: in-memory tokens only (never localStorage or sessionStorage)', () => {
    it('keeps localStorage and sessionStorage completely empty after login', async () => {
      seedMockUser({ email: EMAIL, password: PASSWORD });
      renderApp('/login');
      const user = userEvent.setup();

      await screen.findByRole('heading', { level: 1, name: 'Entra en StudyLog' });
      await user.type(screen.getByLabelText('Email'), EMAIL);
      await user.type(screen.getByLabelText('Contraseña'), PASSWORD);
      await user.click(screen.getByRole('button', { name: 'Entrar' }));

      await screen.findByRole('heading', { level: 1, name: 'Hola, Ana' });

      expect(window.localStorage.length).toBe(0);
      expect(window.sessionStorage.length).toBe(0);
      expect(Object.keys(window.localStorage)).toEqual([]);
      expect(Object.keys(window.sessionStorage)).toEqual([]);
    });

    it('keeps localStorage and sessionStorage completely empty after registration', async () => {
      renderApp('/register');
      const user = userEvent.setup();

      await screen.findByRole('heading', { level: 1, name: 'Crea tu cuenta' });
      await user.type(screen.getByLabelText('Nombre visible'), 'Carlos');
      await user.type(screen.getByLabelText('Email'), 'carlos@example.com');
      await user.type(screen.getByLabelText('Contraseña'), PASSWORD);
      await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

      await screen.findByRole('heading', { level: 1, name: 'Hola, Carlos' });

      expect(window.localStorage.length).toBe(0);
      expect(window.sessionStorage.length).toBe(0);
      expect(Object.keys(window.localStorage)).toEqual([]);
      expect(Object.keys(window.sessionStorage)).toEqual([]);
    });

    it('keeps localStorage and sessionStorage completely empty after logout', async () => {
      seedMockUser({ email: EMAIL, password: PASSWORD });
      renderApp('/login');
      const user = userEvent.setup();

      await screen.findByRole('heading', { level: 1, name: 'Entra en StudyLog' });
      await user.type(screen.getByLabelText('Email'), EMAIL);
      await user.type(screen.getByLabelText('Contraseña'), PASSWORD);
      await user.click(screen.getByRole('button', { name: 'Entrar' }));

      await screen.findByRole('heading', { level: 1, name: 'Hola, Ana' });

      await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
      await screen.findByRole('link', { name: 'Entrar' });

      expect(window.localStorage.length).toBe(0);
      expect(window.sessionStorage.length).toBe(0);
      expect(Object.keys(window.localStorage)).toEqual([]);
      expect(Object.keys(window.sessionStorage)).toEqual([]);
    });
  });
});
