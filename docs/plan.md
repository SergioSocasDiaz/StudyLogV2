# Plan de desarrollo — StudyLogV2

> Este documento contiene **únicamente las fases de desarrollo**. Las especificaciones de producto, arquitectura, base de datos, API, seguridad, frontend, UI, testing, Gitflow, despliegue y riesgos viven en el resto de archivos de `docs/`; empieza por [`README.md`](./README.md).

## Resumen de fases

| Fase | Rama(s) | Entrega | Salida (criterio de cierre) | Depende de |
|---|---|---|---|---|
| **0. Fundación** | `chore/foundation` | Monorepo, tooling, DB local, CI, contrato inicial, spike Vercel | `pnpm dev` levanta web + API + DB; CI verde; contrato congelado | — |
| **1. Auth + asignaturas** | `feature/auth-api`, `feature/auth-ui`, `feature/subjects-api`, `feature/subjects-ui` | Registro/login seguros y CRUD de asignaturas con ownership | Registro → login → crear asignatura → recargar y seguir autenticado; usuario A no ve datos de B | Fase 0 |
| **2. Sesiones + dashboard** | `feature/sessions-api`, `feature/stats-api`, `feature/dashboard-ui` | Registro de sesiones, estadísticas y dashboard | Crear/editar/eliminar se refleja en totales y gráfica; reintentar no duplica | Fase 1 |
| **3. Pomodoro** | `feature/pomodoro` | Temporizador fiable y accesible que crea sesiones | Sobrevive navegación y recarga; completa una sesión exactamente una vez | Fase 2 (`sessions-api`) |
| **4. Landing + pulido** | `feature/landing`, `feature/a11y-polish` | Landing profesional y accesibilidad | Landing sin placeholders, CTA a registro, preview funcionando y GATE PASS | Fase 3 (UI real) |
| **5. Social y escalado** *(post-MVP)* | `feature/streaks`, `feature/friends-api`, `feature/leaderboard-api`, `feature/leaderboard-ui`, `feature/badges` | Rachas, amigos, leaderboard y emblemas | Amistades, ranking semanal y emblemas sin fugas de datos | Fase 4 (MVP cerrado) |
| **6. Producción** | `release/v1.0.0` | Hardening, observabilidad, backups y release | Checklist de producción completo; runbook probado; v1.0.0 etiquetada | Fase 5 o Fase 4 si se publica sin social |

**MVP = fases 0–4.** La fase 5 es post-MVP y la fase 6 es la puesta en producción.

Dependencias detalladas, reglas de paralelización y matriz de propiedad de archivos: [`gitflow-spec.md`](./gitflow-spec.md) §10. Definition of Done general y por fase: [`testing-spec.md`](./testing-spec.md) §§11–12.

---

## Fases detalladas

### Fase 0 — Fundación

**Rama:** `chore/foundation` (sale de `develop`; si `develop` aún no existe, se crea desde `main` con un PR inicial).

**Objetivo:** dejar un monorepo reproducible, con calidad automatizada, base de datos local, contrato compartido y decisión tomada sobre el despliegue en Vercel.

**Alcance**

