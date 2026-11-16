# Especificación de frontend — StudyLogV2

## 1. Stack

- React 19 + Vite + TypeScript.
- React Router 7 en **library mode** (`createBrowserRouter`).
- Tailwind CSS v4 con configuración CSS-first (`@import "tailwindcss"` y `@theme`).
- TanStack Query para estado de servidor.
- React Hook Form + Zod para formularios.
- Recharts para gráficas.
- ReactBits solo tras auditoría humana, vendorizado y con lazy load.
- Vitest + React Testing Library + MSW + Playwright.

## 2. Estructura de `apps/web`

```text
apps/web/
├─ src/
│  ├─ app/
│  │  ├─ router.tsx              árbol de rutas
│  │  ├─ providers.tsx           solo QueryClientProvider
│  │  ├─ AuthSessionProvider.tsx monta AuthProvider bajo demanda
│  │  ├─ AppShell.tsx            layout público (landing, 404)
│  │  ├─ AuthLayout.tsx          layout de /login y /register
│  │  └─ AppLayout.tsx           layout autenticado (/app)
│  ├─ pages/
│  │  ├─ LandingPage.tsx
│  │  ├─ LoginPage.tsx
│  │  ├─ RegisterPage.tsx
│  │  ├─ DashboardPage.tsx
│  │  ├─ SubjectsPage.tsx
│  │  ├─ HistoryPage.tsx
│  │  ├─ LeaderboardPage.tsx
│  │  └─ SettingsPage.tsx
│  ├─ features/
│  │  ├─ auth/                   api, sesión, guardas, esquemas y errores
│  │  ├─ subjects/
│  │  ├─ sessions/
│  │  ├─ stats/
│  │  ├─ pomodoro/
│  │  ├─ leaderboard/
│  │  └─ badges/
│  ├─ components/
│  │  ├─ ui/                     Button, TextField, SelectField, Alert, loader
│  │  ├─ charts/
│  │  └─ vendor/reactbits/
│  ├─ lib/
│  │  ├─ api.ts                  interceptor de fetch y refresh único
│  │  ├─ auth-store.ts           access token en memoria
│  │  ├─ queryClient.ts
│  │  ├─ use-document-title.ts
│  │  └─ dates.ts
│  ├─ mocks/                     backend MSW con estado (tests)
│  ├─ test/                      setup y helper renderApp
│  ├─ styles/
│  └─ main.tsx
├─ public/
└─ vite.config.ts
```

## 3. Rutas

| Ruta               | Página      | Acceso                                   |
| ------------------ | ----------- | ---------------------------------------- |
| `/`                | Landing     | Público                                  |
| `/login`           | Login       | Público; redirige a `/app` si hay sesión |
| `/register`        | Registro    | Público; redirige a `/app` si hay sesión |
| `/app`             | Dashboard   | Protegido                                |
| `/app/subjects`    | Asignaturas | Protegido                                |
| `/app/history`     | Historial   | Protegido                                |
| `/app/leaderboard` | Leaderboard | Protegido (post-MVP)                     |
| `/app/settings`    | Ajustes     | Protegido                                |

Reglas:

- Rutas protegidas redirigen a `/login?returnTo=...`.
- Tras login, volver a `returnTo` si es una ruta interna segura.
- `returnTo` solo se acepta si resuelve al **mismo origen** y su ruta es `/app` o empieza por `/app/`; se conservan query y hash. Cualquier otro valor (`https://…`, `//…`, `/login`, `/app/../login`) cae a `/app`. Sin esta validación sería un open redirect.
- Página 404 clara.

## 4. Estado

### 4.1 Estado de servidor

TanStack Query es la fuente para datos remotos:

- `staleTime` corto en datos personales.
- Invalidación tras mutaciones.
- `retry` limitado; no reintentar 401/403/404/422/429.
- Query keys centralizadas.

Ejemplo de claves:

```ts
['auth', 'me'][('subjects', { includeArchived })][
  ('sessions', { from, to, subjectId, page, pageSize })
][('stats', 'summary', { range, timezone })][('stats', 'weekly', { weeks, timezone })][
  ('leaderboard', 'weekly', { scope, page })
]['badges'];
```

### 4.2 Estado de UI

- React state local para modales, filtros y formularios.
- `useReducer` o máquina de estados para el Pomodoro.
- No duplicar en estado global lo que ya vive en React Query.
- Evitar contextos gigantes; como máximo auth, tema y toasts.

## 5. Autenticación en cliente

