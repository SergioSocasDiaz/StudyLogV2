# Documentación de StudyLogV2

Esta carpeta contiene las especificaciones técnicas y el plan de desarrollo de StudyLogV2. La documentación describe el diseño acordado; el código todavía no existe en el repositorio.

## Índice

| Archivo | Contenido |
|---|---|
| [product-spec.md](./product-spec.md) | Propósito, alcance, usuarios, requisitos funcionales y no funcionales, MVP y decisiones pendientes |
| [architecture-spec.md](./architecture-spec.md) | Stack, estructura del repositorio, topología, flujo de datos y decisiones de arquitectura |
| [database-spec.md](./database-spec.md) | Modelo relacional, tablas, relaciones, constraints, índices y migraciones |
| [api-spec.md](./api-spec.md) | Contrato HTTP, autenticación, errores, paginación, idempotencia y endpoints |
| [security-spec.md](./security-spec.md) | JWT, cookies, CSRF, autorización, validación, rate limiting y secretos |
| [frontend-spec.md](./frontend-spec.md) | Arquitectura React, rutas, estado, data fetching, formularios y rendimiento |
| [ui-spec.md](./ui-spec.md) | Dirección visual, landing, dashboard, Pomodoro, ReactBits, accesibilidad y gates de diseño |
| [testing-spec.md](./testing-spec.md) | Estrategia de pruebas, comandos, fixtures, CI y Definition of Done |
| [gitflow-spec.md](./gitflow-spec.md) | Ramas, PRs, revisión con `@code-review`, releases y protección de ramas |
| [deployment-spec.md](./deployment-spec.md) | Vercel, Postgres gestionado, variables de entorno, migraciones, observabilidad y rollback |
| [risks-spec.md](./risks-spec.md) | Riesgos técnicos y de producto, impacto y mitigaciones |
| [plan.md](./plan.md) | Únicamente las fases de desarrollo (0–6) y sus criterios de salida |
| [spikes/README.md](./spikes/README.md) | Spikes técnicos y plantilla para documentar sus resultados |

## Orden de lectura recomendado

1. `product-spec.md`
2. `architecture-spec.md`
3. `database-spec.md`
4. `api-spec.md`
5. `security-spec.md`
6. `frontend-spec.md` y `ui-spec.md`
7. `testing-spec.md` y `gitflow-spec.md`
8. `deployment-spec.md`
9. `plan.md`

## Fuente de verdad

- El contrato compartido vive en `packages/shared` y debe reflejarse en `api-spec.md`.
- Los comandos reales deben actualizarse en `AGENTS.md` cuando se implemente la Fase 0.
- Si una decisión cambia, actualizar el documento afectado y, si cambia el alcance de una fase, `plan.md` en el mismo PR.