1. **Scaffold del monorepo**
   - `pnpm-workspace.yaml`, `package.json` raíz con scripts, `.nvmrc` (Node 22), `.gitignore`, `.editorconfig`.
   - `tsconfig.base.json` con `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `moduleResolution: bundler`, paths a `@studylog/shared`.
   - ESLint (flat config) + Prettier + `eslint-plugin-react-hooks` y reglas de imports ordenados.
   - Vitest configurado en raíz y por paquete; Playwright en la raíz.
2. **`docker-compose.yml`** en `infra/` con Postgres 16 pineado, volumen persistente, healthcheck y puerto configurable. `.env.example` con todas las variables.
3. **`apps/web`**
   - Vite + React + TypeScript; Tailwind CSS v4 mediante `@tailwindcss/vite`.
   - React Router 7 en library mode con layout raíz, ruta `/` y página 404.
   - Providers: `QueryClientProvider`, `AuthProvider` vacío, manejo global de errores.
   - MSW configurado para tests (y opcionalmente para desarrollo).
4. **`apps/api`**
   - Express 5 con `GET /api/health` (incluye ping a la DB) y `GET /api/health/live`.
   - Middleware de `requestId`, logging básico, parser JSON con límite explícito, 404 y error handler con el envelope común.
   - Configuración tipada de entorno validada con Zod al arrancar.
   - Cliente Drizzle y configuración de `drizzle-kit`.
5. **`packages/shared`**
   - Esquemas Zod iniciales: `user`, `subject`, `studySession`, `pagination`, `apiError`.
   - Códigos de error, tipos inferidos y constantes (colores permitidos, límites de paginación, duraciones máximas).
   - **Contrato v0 congelado** y documentado.
6. **CI**
   - Workflow `ci.yml`: `install` → `lint` → `typecheck` → `test` → `build`.
   - Job separado `e2e` con servicio Postgres, migraciones, seed y Playwright.
   - Cache de pnpm; `--frozen-lockfile`; artefactos de test y trazas E2E en fallo.
7. **Gobernanza**
   - `pull_request_template.md` con checklist (alcance, tests, contrato, migración, capturas si UI).
   - Issue templates: `feature`, `bug`, `spike`, `chore`.
   - Protección de `main` y `develop`: PR obligatorio, 1 aprobación, checks requeridos, sin force-push, conversaciones resueltas.
8. **Spike de Vercel** (timebox 1–2 días, documento en `docs/spikes/vercel-express.md`)
   - Un solo proyecto con build estático + función Express en `/api`.
   - Postgres gestionado con conexión **pooled** (Neon/Supabase) y conexión directa para migraciones.
   - Verificar: cookie `httpOnly` same-origin, cold start, límite de body, tamaño del bundle, módulos nativos (argon2), `requestId`, tiempo de ejecución.
   - **Criterio de decisión:** si el spike falla o el cold start es inaceptable, se separan web y API y se documenta CORS + cookies entre dominios.
9. **`AGENTS.md`** actualizado con comandos reales, estructura, reglas de ramas y flujo de revisión.

**Criterios de aceptación**

- `pnpm install --frozen-lockfile` funciona desde cero.
- `docker compose -f infra/docker-compose.yml up -d db` deja la DB sana.
- `pnpm dev` levanta web y API; `/api/health` responde `200` con DB conectada.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm build` pasan en local y en CI.
- Un test E2E trivial (carga de `/` y healthcheck) pasa en CI.
- CI verde en `develop`; protecciones activas; plantillas visibles.
- Contrato v0 revisado y congelado; decisión de Vercel registrada.

**Salida:** `pnpm dev` levanta web + API + DB; CI verde; contrato inicial congelado.

---

### Fase 1 — Autenticación y asignaturas

**Ramas:** `feature/auth-api`, `feature/auth-ui`, `feature/subjects-api`, `feature/subjects-ui`.

**Objetivo:** que un usuario pueda crear una cuenta, mantener la sesión de forma segura y organizar sus asignaturas sin poder ver las de otro usuario.

#### 1.1 `feature/auth-api`

**Alcance**

- Tablas `users` y `refresh_tokens` con migración versionada.
  - `users`: `id` (uuid), `email` (único, normalizado), `password_hash`, `display_name`, `timezone` (IANA, por defecto UTC), `created_at`, `updated_at`.
  - `refresh_tokens`: `id`, `user_id`, `token_hash`, `expires_at`, `revoked_at`, `user_agent`, `created_at`. La rotación y detección de reutilización se implementan sobre esta tabla; si se necesita `family_id` o `replaced_by_id`, se añaden en la migración de esta fase.
- Endpoints bajo `/api/v1`:
  - `POST /api/v1/auth/register` → `201`, crea usuario y emite tokens.
  - `POST /api/v1/auth/login` → `200`, emite tokens.
  - `POST /api/v1/auth/refresh` → rota refresh token y emite nuevo par.
  - `POST /api/v1/auth/logout` → revoca el refresh token y limpia la cookie.
  - `GET /api/v1/auth/me` → usuario actual.
- Hash de contraseña con **argon2id** (validar en el spike de Vercel; fallback `scrypt` de Node si el módulo nativo da problemas).
- **Access token JWT** de ~15 minutos devuelto en el body y mantenido en memoria por el cliente.
- **Refresh token opaco** en cookie `httpOnly`, `Secure` en producción, `SameSite=Lax`, `Path=/api/v1/auth`.
- Rotación de refresh con detección de reutilización: si se reutiliza un token revocado, se revoca toda la familia.
- Rate limit en `register`, `login` y `refresh` por IP y por email (p. ej. 5 intentos / 15 min), con respuesta `429` y `Retry-After`.
- Validación Zod compartida; mensajes de error que no revelen si el email existe.
- Tests Supertest: registro, login, refresh, logout, reutilización de refresh, rate limit, cookie flags.

