# Spike — Express como función serverless en Vercel

> Fase 0 · Timebox: 1–2 días · Estado: **decisión registrada, validación de despliegue pendiente de credenciales**.

## 1. Pregunta e hipótesis

**Pregunta:** ¿puede StudyLogV2 servir la SPA y la API Express desde un único proyecto Vercel, con el mismo origen, sin romper cookies `httpOnly`, cold starts, límites de body ni módulos nativos?

**Hipótesis:** sí. Express 5 exportado como handler desde `api/index.ts`, con Postgres gestionado y cadena pooled, cubre el MVP sin CORS ni `SameSite=None`.

## 2. Configuración probada

| Elemento | Valor |
|---|---|
| Node | 24.21.0 local; CI fija `.nvmrc` = 22 |
| pnpm | 12.16.1 |
| Express | 5.3.0 |
| Vercel | `vercel.json` + `api/index.ts` en la raíz |
| Postgres local | 16-alpine vía Docker Compose; sistema Postgres 18 en el entorno de validación |
| Build web | Vite 8.3.6, 76 módulos, `340.36 kB` (`106.82 kB` gzip) |
| Build API | tsup 9, `9.83 kB` ESM |
| Body limit | `express.json({ limit: '100kb' })` |
| Logs | pino + `x-request-id` en todas las respuestas |

Comandos ejecutados:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm db:migrate
pnpm db:seed
pnpm dev
pnpm test:e2e
```

## 3. Resultados medidos

| Comprobación | Resultado | Evidencia |
|---|---|---|
| `GET /api/health` con DB | `200 { status: "ok", database: "up" }` | curl y E2E |
| `GET /api/health/live` | `200` | Supertest y curl |
| `x-request-id` | Presente y propagado | Supertest |
| 404 con envelope común | `404 NOT_FOUND` | Supertest |
| DB caída | `503 { status: "error", database: "down" }` | Supertest |
| Build estático | Correcto | `vite build` |
| Build función | Correcto (ESM) | `tsup` |
| Bundle web | 340.36 kB / 106.82 kB gzip | `vite build` |
| Body máximo | 100 kB explícito | `app.ts` |
| E2E smoke | 3/3 en Chromium | Playwright |

### Lo que no se pudo medir aquí

- **Cold start real en Vercel:** requiere un proyecto y credenciales de Vercel, no disponibles en el entorno de ejecución.
- **Cookies `httpOnly` same-origin:** la autenticación llega en la Fase 1; no hay cookie que probar todavía.
- **`argon2`:** no se ha introducido aún; la Fase 1 debe validar el módulo nativo en el runtime de Vercel.
- **Conexión pooled de Neon/Supabase:** no hay base gestionada provisionada.
- **Límite de ejecución y body de Vercel:** se validarán en el primer preview.

Estas comprobaciones son un **gate de la Fase 1**, no una validación completada. No se declara el spike cerrado en falso.

## 4. Decisión

**Se mantiene D4: un solo proyecto Vercel** con la SPA estática y Express bajo `/api`.

Consecuencias:

- `api/index.ts` exporta la app; nunca llama a `listen()` ni ejecuta migraciones al arrancar.
- El cliente usa rutas relativas (`/api/...`) y cookies same-origin.
- `vercel.json` sirve `apps/web/dist` y reescribe `/api/*` a la función.
- La conexión de runtime debe ser pooled; `DATABASE_URL_UNPOOLED` se reserva para migraciones.

**Criterio de reversión:** si en el primer preview falla el cold start (objetivo orientativo < 2 s en p95), las cookies same-origin, `argon2` o el límite de body, se separan `studylog-web` y `studylog-api`, se añade allowlist CORS con `credentials: true` y cookies `SameSite=None; Secure`, y se documenta en `docs/deployment-spec.md`.

## 5. Trabajo pendiente antes de producción

1. Crear el proyecto Vercel y conectar el repositorio.
2. Configurar Neon/Supabase con `DATABASE_URL` pooled y `DATABASE_URL_UNPOOLED` directa.
3. Desplegar un preview de la Fase 1 y medir cold start, cookies, `argon2`, `requestId` y límites.
4. Ejecutar migraciones en CI/CD con la cadena directa, nunca en cold start.
5. Registrar los resultados en este documento y, si procede, ejecutar la reversión a dos proyectos.

## 6. Enlaces

- `vercel.json`
- `api/index.ts`
- `docs/deployment-spec.md`
- `docs/architecture-spec.md` (D4)
- `docs/testing-spec.md` §12 (DoD de Fase 0)
