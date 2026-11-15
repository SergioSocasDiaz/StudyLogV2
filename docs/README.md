# Documentación de StudyLogV2

Esta carpeta contiene las especificaciones técnicas y el plan de desarrollo de StudyLogV2. La Fase 0 ya está implementada; el resto de fases se construyen sobre su contrato y su tooling.

## Índice

| Archivo | Contenido |
|---|---|
| [product-spec.md](./product-spec.md) | Propósito, alcance, usuarios, requisitos funcionales y no funcionales, MVP y decisiones pendientes |
| [architecture-spec.md](./architecture-spec.md) | Stack, estructura del repositorio, topología, flujo de datos y decisiones de arquitectura |
| [database-spec.md](./database-spec.md) | Modelo relacional, tablas, relaciones, constraints, índices y migraciones |
| [api-spec.md](./api-spec.md) | Contrato HTTP, autenticación, errores, paginación, idempotencia y endpoints |
| [contract-v0.md](./contract-v0.md) | Contrato v0 congelado en la Fase 0 y proceso para cambiarlo |
| [security-spec.md](./security-spec.md) | JWT, cookies, CSRF, autorización, validación, rate limiting y secretos |
| [frontend-spec.md](./frontend-spec.md) | Arquitectura React, rutas, estado, data fetching, formularios y rendimiento |
| [ui-spec.md](./ui-spec.md) | Dirección visual, landing, dashboard, Pomodoro, ReactBits, accesibilidad y gates de diseño |
| [testing-spec.md](./testing-spec.md) | Estrategia de pruebas, comandos, fixtures, CI y Definition of Done |
| [gitflow-spec.md](./gitflow-spec.md) | Ramas, PRs, revisión con `@code-review`, releases y protección de ramas |
| [deployment-spec.md](./deployment-spec.md) | Vercel, Postgres gestionado, variables de entorno, migraciones, observabilidad y rollback |
| [risks-spec.md](./risks-spec.md) | Riesgos técnicos y de producto, impacto y mitigaciones |
| [plan.md](./plan.md) | Únicamente las fases de desarrollo (0–6) y sus criterios de salida |
| [spikes/README.md](./spikes/README.md) | Spikes técnicos y plantilla para documentar sus resultados |
| [spikes/vercel-express.md](./spikes/vercel-express.md) | Spike de Express en Vercel y decisión de topología |

## Orden de lectura recomendado

1. `product-spec.md`
2. `architecture-spec.md`
3. `database-spec.md`
4. `api-spec.md`
5. `security-spec.md`
6. `contract-v0.md`
7. `frontend-spec.md` y `ui-spec.md`
8. `testing-spec.md` y `gitflow-spec.md`
9. `deployment-spec.md`
10. `plan.md`

## Fuente de verdad

- El contrato compartido vive en `packages/shared` y debe reflejarse en `api-spec.md`.
- Los comandos reales viven en `AGENTS.md`; si cambian, actualizar ambos documentos en el mismo PR.
- Si una decisión cambia, actualizar el documento afectado y, si cambia el alcance de una fase, `plan.md` en el mismo PR.