**Criterios de aceptación**

- Contraseñas nunca se registran en logs ni se devuelven.
- Un refresh token no se puede reutilizar sin revocar la familia.
- `GET /api/v1/auth/me` sin token devuelve `401` con envelope de error.
- Tests de integración contra Postgres real (contenedor en CI).

#### 1.2 `feature/auth-ui`

**Alcance**

- Rutas `/login`, `/register`, `/app` (protegida).
- Formularios con React Hook Form + Zod, errores inline accesibles (`aria-describedby`, `aria-invalid`), estados de carga y error.
- `AuthProvider` basado en TanStack Query (`me`), sin guardar tokens en `localStorage`.
- Rutas protegidas con redirección y `returnTo`.
- **Refresh silencioso**: ante un `401`, un único refresh con mutex/cola (evitar tormenta de refresh), reintento de la petición original y logout si falla.
- Interceptor de `fetch` centralizado en `lib/api.ts` con `credentials: 'include'`, `requestId` y manejo de errores.
- Tests con RTL + MSW: login correcto, credenciales inválidas, sesión expirada, redirección.

**Criterios de aceptación**

- Tras recargar, la sesión se mantiene sin parpadeo de contenido protegido.
- No hay tokens accesibles desde `localStorage`.
- Formularios usables solo con teclado y con lector de pantalla.

#### 1.3 `feature/subjects-api`

**Alcance**

- Tabla `subjects`: `id`, `user_id`, `name`, `color_hex`, `target_hours_week`, `archived_at`, `created_at`, `updated_at`.
- Restricción de unicidad por usuario y nombre (normalizado, solo activas).
- Endpoints:
  - `GET /api/v1/subjects` (incluye activas; `?includeArchived=true`).
  - `POST /api/v1/subjects` → `201`.
  - `PATCH /api/v1/subjects/:id` (nombre, color, objetivo).
  - `POST /api/v1/subjects/:id/archive` y `POST /api/v1/subjects/:id/unarchive`.
  - `DELETE /api/v1/subjects/:id` solo si no tiene sesiones; si las tiene, se archiva o se devuelve `409` con sugerencia de archivar.
- Validación de color contra la paleta permitida (`#RRGGBB`).
- Todas las consultas filtran por `user_id`; 404 para recursos ajenos.
- Tests de ownership (usuario A no lee ni modifica recursos de B).

#### 1.4 `feature/subjects-ui`

**Alcance**

- Página de asignaturas: lista, estado vacío, crear, editar, archivar/desarchivar.
- Selector de color accesible (radio group con nombre, no solo color) y vista previa.
- Mutaciones optimistas de TanStack Query con rollback y toast de error.
- Confirmación al archivar y al borrar; foco gestionado en diálogos.
- Tests RTL + MSW y un E2E de flujo completo.

**Criterios de aceptación**

- Crear, editar y archivar se refleja de inmediato y persiste tras recargar.
- No se puede crear una asignatura duplicada activa.
- Usuario A no puede ver datos de B (test de integración + E2E con dos cuentas).

**Salida de fase:** registro → login → crear asignatura → recargar y seguir autenticado; usuario A no puede ver datos de B.

---

### Fase 2 — Sesiones de estudio y dashboard

**Ramas:** `feature/sessions-api`, `feature/stats-api`, `feature/dashboard-ui`.

**Objetivo:** registrar, editar y eliminar sesiones con totales y visualizaciones fiables, sin duplicados ante reintentos.

#### 2.1 `feature/sessions-api`

**Alcance**

- Tabla `study_sessions`: `id`, `user_id`, `subject_id`, `started_at`, `ended_at`, `duration_seconds`, `note`, `source` (`manual` | `pomodoro`), `idempotency_key`, `created_at`, `updated_at`.
  - `duration_seconds` se **calcula en el servidor** (`ended_at - started_at`), se valida `> 0` y un máximo (p. ej. 12 h) para evitar datos absurdos.
  - Índices: `(user_id, started_at DESC)`, `(user_id, subject_id)`, UNIQUE `(user_id, idempotency_key)`.
