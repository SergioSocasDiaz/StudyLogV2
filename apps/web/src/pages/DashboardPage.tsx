import { useAuth } from '../features/auth/auth-context';
import { useDocumentTitle } from '../lib/use-document-title';

export function DashboardPage() {
  useDocumentTitle('StudyLog — Tu espacio');

  const { user } = useAuth();
  const name = user?.displayName ?? 'estudiante';

  return (
    <section>
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent">Tu espacio</p>
      <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight">Hola, {name}</h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-muted">
        Tu sesión está activa y se mantiene al recargar. Aquí irán apareciendo tus datos a medida
        que avance el proyecto.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <article className="rounded-lg border border-border bg-surface p-6">
          <h2 className="font-display text-lg font-semibold">Asignaturas</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            Llegan en la fase 1.4: crear, renombrar y archivar las asignaturas del curso.
          </p>
        </article>

        <article className="rounded-lg border border-border bg-surface p-6">
          <h2 className="font-display text-lg font-semibold">Sesiones de estudio</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            En la fase 2, con registro manual, Pomodoro y estadísticas semanales.
          </p>
        </article>
      </div>
    </section>
  );
}
