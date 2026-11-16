import { Link } from 'react-router-dom';

import { useDocumentTitle } from '../lib/use-document-title';
import { Button } from './ui/Button';

/**
 * Shown when the session cannot be verified (rate limited or offline).
 *
 * It deliberately does not redirect to `/login`: the user may still have a valid
 * session, and sending them to a login form they do not need is worse than
 * offering a retry.
 */
export function SessionUnavailable({ onRetry }: { onRetry: () => void }) {
  useDocumentTitle('StudyLog — No pudimos comprobar tu sesión');

  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-6 py-16"
      id="contenido"
    >
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent">Un momento</p>
      <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight">
        No hemos podido comprobar tu sesión
      </h1>
      <p className="mt-4 text-ink-muted">
        Puede que hayas hecho demasiadas peticiones seguidas. Tu sesión no se ha cerrado. Espera
        unos segundos y vuelve a intentarlo.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Button onClick={onRetry}>Reintentar</Button>
        <Link
          className="text-sm font-semibold text-accent underline underline-offset-4"
          to="/login"
        >
          Ir a iniciar sesión
        </Link>
      </div>
    </main>
  );
}