- **Idempotencia**:
  - `Idempotency-Key` obligatoria en `POST /api/v1/sessions`.
  - Misma key + mismo payload → replay de la respuesta original (`201`).
  - Misma key + payload distinto → `422 IDEMPOTENCY_KEY_REUSED`.
  - La clave se genera al iniciar la creación y se reutiliza en reintentos.
- Endpoints:
  - `GET /api/v1/sessions?from&to&subjectId&page&pageSize`.
  - `POST /api/v1/sessions` (requiere `Idempotency-Key`).
  - `PATCH /api/v1/sessions/:id` (recalcula duración si cambian horas).
  - `DELETE /api/v1/sessions/:id` → `204`.
- Ownership estricto, validación de rangos y de que `subject_id` pertenece al usuario.
- Tests Supertest: solapamientos, fechas invertidas, duración excesiva, reintento idempotente, borrado ajeno, paginación estable.

#### 2.2 `feature/stats-api`

**Alcance**

- `GET /api/v1/stats/summary?range=today|week|month|all&timezone`: `totalSeconds`, `totalHours`, `sessionsCount`, `streakDays`, `bySubject[]`.
- `GET /api/v1/stats/weekly?weeks=12&timezone`: serie de buckets semanales con `weekStart`, `totalSeconds`, `totalHours`.
- Agregaciones en SQL (no en Node) con `date_trunc` en la zona horaria del usuario.
- Consultas paramétricas y tests de límites de rango (máximo 1 año), zona horaria inválida → `422`.
- Sin caché en MVP; medir con `EXPLAIN ANALYZE` y añadir índice si hace falta.

**Contrato:** los esquemas de respuesta se añaden a `packages/shared` antes de empezar la UI (PR de contrato propio).

#### 2.3 `feature/dashboard-ui`

**Alcance**

- Ruta `/app` (dashboard) con:
  - Tarjetas: hoy, esta semana, media diaria, total del periodo.
  - Gráfica semanal con Recharts (barras/área), tooltip accesible y tabla alternativa o resumen textual.
  - Desglose por asignatura (barras horizontales o donut con leyenda y porcentajes).
  - Lista de sesiones con paginación y acciones editar/eliminar.
  - Entrada manual con React Hook Form + Zod (asignatura, inicio, fin, nota), validación de solapamiento solo como aviso.
- **Escrituras optimistas**:
  - Alta/edición/borrado actualizan la caché de TanStack Query de inmediato y hacen rollback con toast si falla.
  - Edición con **debounce de 800–1200 ms**; **flush** en `blur`, `visibilitychange` y `pagehide`.
  - `Idempotency-Key` generada con `crypto.randomUUID()` al iniciar la creación y **reutilizada** en cada reintento.
  - Reconciliación con la respuesta del servidor (duración calculada, `updatedAt`).
- Invalidación selectiva de `stats` tras escrituras; sin refetch agresivo.
- Estados de carga con skeletons, vacío, error con reintento y sin conexión.
- Tests RTL + MSW: optimismo, rollback, debounce, flush, reintento sin duplicado.
- E2E: crear sesión → aparece en lista y totales → editar → eliminar.

**Criterios de aceptación**

- Registrar, editar y eliminar se refleja en totales y gráfica sin recargar.
- Reintentar una creación (misma key) no duplica.
- Cambiar de pestaña o cerrar no pierde la edición pendiente (flush).
- La UI nunca muestra una duración calculada en cliente como verdad final.

**Salida de fase:** registrar/editar/eliminar sesión se refleja en totales y gráfica; reintentar no duplica.

---

### Fase 3 — Pomodoro

**Rama:** `feature/pomodoro`.

**Objetivo:** un temporizador fiable, recuperable y accesible que genere sesiones de estudio exactamente una vez.

**Alcance**

- **Máquina de estados:** `idle → focus → paused → break → completed`.
  - `focus` y `break` con duración configurable (por defecto 25/5 min; descanso largo 15 min tras 4 ciclos como mejora opcional).
  - Transiciones válidas centralizadas en un reducer puro y testado.
- **Cálculo del tiempo restante con `endsAt` y `Date.now()`**, nunca decrementando un contador con `setInterval`. `setInterval` solo dispara repintados.
  - Al pausar se guarda `remainingMs`; al reanudar se recalcula `endsAt = Date.now() + remainingMs`.
