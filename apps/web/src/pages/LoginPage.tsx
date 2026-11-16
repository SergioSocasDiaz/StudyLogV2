import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { focusRing } from '../components/ui/cn';
import { TextField } from '../components/ui/TextField';
import { useAuth } from '../features/auth/auth-context';
import { mapApiError } from '../features/auth/form-errors';
import type { LoginFormValues } from '../features/auth/form-schemas';
import { loginFormSchema } from '../features/auth/form-schemas';
import { safeReturnTo } from '../features/auth/return-to';
import { useDocumentTitle } from '../lib/use-document-title';

export function LoginPage() {
  useDocumentTitle('StudyLog — Entrar');

  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const alertRef = useRef<HTMLDivElement>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    setFocus,
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: '', password: '' },
  });

  const sessionExpired = searchParams.get('reason') === 'expired';
  const rootError = errors.root?.message ?? null;

  useEffect(() => {
    if (rootError) {
      alertRef.current?.focus();
    }
  }, [rootError]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await signIn(values);
      navigate(safeReturnTo(searchParams.get('returnTo')), { replace: true });
    } catch (error) {
      const mapping = mapApiError(error);
      let firstField: keyof LoginFormValues | null = null;

      for (const field of ['email', 'password'] as const) {
        const message = mapping.fields[field];
        if (message) {
          setError(field, { type: 'server', message });
          firstField ??= field;
        }
      }

      if (mapping.root) {
        setError('root', { type: 'server', message: mapping.root });
      }

      if (firstField) {
        setFocus(firstField);
      }
    }
  });

  const returnTo = searchParams.get('returnTo');
  const registerHref = returnTo
    ? `/register?returnTo=${encodeURIComponent(returnTo)}`
    : '/register';

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Entra en StudyLog</h1>
      <p className="mt-3 text-ink-muted">Tu registro de estudio sigue donde lo dejaste.</p>

      {sessionExpired ? (
        <Alert className="mt-6" tone="info">
          Tu sesión ha caducado. Vuelve a entrar.
        </Alert>
      ) : null}

      <form className="mt-8 space-y-5" noValidate onSubmit={onSubmit}>
        <TextField
          autoComplete="email"
          error={errors.email?.message}
          id="email"
          inputMode="email"
          label="Email"
          type="email"
          {...register('email')}
        />

        <TextField
          action={
            <button
              className={`rounded-sm text-xs font-semibold text-accent underline underline-offset-4 ${focusRing}`}
              onClick={() => {
                setShowPassword((visible) => !visible);
              }}
              type="button"
            >
              {showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            </button>
          }
          autoComplete="current-password"
          error={errors.password?.message}
          id="password"
          label="Contraseña"
          type={showPassword ? 'text' : 'password'}
          {...register('password')}
        />

        {rootError ? (
          <Alert ref={alertRef} tone="error">
            {rootError}
          </Alert>
        ) : null}

        <Button busy={isSubmitting} className="w-full" type="submit">
          Entrar
        </Button>
      </form>

      <p className="mt-6 text-sm text-ink-muted">
        ¿Todavía no tienes cuenta?{' '}
        <Link className="font-semibold text-accent underline underline-offset-4" to={registerHref}>
          Crear una cuenta
        </Link>
      </p>
    </div>
  );
}
