# Especificación de arquitectura — StudyLogV2

## 1. Visión general

StudyLogV2 se organiza como un monorepo TypeScript con dos aplicaciones y un paquete compartido:

- `apps/web`: SPA React desplegada como sitio estático en Vercel.
- `apps/api`: API Express que se ejecuta como función serverless en Vercel.
- `packages/shared`: schemas Zod, tipos, constantes y errores comunes.

Postgres es la fuente de verdad. La caché de lectura en el cliente se resuelve con TanStack Query; no se usa una caché write-behind para sesiones de estudio.

## 2. Stack

| Capa | Elección |
|---|---|
| Frontend | React 19 + Vite + TypeScript, React Router 7 en library mode, Tailwind CSS v4, Recharts, TanStack Query, React Hook Form + Zod |
| Backend | Node 22 + Express 5 + TypeScript, Zod, Drizzle ORM, Postgres 16/17, JWT con `jose`, argon2id, Helmet, pino |
| Tests | Vitest + React Testing Library + Supertest + Playwright + MSW |
| Infra | pnpm workspaces, Docker Compose para Postgres local, GitHub Actions, Vercel, Neon/Supabase |
| Opcional | Upstash Redis para rate limiting y agregados, Sentry, Resend |

### 2.1 Gotchas del stack

- **Tailwind v4** usa configuración CSS-first (`@import "tailwindcss"` y `@theme`), no el `tailwind.config.js` clásico.
- **React Router 7 en library mode** con `createBrowserRouter`; no usar framework mode si el despliegue va a ser estático en Vercel.
- **Drizzle** encaja mejor que Prisma en serverless por peso y arranque. Si el equipo prefiere Prisma, decidirlo en Fase 0 y no mezclar.
- **Express en Vercel** debe ser stateless: sin memoria compartida, sin websockets y sin procesos en background.
- **Node 22** en Vercel; validar la versión en el spike de Fase 0.

## 3. Estructura del repositorio

```text
StudyLogV2/
├─ apps/
│  ├─ web/                  # React + Vite + Tailwind
│  └─ api/                  # Express: rutas, servicios, DB, middleware
├─ packages/
│  └─ shared/               # Zod schemas, tipos, constantes, errores
├─ api/index.ts             # entrada serverless para Vercel
├─ infra/
│  ├─ docker-compose.yml    # Postgres local
│  └─ seeds/                # datos de demo/test
├─ docs/                    # especificaciones y plan
│  ├─ README.md
│  ├─ *-spec.md
│  ├─ plan.md
│  └─ spikes/               # spikes técnicos (p. ej. Vercel + Express)
├─ .github/
│  ├─ workflows/ci.yml
│  ├─ ISSUE_TEMPLATE/
│  └─ pull_request_template.md
├─ vercel.json
├─ pnpm-workspace.yaml
├─ AGENTS.md
└─ README.md
```

Regla: `packages/shared` es el contrato. Los schemas Zod se definen ahí antes de implementar frontend y backend. Los cambios de contrato van en su propia rama/PR para no bloquear dos agentes.

## 4. Decisiones de arquitectura

### 4.1 Postgres frente a MongoDB

Se elige **Postgres**:

- Los datos son relacionales: usuario → asignaturas → sesiones, amistades, emblemas y leaderboards.
- Integridad referencial y constraints reales.
- Transacciones para crear sesión y actualizar agregados.
- Agregaciones e índices para rachas y leaderboards.
- `JSONB` para metadatos flexibles de emblemas o preferencias.

MongoDB sería defendible si el esquema fuese muy cambiante, pero aquí añadiría complejidad en amistades, permisos y rankings sin ventaja clara.

### 4.2 Caché y escrituras

**No se usa write-behind cache para sesiones de estudio.**

Riesgos del write-behind:

- Si el usuario cierra la pestaña, pierde la sesión.
- En Vercel cada petición puede ir a otra instancia: una caché en memoria no se comparte.
- Añade conflictos, reintentos y estados “pendiente de guardar” sin necesidad.
- Una sesión de estudio es un dato pequeño: Postgres la escribe en milisegundos.

Flujo recomendado:

```text
UI optimista → caché de TanStack Query → escritura debounced (800–1200 ms)
                                      → flush en blur / visibilitychange / pagehide
                                      → POST/PATCH idempotente → Postgres
```

- TanStack Query evita repeticiones de lectura mientras el usuario navega.
- Las escrituras manuales se agrupan con debounce y se envían con `Idempotency-Key`.
- El Pomodoro guarda su estado en `localStorage` y crea la sesión al completar o al pulsar “Guardar”.
- Redis/Upstash es opcional y solo para lecturas caras: resumen semanal y leaderboard, con TTL de 30–60 s e invalidación al escribir. En MVP no se necesita.