- **Persistencia en `localStorage`** por usuario, validada con Zod al hidratar; estado corrupto se descarta sin romper la app.
  - Recuperación al recargar: si `endsAt` ya pasó, se muestra `completed` (no se inventa tiempo).
  - Sincronización entre pestañas con el evento `storage` (opcional, sin duplicar sesiones).
- **Notificaciones:** permiso solicitado solo tras un gesto del usuario; fallback a título del documento y aviso sonoro con WebAudio (sin assets externos); respeto de `prefers-reduced-motion`.
- **Modal accesible:**
  - `role="dialog"`, `aria-modal`, etiqueta y descripción.
  - Focus trap, `Escape` cierra (pausando si está en curso y pidiendo confirmación), restauración del foco al elemento de origen.
  - Controles con nombres accesibles, anuncios `aria-live` para cambios de estado relevantes.
- **Creación de sesión al completar:**
  - Asignatura elegida antes de iniciar; `startedAt` al entrar en `focus` (y ajustado si hubo pausas), `endedAt` al completar.
  - `source: 'pomodoro'`, nota opcional.
  - `Idempotency-Key` generada al iniciar el ciclo y persistida en el estado antes del `POST`; reintentos usan la misma key.
  - Guardia contra doble finalización (flag `sessionCreated` + key persistida).
- Tests: reducer, cálculo con reloj falso (`vi.useFakeTimers` + `Date.now`), hidratación corrupta, recuperación tras recarga, finalización única, accesibilidad del modal.

**Criterios de aceptación**

- El temporizador sobrevive navegación entre rutas y recarga de la página.
- Al completar, se crea **exactamente una** sesión aunque haya reintentos o doble clic.
- El modal es operable solo con teclado y devuelve el foco al cerrarse.
- Cambiar el reloj del sistema no genera duraciones negativas ni sesiones fantasma.

**Salida de fase:** el temporizador sobrevive navegación y recarga; completa una sesión exactamente una vez.

---

### Fase 4 — Landing y pulido

**Ramas:** `feature/landing`, `feature/a11y-polish`.

**Objetivo:** una landing pública profesional, con copy propio, UI real del producto y calidad de accesibilidad, sin datos inventados.

#### 4.1 `feature/landing`

**Proceso**

1. **Plan de diseño con `@frontend-design`**: dirección visual, tipografía, escala, color, ritmo y principios de movimiento.
2. **Copy primero**: texto en un documento revisable antes de maquetar. Voz propia, frases cortas, sin superlativos vacíos.
3. **Secciones** (en este orden):
   - **Hero** con captura real del dashboard (datos demo claramente marcados).
   - **Problema**: la dificultad de medir el esfuerzo real.
   - **Tour del producto**: dashboard, sesiones, pomodoro.
   - **Cómo funciona en 3 pasos**: crea asignaturas → registra sesiones → revisa tu progreso.
   - **Rachas y leaderboard como evolución** (no como función disponible): explicadas como “próximamente”, sin simular funcionalidad.
   - **CTA final + footer** (registro, login, privacidad, contacto).
4. **Motion** discreto y con propósito; `prefers-reduced-motion` respetado; sin animaciones que bloqueen la lectura.
5. **Responsive** mobile-first con revisión en 390, 768, 1024 y 1440 px.
6. **SEO/OG**: `<title>`, meta description, canonical, `robots.txt`, `sitemap.xml`, Open Graph y Twitter Card con imagen propia.
7. **Sin placeholders**: nada de “Lorem ipsum”, logos de clientes, testimonios, métricas de usuarios ni cifras inventadas. Los datos de demo llevan una etiqueta visible (“Datos de demostración”).
8. **ReactBits (si se usa):** auditoría humana previa (licencia, seguridad, dependencias, peso), copia vendorizada en el repo, `React.lazy` + `Suspense`, fallback estático y test de que la landing funciona sin el chunk.

**Gate de diseño (`design-taste-frontend`)**

Ejecutar hasta **GATE PASS**:

| Comprobación | Criterio |
|---|---|
| `copy-lint` | Sin clichés, sin promesas no verificables, sin cifras inventadas |
| `consistency` | Un solo sistema visual: tipografía, espaciado, radios, color |
| `check` | Layout, responsive, foco, contraste, jerarquía |
| `perf` | Sin bloqueos, imágenes optimizadas, LCP razonable, JS contenido |