- Access token en memoria (no `localStorage`).
- Refresh cookie gestionada por el navegador.
- **Orden de arranque: refresh primero.** Tras recargar, el access token en memoria ya no existe, así que pedir `GET /auth/me` primero garantizaría un `401` en cada carga. El bootstrap es: si no hay token → `POST /auth/refresh`; si responde con token → `GET /auth/me`; si responde `401` → anónimo (una sola petición).
- **Bootstrap bajo demanda**: `AuthProvider` se monta solo en `/login`, `/register` y `/app`. La landing no lo necesita, y cada visita anónima a una ruta con sesión gastaría cupo del rate limit de refresh.
- Interceptor de API: en `401`, refrescar y reintentar una sola vez. Un único refresh compartido para todas las peticiones que fallan a la vez (sin tormenta, sin carreras de rotación).
- Rutas exentas de refresh: `login`, `register`, `refresh` y `logout`. En ellas un `401` es la respuesta real.
- `429` en el refresh: la sesión **no** se cierra y no se redirige. La pantalla muestra un aviso con reintento; cerrar sesión por un límite temporal expulsaría a usuarios legítimos.
- Logout limpia queries y redirige a `/`.
- No mostrar contenido protegido mientras se resuelve la sesión; usar skeleton o pantalla de carga.

Estados que expone `AuthProvider`:

| Estado          | Significado                          | Efecto en la UI                                                                                                                                          |
| --------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `loading`       | Se está comprobando la sesión        | `/app`: pantalla de carga, nunca contenido protegido. `/login` y `/register`: el formulario se muestra ya y solo se redirige si la sesión resulta válida |
| `authenticated` | Hay usuario                          | Renderiza la ruta (o `/app` desde login/registro)                                                                                                        |
| `anonymous`     | El refresh devolvió `401`            | `/app` → `/login?returnTo=…`; login y registro se muestran                                                                                               |
| `unavailable`   | No se pudo comprobar (429, 5xx, red) | `/app`: aviso con reintento, **no** se cierra sesión. `/login` y `/register`: se muestra el formulario                                                   |

## 6. Data fetching y mutaciones

### 6.1 Lecturas

- `useQuery` con `enabled` según sesión y filtros.
- Evitar `useEffect` para fetching.
- Cancelar queries al desmontar si aplica.

### 6.2 Escrituras

- `useMutation` con actualización optimista en sesiones.
- Rollback en error.
- Invalidar:
  - `['sessions', ...]`
  - `['stats', ...]`
  - `['leaderboard', ...]` si aplica.
- Debounce de 800–1200 ms para edición de sesiones manuales.
- Flush en `blur`, `visibilitychange` y `pagehide`.
- `Idempotency-Key` en creaciones.

### 6.3 Creación desde Pomodoro

- Generar clave idempotente al iniciar el guardado.
- Reutilizarla en reintentos.
- No crear dos sesiones si el usuario pulsa dos veces.

## 7. Formularios

- React Hook Form + resolver Zod compartido.
- Labels visibles y `autocomplete` correcto:
  - `email`
  - `current-password`
  - `new-password`
- Errores inline y resumen accesible.
- Deshabilitar submit mientras se envía.
- Mapear errores de API a campos cuando sea posible.
- No borrar los datos del formulario ante un error de red.

## 8. Manejo de errores y estados

Cada vista debe cubrir:

- Carga: skeleton o spinner.
- Vacío: invitación a la acción.
- Error: mensaje claro + reintento.
- Sin permisos: redirección o mensaje.
- Offline: aviso y reintento cuando vuelva la conexión.

No usar toasts para errores que deben quedarse visibles en el formulario.

## 9. Gráficas

- Recharts con `ResponsiveContainer`.
- Lazy load del bundle de gráficas.
- Alternativa accesible: tabla o resumen textual.
- Tooltips legibles y con contraste.
- Colores de asignatura consistentes con la UI.
- Evitar gráficas decorativas sin datos reales.

## 10. Rendimiento

- Code splitting por ruta.
- Lazy load de Recharts, ReactBits pesados y modales.
- Optimización de fuentes (subsets, `font-display: swap`).
- Evitar re-renders innecesarios en listas grandes.
- Virtualizar historial si supera un umbral.
- Presupuesto orientativo: LCP < 2.5 s, CLS < 0.1, INP < 200 ms en móvil razonable.

## 11. Convenciones

- TypeScript estricto; evitar `any`.
- Componentes funcionales y hooks.
- Nombres de archivos en PascalCase para componentes, camelCase para utilidades.
- Un componente por archivo cuando sea razonable.
- No importar desde `apps/api`.
- Compartir tipos y schemas desde `packages/shared`.
- Tests junto al componente o en `__tests__`.

## 12. Configuración local

- Vite proxy `/api` → `http://localhost:3001` en desarrollo.
- Variables públicas con prefijo `VITE_` solo si no son secretas.
- No exponer secretos en el bundle.

## 13. Testing desde frontend

- Vitest + RTL para componentes y hooks.
- MSW para simular API.
- Playwright para flujos críticos.
- Comandos:

```bash
pnpm --filter web test
pnpm --filter web test -- src/features/pomodoro/Timer.test.tsx
pnpm test:e2e -- e2e/auth.spec.ts
```
