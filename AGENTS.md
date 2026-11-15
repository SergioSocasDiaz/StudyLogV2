# AGENTS.md

## Project

StudyLogV2 tracks university students' study effort. Product and technical specifications live in `docs/`; start with `docs/README.md`, `docs/product-spec.md`, and `docs/plan.md` (phases only).

## Current state

- Fase 0 (foundation) is implemented on `chore/foundation`: pnpm monorepo, tooling, local Postgres, shared contract v0, web/API bases, CI, Playwright and the Vercel decision spike.
- Vercel: project `studylogv2` (`socas-dev`) serves the static SPA and the Express function under `/api`. The GitHub repository is connected (production branch `main`), so pushes deploy automatically: PRs and non-`main` branches get a Preview, `main` gets Production — no CLI step needed. `JWT_ACCESS_SECRET` is configured for Preview and Production; there is no managed Postgres yet, so `/api/health` answers `503 database down` while `/api/health/live` is `200`. Details in `docs/spikes/vercel-express.md` §6.
- Stack: TypeScript monorepo with pnpm, React + Vite + Tailwind v4 + React Router 7, Express 5, Postgres + Drizzle, Vitest/RTL/Supertest/Playwright, deployed on Vercel.
- The next implementation work starts at Fase 1 (`docs/plan.md`). Do not add product features on foundation branches.
- `docs/` is the source of truth. If a decision changes, update the affected spec and, if the phase scope changes, `docs/plan.md` in the same PR. Branch and review rules live in `docs/gitflow-spec.md`.

## Repository layout

```text
apps/
  api/           Express 5 API, Drizzle client, migrations and seed
  web/           React SPA (Vite, Tailwind v4, React Router 7)
packages/
  shared/        Zod schemas, inferred types, error codes and constants (contract v0)
api/
  index.ts       Vercel serverless entrypoint (exports the Express app)
e2e/             Playwright smoke tests
infra/           Postgres docker-compose and seed notes
scripts/         Local dev helpers (ensure-db)
docs/            Product and technical specifications
```

## Prerequisites

- Node 22 (`nvm use` reads `.nvmrc`). Node 24 also works locally.
- pnpm `12.16.1` (`corepack enable` picks it up from `packageManager`).
- Postgres 16 via Docker Compose or Podman. `scripts/ensure-db.mjs` supports both.
- Copy `.env.example` to `.env` for local overrides. Never commit `.env`.

## Commands

| Command | Purpose |
|---|---|
| `pnpm install --frozen-lockfile` | Reproducible install from the lockfile |
| `pnpm dev` | Ensure DB, then run API (`:3001`) and web (`:5173`) |
| `pnpm dev:api` / `pnpm dev:web` | Run one side only |
| `pnpm lint` | ESLint flat config |
| `pnpm typecheck` | Root config plus every workspace, sequentially |
| `pnpm test` | Vitest across shared, API and web |
| `pnpm test:e2e` | Playwright smoke suite (starts `pnpm dev` if needed) |
| `pnpm build` | Build API with tsup and web with Vite |
| `pnpm db:up` / `pnpm db:down` | Postgres via Docker Compose |
| `node scripts/ensure-db.mjs` | Start Postgres with Docker or Podman, or verify the port |
| `pnpm db:generate` | Generate Drizzle migrations |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:seed` | Run the deterministic seed |
| `pnpm build && vercel build && vercel deploy --prebuilt` | Manual Vercel deploy (optional; Git integration deploys on push) |
| `pnpm format` / `pnpm format:check` | Prettier |

Single-test workflow:

```bash
pnpm --filter @studylog/api test -- src/app.test.ts
pnpm --filter @studylog/web test -- src/pages/LandingPage.test.tsx
pnpm --filter @studylog/shared test -- src/schemas.test.ts
pnpm test:e2e -- e2e/smoke.spec.ts
```

Local endpoints: web at `http://127.0.0.1:5173`, API at `http://127.0.0.1:3001`, health at `GET /api/health`.

## Quality gate

CI (`.github/workflows/ci.yml`) runs `install → lint → typecheck → test → build`, then a separate E2E job with Postgres, migrations, seed and Playwright. A PR is only ready for human review when the gate is green. The PR checklist is in `.github/pull_request_template.md`.

## Contract

- `packages/shared` is the executable contract: Zod schemas, inferred types, error codes, pagination limits and domain constants.
- `docs/contract-v0.md` records what is frozen for Fase 0 and how to change it.
- Contract changes use their own `chore/contract-<slug>` PR to `develop`; consumers rebase afterwards.
- `apps/web` must not import from `apps/api`; both may import `@studylog/shared`.

## Git

- Default branch: `main`, tracking `origin/main` at `github.com/SergioSocasDiaz/StudyLogV2`.
- Gitflow: `feature/*` → `develop` → `main`. No direct commits to `main` or `develop`. Review flow and branch rules are in `docs/gitflow-spec.md`.
- When a branch is ready, open the PR to `develop` automatically with `gh pr create` (base `develop`). Never merge without human approval.
