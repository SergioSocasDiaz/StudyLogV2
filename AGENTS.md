# AGENTS.md

## Project

StudyLogV2 tracks university students' study effort. Product and technical specifications live in `docs/`; start with `docs/README.md`, `docs/product-spec.md`, and `docs/plan.md` (phases only).

## Current state

- Greenfield: the repo currently contains only `README.md`, `AGENTS.md`, and `docs/`. No source code, manifest, lockfile, or tooling exists yet.
- Planned stack: TypeScript monorepo with pnpm, React + Vite + Tailwind v4 + React Router 7, Express 5, Postgres + Drizzle, Vitest/RTL/Supertest/Playwright, deployed on Vercel. Do not scaffold features until Fase 0 is executed.
- Commands in `docs/testing-spec.md` §4 are targets, not executable yet. After Fase 0, replace this section with the real commands and single-test workflow.
- `docs/` is the source of truth. If a decision changes, update the affected spec and, if the phase scope changes, `docs/plan.md` in the same PR. Branch and review rules live in `docs/gitflow-spec.md`.

## Git

- Default branch: `main`, tracking `origin/main` at `github.com/SergioSocasDiaz/StudyLogV2`.
- Gitflow: `feature/*` → `develop` → `main`. No direct commits to `main` or `develop`. Review flow and branch rules are in `docs/gitflow-spec.md`.