### 4.3 Autenticación

- Access token JWT de 15 minutos en memoria.
- Refresh token en cookie `httpOnly`, `secure`, `SameSite=Lax` (o `None` si hay dominios separados).
- Rotación de refresh token y detección de reutilización.
- CSRF: `SameSite` + validación de `Origin` en peticiones mutables.
- Rate limiting en login/register/refresh.

Ver `security-spec.md`.

### 4.4 Topología de despliegue

Preferencia: **un solo proyecto Vercel** con web y `/api` en el mismo origen. Esto simplifica cookies, CORS y CSRF. Si el adapter de Express da problemas, separar web y API en dos proyectos y ajustar CORS + `SameSite`.

Detalles en `deployment-spec.md`.

### 4.5 Decisiones registradas

| # | Decisión | Motivo | Consecuencia |
|---|---|---|---|
| D1 | **Postgres, no MongoDB** | Datos relacionales (usuarios, asignaturas, sesiones), agregaciones SQL y ventanas temporales | Drizzle + migraciones versionadas; consultas de estadísticas en SQL |
| D2 | **Sin caché write-behind para sesiones** | Evitar pérdida de datos y duplicados; la complejidad no se justifica en el MVP | UI optimista + TanStack Query + escrituras debounced (800–1200 ms) + flush + `Idempotency-Key`; Postgres como fuente de verdad |
| D3 | **Redis/Upstash solo opcional** | Solo para agregados caros (leaderboard, resumen) con TTL 30–60 s e invalidación al escribir | No es dependencia del MVP; se evalúa en la fase 5 |
| D4 | **Un solo proyecto Vercel (web + `/api`)** | Mismo origen: cookies simples, sin CORS, menos configuración | Express como función serverless stateless; si el spike falla, separar web y API |
| D5 | **Migraciones en CI, nunca al arrancar la función** | Evitar carreras entre instancias y arranques lentos | `pnpm db:migrate` en job de despliegue con conexión directa (no pooled) |
| D6 | **Sin background jobs fiables en Vercel** | Las funciones son efímeras | Vercel Cron o QStash para tareas programadas; nada crítico en memoria |
| D7 | **Plan Hobby no comercial** | Los términos de Vercel Hobby limitan el uso comercial | Revisar términos antes de monetizar; migrar a Pro o a otro host |
| D8 | **ReactBits vendorizado y con lazy load** | Evitar dependencia de CDN, auditar licencia, seguridad y peso | Copia local del componente, revisión humana, `React.lazy`, fallback y `prefers-reduced-motion` |

## 5. Flujo de datos

### 5.1 Lectura

```text
React Query cache → GET /api/v1/... → Express → Drizzle → Postgres
```

- TanStack Query mantiene `staleTime` corto para datos personales.
- Los agregados pueden cachearse en servidor solo si las métricas lo justifican.
- Los datos de usuario nunca se cachean en CDN.

### 5.2 Escritura

```text
Formulario / Pomodoro → mutación optimista → debounce → POST/PATCH con Idempotency-Key
→ Express valida con Zod → servicio → Postgres → invalidación de queries
```

- Las mutaciones críticas esperan confirmación del servidor antes de mostrar éxito definitivo.
- Si falla la petición, se revierte el estado optimista y se muestra un error.

## 6. Límites entre módulos

- `apps/web` no importa código de `apps/api`; solo consume `packages/shared`.
- `apps/api` no importa componentes ni código de React.
- `packages/shared` no depende de Express, React ni base de datos.
- Los servicios de API reciben tipos de entrada ya validados.
- Las rutas no contienen lógica de negocio compleja; delegan en servicios.

## 7. Riesgos de arquitectura

- Express en Vercel puede requerir un adapter y tiene cold starts.
- El plan Hobby de Vercel es no comercial; revisar términos antes de monetizar.
- Las migraciones no deben ejecutarse al arrancar una función serverless.
- Sin background jobs fiables en serverless; usar Vercel Cron o QStash si hace falta.
- El pool de conexiones debe ser global y usar cadena pooled de Neon/Supabase.

## 8. Decisiones que se validan en Fase 0

- Que Express funcione correctamente como función serverless en Vercel.
- Que las cookies funcionen con el dominio/preview de Vercel.
- Que Drizzle + Postgres pooled funcione con el runtime elegido.
- Que el coste y los límites del plan gratuito sean suficientes para el MVP.
