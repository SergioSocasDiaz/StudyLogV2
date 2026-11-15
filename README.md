# StudyLogV2

StudyLogV2 registra el esfuerzo de estudio de estudiantes universitarios para que las horas invertidas se conviertan en información útil: asignaturas, sesiones, rachas y progreso.

## Stack

Monorepo TypeScript con pnpm:

- `apps/web` — React 19 + Vite + Tailwind CSS v4 + React Router 7.
- `apps/api` — Express 5 + Postgres 16 + Drizzle ORM.
- `packages/shared` — contrato Zod, tipos, errores y constantes.
- Tests con Vitest, React Testing Library, Supertest, MSW y Playwright.
- CI en GitHub Actions y despliegue previsto en Vercel.

## Arranque local

Requisitos: Node 22, pnpm 12 y Docker Compose o Podman.

```bash
nvm use
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
pnpm dev
```

- Web: http://127.0.0.1:5173
- API: http://127.0.0.1:3001
- Health: http://127.0.0.1:3001/api/health

`pnpm dev` ejecuta `scripts/ensure-db.mjs` antes de arrancar web y API. La base de datos local se gestiona con `infra/docker-compose.yml`; consulta `AGENTS.md` para el flujo completo y los comandos de test.

## Calidad

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

## Documentación

- [docs/README.md](docs/README.md) — índice de especificaciones.
- [docs/plan.md](docs/plan.md) — fases, ramas y criterios de entrega.
- [docs/contract-v0.md](docs/contract-v0.md) — contrato congelado en la Fase 0.
- [docs/spikes/vercel-express.md](docs/spikes/vercel-express.md) — decisión sobre Express en Vercel.
- [AGENTS.md](AGENTS.md) — comandos reales, estructura y reglas de trabajo.
