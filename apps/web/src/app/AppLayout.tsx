import { Link, Outlet, useNavigate } from 'react-router-dom';

import { Button } from '../components/ui/Button';
import { useAuth } from '../features/auth/auth-context';

export function AppLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut(): Promise<void> {
    await signOut();
    navigate('/', { replace: true });
  }

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <a
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-semibold"
        href="#contenido"
      >
        Saltar al contenido
      </a>

      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <Link className="font-display text-lg font-semibold tracking-tight" to="/app">
            StudyLog
          </Link>

          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-ink-muted sm:inline">{user?.displayName}</span>
            <Button
              className="px-4 py-2"
              onClick={() => {
                void handleSignOut();
              }}
              variant="secondary"
            >
              Cerrar sesión
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-10" id="contenido">
        <Outlet />
      </main>
    </div>
  );
}
