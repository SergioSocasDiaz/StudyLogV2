import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-24">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent">404</p>
      <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
        Esa página no existe.
      </h1>
      <p className="mt-4 max-w-lg text-ink-muted">
        Puede que el enlace esté mal escrito o que la sección aún no esté disponible.
      </p>
      <Link
        className="mt-8 inline-block rounded-md bg-accent px-5 py-3 text-sm font-semibold text-accent-ink"
        to="/"
      >
        Volver al inicio
      </Link>
    </section>
  );
}
