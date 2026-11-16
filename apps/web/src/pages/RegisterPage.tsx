import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { focusRing } from '../components/ui/cn';
import { SelectField } from '../components/ui/SelectField';
import { TextField } from '../components/ui/TextField';
import { useAuth } from '../features/auth/auth-context';
import { mapApiError } from '../features/auth/form-errors';
import type { RegisterFormValues } from '../features/auth/form-schemas';
import { registerFormSchema } from '../features/auth/form-schemas';
import { safeReturnTo } from '../features/auth/return-to';
import { detectTimezone, timezoneOptions } from '../features/auth/timezones';
import { useDocumentTitle } from '../lib/use-document-title';

export function RegisterPage() {
  useDocumentTitle('StudyLog — Crear cuenta');

  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const alertRef = useRef<HTMLDivElement>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Detected once: re-reading the timezone on every render would fight the
  // user's own selection.
  const detectedTimezone = useMemo(() => detectTimezone(), []);
  const zones = useMemo(() => timezoneOptions(detectedTimezone), [detectedTimezone]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    setFocus,
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
      timezone: detectedTimezone,
    },
  });

  const rootError = errors.root?.message ?? null;

  useEffect(() => {
    if (rootError) {
      alertRef.current?.focus();
    }
  }, [rootError]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await signUp(values);
      navigate(safeReturnTo(searchParams.get('returnTo')), { replace: true });
    } catch (error) {
      const mapping = mapApiError(error);
      let firstField: keyof RegisterFormValues | null = null;

      for (const field of ['displayName', 'email', 'password', 'timezone'] as const) {
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
  const loginHref = returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login';

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Crea tu cuenta</h1>
      <p className="mt-3 text-ink-muted">
        Empieza a registrar tu esfuerzo. Sin tarjeta y sin rellenar diez campos.
      </p>

      <form className="mt-8 space-y-5" noValidate onSubmit={onSubmit}>
        <TextField
          autoComplete="name"
          error={errors.displayName?.message}
          id="displayName"
          label="Nombre visible"
          {...register('displayName')}
        />

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
          autoComplete="new-password"
          error={errors.password?.message}
          hint="Entre 12 y 128 caracteres."
          id="password"
          label="Contraseña"
          type={showPassword ? 'text' : 'password'}
          {...register('password')}
        />

        <SelectField
          error={errors.timezone?.message}
          hint="La usamos para agrupar tus sesiones por día."
          id="timezone"
          label="Zona horaria"
          options={zones}
          {...register('timezone')}
        />

        {rootError ? (
          <Alert ref={alertRef} tone="error">
            {rootError}
          </Alert>
        ) : null}

        <Button busy={isSubmitting} className="w-full" type="submit">
          Crear cuenta
        </Button>
      </form>

      <p className="mt-6 text-sm text-ink-muted">
        ¿Ya tienes cuenta?{' '}
        <Link className="font-semibold text-accent underline underline-offset-4" to={loginHref}>
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