Si alguna comprobación queda **OPEN**, se documenta la justificación, el impacto y el responsable en el PR. No se acepta un OPEN por comodidad.

**Revisión adicional:** `@web-design-guidelines` sobre la landing y las pantallas del producto.

#### 4.2 `feature/a11y-polish`

**Alcance**

- Auditoría de teclado en todos los flujos (login, asignaturas, dashboard, pomodoro, landing).
- Contraste AA, foco visible, landmarks, jerarquía de encabezados, formularios etiquetados.
- `aria-live` para totales y estados de guardado; anuncios sin ruido.
- Revisión con `prefers-reduced-motion`, zoom 200 % y lector de pantalla (al menos uno).
- Corrección de hallazgos de `@web-design-guidelines`.

**Criterios de aceptación**

- Landing completa en producción preview, CTA funcional a `/register`.
- Cero placeholders y cero datos ficticios presentados como reales.
- GATE PASS (o OPEN justificado) y auditoría de guidelines sin bloqueantes.
- Preview de Vercel funcionando con API y DB de preview.

**Salida de fase:** landing profesional, sin placeholders, CTA a registro y preview funcionando.

---

### Fase 5 — Social y escalado (post-MVP)

**Ramas:** `feature/streaks`, `feature/friends-api`, `feature/leaderboard-api`, `feature/leaderboard-ui`, `feature/badges`.

> No se inicia hasta cerrar la Fase 4 y validar el MVP con usuarios. Cada rama puede paralelizarse tras congelar el contrato social.

#### 5.1 `feature/streaks`

- Racha **timezone-aware**: se calcula en la zona IANA del usuario, no en UTC.
- Regla documentada y testeada: un día cuenta si tiene al menos una sesión completada y la suma del día alcanza el umbral configurado (propuesta: **≥ 15 minutos**). El umbral se define en `packages/shared`.
- DST: calcular fechas locales con una librería probada (`date-fns-tz` o `Luxon`), nunca sumando 24 h a un timestamp. Tests con `Europe/Madrid` y `America/New_York` en cambios de hora.
- Persistencia: si se materializa, `user_streaks` (racha actual, máxima, último día computado) recalculada al escribir o por cron diario; la lectura nunca recalcula todo el histórico.
- UI: indicador de racha en dashboard con explicación de la regla.

#### 5.2 `feature/friends-api`

- Modelo social según `database-spec.md`: como mínimo `friendships` con estado (`pending`, `accepted`, `blocked`) y unicidad del par. Si el contrato social lo requiere, se separan `friend_requests`, `friendships` y `blocks` en la migración de esta fase.
- Endpoints: enviar solicitud, aceptar, rechazar, cancelar, listar amigos, bloquear/desbloquear.
- Reglas: no autosolicitud, no duplicados, bloqueo impide solicitudes y visibilidad, aceptar crea amistad simétrica de forma transaccional.
- **Privacidad:** `users.leaderboard_visibility` (`public` | `friends` | `private`); por defecto `friends`.
- Tests de autorización: un usuario no puede aceptar solicitudes ajenas ni ver amistades de otro.

#### 5.3 `feature/leaderboard-api`

- Agregado semanal con **ventana UTC fija**: lunes 00:00:00 UTC a domingo 23:59:59 UTC (semana ISO). La ventana se documenta y se testea en el cambio de año.
- Rankings: **amigos** y **global** (global solo si el usuario es `public`).
- Estrategia de rendimiento:
  - Vista materializada `leaderboard_weekly` o tabla de agregados, refrescada por cron.
  - Caché opcional Redis/Upstash con **TTL 30–60 s** e **invalidación al escribir** una sesión.
  - Consulta siempre limitada (top 50) + posición del usuario actual.
- Respuesta estable con `weekStart`, `weekEnd`, `generatedAt` y `stale` para que la UI pueda indicar desfase.
- Tests de privacidad, bloqueos, desempate determinista (segundos, luego `user_id`) y rendimiento con datos sembrados.

#### 5.4 `feature/leaderboard-ui`

