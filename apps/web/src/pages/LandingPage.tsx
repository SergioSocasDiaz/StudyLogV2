const pillars = [
  {
    title: 'Registra sin fricción',
    body: 'Sesiones manuales o Pomodoro. Sin hojas de cálculo ni estimaciones de memoria.',
  },
  {
    title: 'Mira el esfuerzo',
    body: 'Horas por asignatura, rachas y evolución semanal en un mismo sitio.',
  },
  {
    title: 'Sabe qué funciona',
    body: 'Compara lo que estudias con lo que avanzas y decide dónde invertir tu tiempo.',
  },
];

export function LandingPage() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 pb-16 pt-10 sm:pt-16">
      <div className="max-w-3xl">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent">
          Estudio universitario, medido
        </p>
        <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          Sabes cuánto estudias.
          <br />
          Ahora sabrás si funciona.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-muted">
          StudyLog convierte tus horas de estudio en un registro claro: asignaturas, sesiones,
          rachas y progreso real. Sin ruido y sin trabajo extra.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a
            className="rounded-md bg-accent px-5 py-3 text-sm font-semibold text-accent-ink transition-colors hover:opacity-90"
            href="#como-funciona"
          >
            Cómo funciona
          </a>
          <span className="rounded-md border border-border px-5 py-3 text-sm font-semibold text-ink-muted">
            Registro disponible en la Fase 1
          </span>
        </div>
      </div>

      <div
        className="mt-14 grid gap-4 sm:grid-cols-3"
        id="como-funciona"
        aria-label="Cómo funciona StudyLog"
      >
        {pillars.map((pillar) => (
          <article className="rounded-lg border border-border bg-surface p-6" key={pillar.title}>
            <h2 className="font-display text-lg font-semibold">{pillar.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{pillar.body}</p>
          </article>
        ))}
      </div>

      <p className="mt-10 max-w-xl text-sm leading-relaxed text-ink-muted">
        La aplicación completa llega en las siguientes fases. Esta es la base ejecutable de
        StudyLogV2: web, API y base de datos conectadas.
      </p>
    </section>
  );
}
