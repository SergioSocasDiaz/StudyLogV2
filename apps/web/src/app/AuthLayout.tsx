import { Link, Outlet } from 'react-router-dom';

import { cn } from '../components/ui/cn';

/**
 * Abstract "study week" for the right panel.
 *
 * Columns are days and rows are blocks of the evening; the filled cells are the
 * sessions. It is a decorative rhythm, not data: no numbers, no invented
 * metrics, no stock photo.
 */
const WEEK: readonly (readonly number[])[] = [
  [0, 1, 2, 3, 2, 0, 0, 0],
  [1, 2, 3, 4, 3, 2, 0, 0],
  [0, 2, 3, 4, 4, 3, 1, 0],
  [1, 1, 2, 3, 4, 2, 1, 0],
  [0, 2, 3, 4, 3, 1, 0, 0],
  [0, 0, 1, 2, 2, 1, 0, 0],
  [0, 0, 1, 1, 0, 0, 0, 0],
];

const INTENSITY: readonly string[] = [
  'bg-ink/5',
  'bg-accent/15',
  'bg-accent/30',
  'bg-accent/45',
  'bg-accent/70',
];

export function AuthLayout() {
  return (
    <div className="min-h-dvh bg-bg text-ink lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <a
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-semibold"
        href="#contenido"
      >
        Saltar al contenido
      </a>

      <div className="flex min-h-dvh flex-col justify-center px-6 py-12 sm:px-10 lg:px-16">
        <Link className="font-display text-lg font-semibold tracking-tight text-ink" to="/">
          StudyLog
        </Link>

        <main className="mt-12 w-full max-w-md" id="contenido">
          <Outlet />
        </main>
      </div>

      <div
        aria-hidden="true"
        className="relative hidden overflow-hidden border-l border-border bg-surface lg:block"
      >
        <div className="absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />

        <div className="relative flex h-full flex-col justify-between px-14 py-16">
          <p className="max-w-xs font-display text-2xl leading-snug">
            Una semana de estudio.
            <br />
            Sin ruido, sin cifras inventadas.
          </p>

          <div className="grid grid-cols-7 gap-2.5">
            {WEEK.map((column, columnIndex) => (
              <div className="flex flex-col gap-2.5" key={columnIndex}>
                {column.map((level, rowIndex) => (
                  <span
                    className={cn('h-7 rounded-sm', INTENSITY[level] ?? 'bg-ink/5')}
                    key={rowIndex}
                  />
                ))}
              </div>
            ))}
          </div>

          <p className="max-w-xs text-sm leading-relaxed text-ink-muted">
            Registro honesto del esfuerzo universitario. Tú pones las horas; StudyLog las ordena.
          </p>
        </div>
      </div>
    </div>
  );
}
