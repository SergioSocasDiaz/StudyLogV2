export function FullPageLoader() {
  return (
    <div
      aria-live="polite"
      className="flex min-h-dvh items-center justify-center bg-bg"
      role="status"
    >
      <span
        aria-hidden="true"
        className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent motion-reduce:animate-none"
      />
      <span className="sr-only">Comprobando tu sesión…</span>
    </div>
  );
}
