import { Link, Outlet } from 'react-router-dom';

export function AppShell() {
  return (
    <div className="min-h-dvh bg-bg text-ink">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Link className="font-display text-lg font-semibold tracking-tight" to="/">
          StudyLog
        </Link>
        <span className="text-sm text-ink-muted">Fase 0 · Fundación</span>
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
