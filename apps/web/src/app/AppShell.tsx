import { Link, Outlet } from 'react-router-dom';

export function AppShell() {
  return (
    <div className="min-h-dvh bg-bg text-ink">
      <a
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-semibold"
        href="#contenido"
      >
        Saltar al contenido
      </a>

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-5">
        <Link className="font-display text-lg font-semibold tracking-tight" to="/">
          StudyLog
        </Link>

        <nav aria-label="Cuenta" className="flex items-center gap-2 text-sm font-semibold">
          <Link className="rounded-md px-3 py-2 text-ink-muted hover:text-ink" to="/login">
            Entrar
          </Link>
          <Link className="rounded-md bg-accent px-4 py-2 text-accent-ink" to="/register">
            Crear cuenta
          </Link>
        </nav>
      </header>

      <main id="contenido">
        <Outlet />
      </main>

      <footer className="mx-auto w-full max-w-6xl px-6 py-10 text-sm text-ink-muted">
        <p>StudyLogV2 — registro honesto del esfuerzo universitario.</p>
      </footer>
    </div>
  );
}
