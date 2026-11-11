# Spike — Express como función serverless en Vercel

> Fase 0 · Timebox: 1–2 días · Estado: **decisión registrada y despliegue validado sin base de datos gestionada** (ver §6).

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

1. ~~Crear el proyecto Vercel~~ hecho: `studylogv2` en el equipo `socas-dev`. Repositorio GitHub conectado el 11 nov 2026 con production branch `main`: los previews por rama/PR y el deploy de producción son automáticos.
2. Configurar Neon/Supabase con `DATABASE_URL` pooled y `DATABASE_URL_UNPOOLED` directa. **Pendiente**: sin base gestionada, `/api/health` responde `503 database down`.
3. Desplegar un preview de la Fase 1 y medir cold start, cookies, `argon2`, `requestId` y límites. `requestId` ya verificado; el resto depende de Fase 1.
4. Ejecutar migraciones en CI/CD con la cadena directa, nunca en cold start.
5. Registrar los resultados en este documento y, si procede, ejecutar la reversión a dos proyectos.

## 6. Estado real del despliegue (11 nov 2026)

Proyecto `studylogv2` (`prj_FmxDmLMpnTZl7zAesA26HR2XPgon`, equipo `socas-dev`), vinculado en `.vercel/` (ignorado por git). El **11 nov 2026** se conectó el repositorio `SergioSocasDiaz/StudyLogV2` con production branch `main`: desde entonces cada push a una rama o PR genera un deployment Preview y cada push a `main` genera Producción, sin usar la CLI. Los deployments de la tabla siguiente se subieron por CLI antes de esa conexión.

### Deployments encontrados

| Fecha | Entorno | Resultado |
|---|---|---|
| 8 nov 16:32 | Production (`studylogv2.vercel.app`) | Web estática OK; función `api/index` con `FUNCTION_INVOCATION_FAILED` |
| 8 nov 22:09 | Preview (×2) | Idem |

Causa del fallo en esos tres: el build desplegado era anterior al código actual (`buildCommand` sin `@studylog/shared`) y el entrypoint compilado importaba `../apps/api/src/app` sin resolución:

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/apps/api/src/app'
imported from /var/task/api/index.js
```

Además el proyecto no tenía **ninguna** variable de entorno (`vercel env ls` vacío).

### Corrección aplicada

- Se añadió `JWT_ACCESS_SECRET` (secreto distinto) en los entornos **Preview** y **Production**. Sin él, `apps/api/src/config/env.ts` aborta el arranque de la función porque `NODE_ENV=production`: `Error: JWT_ACCESS_SECRET must be configured in production`.
- Se reconstruyó con `pnpm build` + `vercel build` y se desplegó un preview con `vercel deploy --prebuilt`.
- Verificado el preview, se promovió a producción con `vercel promote`, que sustituyó el deployment roto del 8 nov. El alias `studylogv2.vercel.app` sirve ahora la versión corregida. Para volver atrás: `vercel rollback` o promover el deployment anterior.

### Verificado en preview y producción

| Comprobación | Resultado |
|---|---|
| `GET /api/health/live` | `200 {"status":"ok","uptimeSeconds":…}` |
| `GET /api/health` | `503 {"status":"error","database":"down"}` (sin DB gestionada, comportamiento esperado) |
| `GET /api/nope` | `404 {"error":{"code":"NOT_FOUND",…}}` |
| `x-request-id` | Presente en la respuesta |
| `GET /` | Landing estática servida correctamente |

Notas:

- Las URLs están protegidas por **Deployment Protection** (Vercel Authentication): sin sesión redirigen al login. Para probar por CLI: `vercel curl <ruta> --deployment <url>`.
- Runtime en la nube: `nodejs26.x` (ajuste del proyecto). En local `.nvmrc` fija 22 y `vercel build` emite `nodejs24.x`; no afectó a la ejecución.
- `api/index.ts` importa `../apps/api/src/app.js` y `@vercel/node` compila todo el árbol de `apps/api` dentro de la función: funciona, pero cualquier refactor debe volver a comprobar el preview.

## 7. Enlaces

- `vercel.json`
- `api/index.ts`
- `docs/deployment-spec.md`
- `docs/architecture-spec.md` (D4)
- `docs/testing-spec.md` §12 (DoD de Fase 0)