- Ranking semanal con posición, nombre, tiempo y emblema; filtro amigos/global.
- Resaltado del usuario actual y su posición si está fuera del top.
- Perfil público mínimo (nombre, racha, total semanal) respetando privacidad.
- Estados de carga, vacío y error; sin filtrar datos de usuarios privados.

#### 5.5 `feature/badges`

- Tablas `badges` (catálogo y criterio) y `user_badges` con unicidad `(user_id, badge_id)` para **concesión idempotente**.
- Criterios declarativos (p. ej. primera sesión, 7 días seguidos, 10 h en una semana) evaluados en el servidor.
- Concesión en la ruta de escritura si es barata, o por cron para retroactivos; nunca desde el cliente.
- UI: emblemas en perfil y notificación discreta al obtener uno.

**Salida de fase:** amistades, ranking semanal y emblemas sin fugas de datos.

---

### Fase 6 — Producción

**Rama:** `release/v1.0.0` (desde `develop`; merge a `main` y back-merge a `develop`).

**Objetivo:** endurecer seguridad, observabilidad y operación; probar recuperación; publicar v1.0.0.

#### 6.1 Seguridad

- **Headers** con Helmet: `HSTS`, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`/`frame-ancestors`, `Permissions-Policy`.
- **CSP** estricta para la SPA: `default-src 'self'`; `script-src 'self'`; `style-src 'self'` (Tailwind compilado); `img-src 'self' data:`; `connect-src 'self'` (+ Sentry si aplica). Sin `unsafe-inline` salvo justificación documentada.
- **CORS**: mismo origen en el plan A (sin CORS); si se separan web y API, allowlist exacta, `credentials: true` y sin comodines.
- **CSRF**: `SameSite=Lax`, validación de `Origin`/`Referer` en mutaciones y, si hay dominios cruzados, double-submit token.
- **Rate limits** en auth, escrituras y endpoints de agregados; documentar que el límite en memoria es por instancia y evaluar Upstash/DB para auth.
- **Auditoría de dependencias**: `pnpm audit`, Dependabot, lockfile revisado; política de parcheo.
- Revisión de secretos en historial y configuración de entornos.

#### 6.2 Observabilidad

- **Logs estructurados** (p. ej. Pino) con `requestId`, `userId` (sin PII sensible), ruta, estado, duración y errores.
- **Sentry** en web y API, con source maps y `release` etiquetado; sin capturar datos personales.
- **Uptime** externo sobre `/api/health` y la landing.
- **Métricas de DB**: conexiones, latencia, consultas lentas, uso de índices (`pg_stat_statements` en el proveedor).
- Alertas mínimas: errores 5xx, latencia p95, fallo de healthcheck, agotamiento de conexiones.

#### 6.3 Base de datos

- Migraciones generadas y revisadas; aplicación en CI/CD con conexión **directa** (no pooled) y **nunca al arrancar la función**.
- Estrategia **expand/contract** para cambios incompatibles; backup antes de migraciones destructivas.
- **Backups** automáticos y **restore probado** en una base de staging con verificación de integridad.
- `EXPLAIN ANALYZE` de la consulta de leaderboard y de las estadísticas; índices confirmados; plan documentado.
- Limpieza de `refresh_tokens` caducados por cron; si se adopta una tabla de idempotencia dedicada, limpiar sus claves antiguas.

#### 6.4 Vercel

- Variables por entorno (Development, Preview, Production); secretos solo en Vercel.
- Preview por PR con base de datos de preview (branch de Neon o schema dedicado) y migraciones aplicadas.
- Dominio propio, HTTPS, redirecciones canónicas.
- **Vercel Cron** para limpieza y agregados; si la granularidad de Hobby no alcanza, **QStash**.
- Revisión de términos del plan **Hobby (no comercial)** antes de cualquier monetización.

#### 6.5 SEO, analytics y operación

- SEO: metadatos, sitemap, robots, datos estructurados coherentes y sin promesas falsas.
- Analytics respetuoso con la privacidad (Plausible/Umami o Vercel Analytics), consentimiento si aplica, sin PII.
- **Runbook de rollback**: promover el deployment anterior en Vercel, rollback de migración (expand/contract), invalidación de caché, verificación de healthcheck y comunicación.
- Release notes, tag `v1.0.0`, merge a `main` y back-merge a `develop`.

**Salida de fase:** checklist de producción completo, backups restaurados con éxito, runbook probado y `v1.0.0` desplegada.
