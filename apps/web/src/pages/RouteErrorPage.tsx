import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';

export function RouteErrorPage() {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : 500;

  return (
    <section className="mx-auto w-full max-w-3xl px-6 py-24" role="alert">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-danger">
        Error {status}
      </p>
      <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight">
        Algo no ha salido bien.
      </h1>
      <p className="mt-4 text-ink-muted">
        Vuelve a intentarlo. Si el problema continúa, recarga la página.
      </p>
      <Link className="mt-8 inline-block font-semibold underline" to="/">
        Volver al inicio
      </Link>
    </section>
  );
}
