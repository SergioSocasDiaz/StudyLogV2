# Fase 1.2 — Autenticación en el frontend

> Documento explicativo de lo implementado en la rama `feature/auth-ui`.
> Fecha: 16 de noviembre de 2026.
> Especificaciones de referencia: `docs/frontend-spec.md` §§3–8, `docs/api-spec.md` §2, `docs/security-spec.md` §§3–5, `docs/plan.md` §1.2, `docs/contract-v0.md` §8.
> Antecedente: `docs/logs/FASE-1-AUTH.md` (la API que esta fase consume).

Este documento cuenta **qué se ha construido, por qué así y cómo comprobarlo**, sin dar por sabido ningún concepto. Si solo lees una sección, lee la 3 (conceptos) y la 6 (escenarios).

---

## 1. Resumen en una frase

Ya se puede **crear una cuenta, entrar, usar `/app` y salir** desde el navegador, y la sesión **sobrevive a una recarga** sin guardar ningún token en `localStorage`: el access token vive en memoria y se recupera con la cookie `httpOnly` que puso la API en la fase 1.1.

---

## 2. Qué se ha añadido al proyecto

| Zona        | Qué                                                                                                                                                                                                 |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rutas       | `/login`, `/register` y `/app` (protegida), con guardas `RequireAuth` y `RedirectIfAuthenticated`                                                                                                   |
| Red         | `lib/api.ts` reescrito: interceptor de `fetch`, `x-request-id`, `credentials: include`, `ApiRequestError` con `status`/`code`/`details`/`retryAfterSeconds`, refresh único y reintento una sola vez |
| Sesión      | `lib/auth-store.ts` (token en memoria), `features/auth/session.ts` (bootstrap refresh-first), `AuthProvider` sobre TanStack Query                                                                   |
| Formularios | React Hook Form + Zod, errores inline accesibles, mostrar/ocultar contraseña, zona horaria detectada y editable                                                                                     |
| UI          | `AuthLayout` (panel de dos columnas), `AppLayout`, `SessionUnavailable`, primitivas `Button`, `TextField`, `SelectField`, `Alert`, `FullPageLoader`                                                 |
| Contrato    | `validationErrorDetailsSchema` y `parseValidationErrorDetails` en `packages/shared` (PR #4) para mapear un `422` a campos concretos                                                                 |
| Tests       | 59 tests web (Vitest + RTL + MSW), 5 tests E2E y 15 tests en `@studylog/shared` (incluyendo suite independiente de accesibilidad de teclado, mapeo 422 y garantía de 0 tokens en Web Storage)       |
| Docs        | `frontend-spec.md` §§2–5 actualizada; `contract-v0.md` §8 con el cambio aditivo                                                                                                                     |

---

## 3. Conceptos clave (explicados desde cero)

### 3.1 El access token vive en memoria, nunca en `localStorage`

Un access token es un JWT de 15 minutos. La tentación es guardarlo en `localStorage` para que sobreviva a la recarga. El problema: **cualquier JavaScript del origen puede leer `localStorage`**, así que un solo XSS (un comentario mal escapado, una dependencia comprometida) se lleva el token. Con la sesión, el atacante se lleva todo.

Nuestra solución:

```ts
// apps/web/src/lib/auth-store.ts
let accessToken: string | null = null;
```

- Es una **variable de módulo**: sobrevive a la navegación dentro de la SPA, no a una recarga.
- `document.cookie` no la ve, `localStorage` no la ve: un XSS no tiene nada que robar.
- Tras recargar se pierde… y se recupera con el refresh token, que sí es duradero porque está en una cookie `httpOnly` que **el servidor pone y el navegador envía sola**.

El token vive fuera de React porque el interceptor de `fetch` no es un componente. React se entera de los cambios por dos vías: TanStack Query (caché `['auth','me']`) y el evento `auth:expired` de `window`.

### 3.2 El interceptor: una sola puerta para todas las peticiones

Todas las llamadas pasan por `apiFetch<T>(path, init?, options?)`:

1. Añade `Accept`, `x-request-id` (un UUID por petición) y `Content-Type` si hay cuerpo.
2. Añade `Authorization: Bearer <token>` si hay token en memoria y `options.auth !== false`.
3. `credentials: 'include'` para que la cookie `httpOnly` viaje también en el refresh y el logout.
4. Si la respuesta es `401` y la ruta no está exenta: pide un refresh, **reintenta la petición original una sola vez** reutilizando el mismo `x-request-id` (así el log del servidor tiene una sola correlación para el par original+reintento).
5. Cualquier `!response.ok` se convierte en `ApiRequestError` con `status`, `code`, `message`, `details`, `requestId` y `retryAfterSeconds`.
6. Un fallo de red (`fetch` rechaza) se convierte en `ApiRequestError` con `status: 0` y `code: 'NETWORK_ERROR'`, para que la UI tenga un único tipo que interpretar.

**Rutas exentas de refresh**: `/auth/login`, `/auth/register`, `/auth/refresh` y `/auth/logout`. En ellas un `401` no significa "token caducado", significa "estas credenciales no valen" o "esta sesión está muerta": reintentar ocultaría el error real o entraría en bucle.

### 3.3 `single-flight`: cinco `401` a la vez producen **un** refresh

Si `/app` lanza tres consultas a la vez con el token caducado, las tres reciben `401`. Si cada una refresca, el servidor ve tres `POST /auth/refresh` con la misma cookie: rota el token en el primero y los otros dos llegan con un token ya revocado (el servidor tiene una ventana de gracia de 10 s para el caso multi-pestaña, pero no hay razón para provocarlo).

La solución es de tres líneas y no necesita librería:

```ts
let refreshPromise: Promise<string | null> | null = null;

export function refreshAccessToken(): Promise<string | null> {
  refreshPromise ??= performRefresh().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}
```

La primera llamada crea la promesa; las demás **esperan la misma**. Cuando termina, el hueco se vacía para el siguiente ciclo. Esto se prueba explícitamente: cinco peticiones simultáneas ⇒ `refreshCalls === 1`.

### 3.4 Bootstrap: refresh primero, luego `/me`

Al recargar, el token en memoria no existe. La secuencia ingenua sería `GET /auth/me` → `401` → refresh → reintento: **dos** peticiones y un error garantizado en cada carga.

El orden implementado en `features/auth/session.ts` es al revés:

```text
¿hay token en memoria?
├─ sí  → GET /auth/me
└─ no  → POST /auth/refresh
         ├─ 200 → guardar token → GET /auth/me
         └─ 401 → null (anónimo, una sola petición)
```

Resultado: un visitante anónimo cuesta **una** petición (que además es la que el servidor espera), y un usuario con sesión cuesta dos.

### 3.5 `AuthProvider` se monta solo donde hace falta

`Providers` solo envuelve con el `QueryClientProvider`. El proveedor de sesión es un componente de ruta, `AuthSessionProvider`, colocado por encima de `/login`, `/register` y `/app` — **no** por encima de la landing.

Por qué: `POST /auth/refresh` comparte el límite de **5 intentos / 15 min por IP** con login y registro. Montar la sesión en la landing haría que cada visitante anónimo gastara cupo sin necesidad. Un usuario que solo mira la portada no debe consumir intentos de autenticación.

### 3.6 Un `429` no es un logout

El refresh puede fallar por límite de peticiones (`429`) o por un 5xx. En esos casos **no sabemos** si la sesión es válida. Cerrarla sería mentir: expulsaríamos a un usuario legítimo por un problema temporal.

Por eso el estado no es un booleano "logueado sí/no", sino cuatro valores:

| Estado          | Cuándo                     | Consecuencia                                                                      |
| --------------- | -------------------------- | --------------------------------------------------------------------------------- |
| `loading`       | Bootstrap en curso         | `/app` muestra loader; nunca contenido protegido                                  |
| `authenticated` | Hay usuario                | Se renderiza la ruta                                                              |
| `anonymous`     | El refresh respondió `401` | `/app` → `/login?returnTo=…`                                                      |
| `unavailable`   | `429`, 5xx, red            | `/app` muestra `SessionUnavailable` con botón **Reintentar**; no se cierra sesión |

Solo cuando el refresh devuelve un token nuevo se escribe en `auth-store`; solo cuando devuelve `401` se borra y se emite `auth:expired`.

### 3.7 `returnTo` y el _open redirect_

Cuando alguien entra en `/app` sin sesión, la guarda redirige a:

```text
/login?returnTo=%2Fapp%3Ftab%3D1
```

y tras el login se vuelve ahí. Pero `returnTo` viene de la URL, así que es **entrada del usuario**: si se usara a ciegas, un enlace como

```text
/login?returnTo=https://sitio-falso.example
```

haría que, justo después de escribir la contraseña, la persona acabara en una web que imita a StudyLog. Eso es un _open redirect_.

`safeReturnTo` solo acepta lo que cumple **todas** estas condiciones:

1. Resuelve contra el mismo origen (`new URL(valor, origin).origin === origin`).
2. Su ruta es exactamente `/app` o empieza por `/app/`.

Se conservan `search` y `hash`; cualquier otra cosa (`https://…`, `//…`, `'app'` sin barra, `/login`, `/app/../login`, `/appx`) cae a `/app`. Los casos están cubiertos por test con `origin` fijo para no depender del entorno.

### 3.8 Zod en los dos lados: por qué hay dos copias

El contrato (`packages/shared`) valida en el servidor. El formulario valida otra vez en el cliente con `features/auth/form-schemas.ts`, que **replica las reglas** (mismo `trim`, mismo `toLowerCase`, mismos 12–128 caracteres) pero con **mensajes en español**.

- La copia del cliente es **UX**: feedback inmediato sin viaje de red.
- La copia del servidor es **seguridad**: nadie puede saltarse el formulario con curl.

No se comparte el mensaje porque Zod devuelve el mensaje del servidor en inglés, y el usuario lee español. Lo que sí se comparte es el **tipo** de los valores y la forma de los errores.

### 3.9 De un `422` a un campo concreto

Cuando el servidor responde `422 VALIDATION_ERROR`, el `details` es el resultado de `ZodError.flatten()`:

```json
{ "formErrors": [], "fieldErrors": { "password": ["Too short"] } }
```

Ese campo era `unknown` en el contrato. La web necesitaba recorrerlo para poner cada mensaje bajo su input, así que se añadió al contrato:

- `validationErrorDetailsSchema` — describe la forma.
- `parseValidationErrorDetails(details)` — valida y devuelve `null` si el `details` pertenece a otro error (un `429` trae `{ retryAfterSeconds }`).

`mapApiError` convierte cualquier error en `{ root, fields }`:

| Entrada                   | Qué muestra la UI                                           |
| ------------------------- | ----------------------------------------------------------- |
| `422` con `fieldErrors`   | Cada mensaje bajo su campo; el resto (si queda) como alerta |
| `401 INVALID_CREDENTIALS` | Alerta "Email o contraseña incorrectos."                    |
| `409 CONFLICT`            | Alerta genérica: no se revela si el email existe            |
| `429 RATE_LIMITED`        | "Demasiados intentos. Inténtalo de nuevo en N segundos."    |
| `403 FORBIDDEN`           | Origen no permitido (CSRF)                                  |
| `NETWORK_ERROR`           | "No pudimos conectar con el servidor."                      |
| Otro                      | Mensaje genérico                                            |

Si hay un error de campo, el foco se mueve al primero: quien navega con teclado no tiene que buscarlo.

### 3.10 Accesibilidad de los formularios

Cada campo tiene un `label` visible enlazado por `htmlFor`, y cuando hay error:

- `aria-invalid="true"` para que el lector anuncie el estado.
- `aria-describedby` apuntando al `id` del párrafo de error **y** al de la ayuda (si existe), para que se lean juntos.

Los errores de formulario usan `role="alert"` (se anuncian al aparecer) y los avisos informativos `role="status"` (no interrumpen). El botón de envío lleva `aria-busy` y un spinner `aria-hidden`, así que su nombre accesible no cambia mientras carga. Los tres layouts tienen _skip link_ a `#contenido`.

### 3.11 MSW con estado, no mocks de módulos

Los tests no sustituyen `api.ts` por un doble: **interceptan `fetch`** con MSW y un pequeño backend en memoria (`src/mocks/auth-state.ts`). Así se ejercita el código real del interceptor: cabeceras, refresh, reintento, `ApiRequestError`.

Como jsdom no tiene tarro de cookies, la cookie de refresh se modela como `authMockState.sessionUserId`. El handler de `/auth/me` solo acepta tokens que estén en `validTokens`, y `/auth/refresh` rota el token igual que el servidor. Eso permite reproducir lo interesante: **token caducado con sesión viva** (`expireMockAccessTokens`), que es justo el caso que dispara el refresh.

---

## 4. Rutas y guardas

```text
/                       AppShell (público)          LandingPage
  *                     AppShell                    NotFoundPage

AuthSessionProvider                                  ← monta AuthProvider aquí
  AuthLayout
    RedirectIfAuthenticated
      login             LoginPage
      register          RegisterPage

  RequireAuth                                        ← bloquea /app
    AppLayout
      app (index)       DashboardPage
```

| Guarda                    | Mientras `loading`          | Si `anonymous`                                        | Si `unavailable`                   | Si `authenticated`                    |
| ------------------------- | --------------------------- | ----------------------------------------------------- | ---------------------------------- | ------------------------------------- |
| `RequireAuth`             | loader a pantalla completa  | `Navigate` a `/login?returnTo=…` (+ `reason=expired`) | `SessionUnavailable` con reintento | renderiza `/app`                      |
| `RedirectIfAuthenticated` | **renderiza el formulario** | renderiza el formulario                               | renderiza el formulario            | `Navigate` a `safeReturnTo(returnTo)` |

La asimetría es deliberada. En `/app` no se puede enseñar nada hasta saber si hay sesión (sería contenido protegido). En `/login` el formulario **es** el contenido útil, y esconderlo tras un spinner castiga al caso mayoritario; si la sesión resulta válida, la redirección llega un instante después sin haber mostrado nada privado.

La expiración en caliente (el usuario estaba dentro y el refresh murió) emite `auth:expired`; `AuthProvider` marca `sessionExpired`, borra la caché y `RequireAuth` añade `reason=expired`, con lo que `/login` muestra _"Tu sesión ha caducado. Vuelve a entrar."_ en lugar de un redirect mudo.

---

## 5. Mapa de archivos

```text
apps/web/src/
  lib/
    auth-store.ts            get/set del access token en memoria
    api.ts                   apiFetch, ApiRequestError, refresh único, auth:expired
    queryClient.ts           QueryClient; no reintenta 401/403/404/422/429
    use-document-title.ts    título por página
  features/auth/
    api.ts                   fetchCurrentUser, loginRequest, registerRequest, logoutRequest
    session.ts               bootstrapSession (refresh primero)
    auth-context.ts          tipos + useAuth
    AuthProvider.tsx         useQuery(['auth','me']), signIn/signUp/signOut/retry
    guards.tsx               RequireAuth, RedirectIfAuthenticated
    return-to.ts             safeReturnTo (anti open redirect)
    form-schemas.ts          esquemas Zod de los formularios
    form-errors.ts           mapApiError (422 → campos)
    timezones.ts             lista curada + zona detectada
  app/
    router.tsx               árbol de rutas
    providers.tsx            QueryClientProvider
    AuthSessionProvider.tsx  monta AuthProvider bajo demanda
    AppShell.tsx             layout público
    AuthLayout.tsx           panel tipográfico "semana de estudio"
    AppLayout.tsx            cabecera con usuario y "Cerrar sesión"
  components/
    ui/{Button,TextField,SelectField,Alert,FullPageLoader,cn}.tsx
    SessionUnavailable.tsx   aviso + reintento cuando no se pudo comprobar
  pages/
    LoginPage.tsx, RegisterPage.tsx, DashboardPage.tsx
  mocks/
    auth-state.ts            backend en memoria (usuarios, sesión, tokens)
    handlers.ts              handlers MSW del contrato de auth
  test/
    setup.ts                 MSW + resets entre tests
    render-app.tsx           renderApp(path) con el árbol real de rutas
packages/shared/src/schemas/
  api-error.ts               validationErrorDetailsSchema, parseValidationErrorDetails
e2e/
  auth.spec.ts               registro → recarga → logout → login; credenciales malas
```

**Regla respetada:** `apps/web` no importa de `apps/api`; ambos importan `@studylog/shared`. En Vite, el alias resuelve el paquete **desde el código fuente**, así que dev y tests no dependen de haber compilado `packages/shared` antes.

---

## 6. Qué pasa en cada escenario

| Escenario                                  | Comportamiento                                                                                     |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Visito `/` sin sesión                      | Ninguna petición de sesión (la landing no monta `AuthProvider`)                                    |
| Visito `/app` sin cookie                   | `POST /auth/refresh` → `401` → `/login?returnTo=%2Fapp`                                            |
| Entro con credenciales correctas           | `200`, token a memoria, caché sembrada con el usuario devuelto (sin `GET /me` extra), `/app`       |
| Recargo `/app` con sesión                  | `refresh` → `200` → `GET /me` → usuario; nunca parpadea el contenido protegido                     |
| Mi access token caduca mientras navego     | El `401` dispara **un** refresh compartido y la petición original se reintenta; la UI no se enteró |
| El refresh devuelve `401`                  | Token borrado, `auth:expired`, `/login?returnTo=…&reason=expired` con aviso                        |
| El refresh devuelve `429`                  | Estado `unavailable`: aviso + **Reintentar**; la sesión no se cierra                               |
| El formulario tiene errores                | Mensajes inline, `aria-invalid`, foco en el primer campo con error; sin petición al servidor       |
| El servidor responde `422`                 | Los `fieldErrors` se pintan bajo sus campos                                                        |
| La contraseña es incorrecta                | Alerta con `role="alert"`; la URL no cambia y no se borra lo escrito                               |
| El email ya existe                         | Alerta genérica; no se revela si la cuenta existe                                                  |
| Pulso "Cerrar sesión"                      | `POST /auth/logout` (best effort), token borrado, caché limpiada, `/`                              |
| Estoy autenticado y abro `/login`          | Redirección a `safeReturnTo(returnTo)` o `/app`                                                    |
| Llego con `?returnTo=https://evil.example` | Se ignora: `/app`                                                                                  |

---

## 7. Tests

### 7.1 Qué cubre cada capa

| Archivo                           | Tests | Qué demuestra                                                                                                                                                                                                                       |
| --------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/api.test.ts`                 | 11    | Bearer, `auth: false`, `x-request-id` estable en el reintento, 5 `401` ⇒ 1 refresh, refresh `401` ⇒ evento + token borrado, refresh `429` ⇒ sesión intacta, login `401` sin refresh, `409` con su código, fallo de red ⇒ `status 0` |
| `features/auth/session.test.ts`   | 5     | Refresh primero (1 refresh + 0 `/me`), sesión válida, token ya en memoria, `429` propaga, `401` ⇒ `null`                                                                                                                            |
| `features/auth/return-to.test.ts` | 11    | Destinos internos válidos, query/hash conservados y todos los rechazos (externo, protocol-relative, `/login`, `..`, `app`, `/appx`)                                                                                                 |
| `pages/LoginPage.test.tsx`        | 7     | Estructura, mostrar/ocultar contraseña, credenciales malas, validación inline con `aria-invalid`/`aria-describedby`, `reason=expired`, login correcto, `returnTo`                                                                   |
| `pages/RegisterPage.test.tsx`     | 5     | Estructura, requisito de contraseña, alta correcta, email duplicado, enlace a login                                                                                                                                                 |
| `app/auth-routes.test.tsx`        | 7     | `/app` sin sesión, `/app` con sesión, `/login` con sesión, dos `returnTo` maliciosos, refresh `429` sin redirección, loader sin contenido protegido                                                                                 |
| `schemas/api-error.test.ts`       | 15    | Forma del `details` de un `422`, varios mensajes por campo, rechazos, `null` para otros errores                                                                                                                                     |
| `e2e/auth.spec.ts`                | 2     | Registro real → `/app` → recarga (sesión viva) → logout → `/app` protegida → login; y credenciales incorrectas                                                                                                                      |

Total: **50 tests web**, **15 nuevos de contrato** (23 en el paquete) y **2 E2E** nuevos (5 en la suite).

### 7.2 Los tests los escribió otro agente, con la especificación, no el código

Escribir el test y el código no es un problema de estilo, es un problema de **sesgo**: quien implementa tiende a describir lo que hizo, no lo que se prometió. Por eso, en esta fase, los archivos de test se encargaron a subagentes con un encargo cerrado:

- Se les dio la **especificación de comportamiento**: textos exactos, roles, URLs, códigos de error, invariantes (`refreshCalls === 1`).
- Se les dio la **infraestructura** disponible (MSW, `renderApp`, `seedMockUser`, `startMockSession`) para que no inventaran fixtures.
- Se les **prohibió abrir** la implementación (`LoginPage.tsx`, `api.ts`, `session.ts`…) y modificar código de producción.
- Si un caso fallaba, la instrucción era **reportarlo, no relajarlo**.

Resultado: los 50 tests pasaron a la primera salvo lo que era un fallo real de comportamiento. El único hallazgo fue de entorno (un `node dist/index.js` huérfano ocupando `:3001` y acumulando refreshes hasta el `429`), no del test.

Un test que falla y se "arregla" aflojando el assert no protege nada. Un test escrito desde fuera del código sí avisa cuando cambias el comportamiento sin cambiarlo en la especificación.

---

## 8. Decisiones y alternativas descartadas

| Decisión                                             | Alternativa descartada                                  | Por qué                                                                                                                  |
| ---------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Access token en memoria                              | `localStorage`                                          | Un XSS lo lee. La cookie `httpOnly` ya resuelve la persistencia                                                          |
| Refresh primero en el bootstrap                      | `GET /me` primero                                       | Garantiza un `401` y dos peticiones en cada carga                                                                        |
| Una promesa compartida (`single-flight`)             | Una llamada de refresh por petición                     | Tormenta de refresh y carreras de rotación entre pestañas                                                                |
| `AuthProvider` solo en tres rutas                    | Proveedor global en `Providers`                         | La landing gastaría cupo del rate limit de refresh sin necesitarlo                                                       |
| `429`/5xx ⇒ `unavailable`                            | Cerrar sesión ante cualquier fallo                      | Un límite temporal expulsaría a usuarios legítimos                                                                       |
| Formulario visible en `/login` mientras se comprueba | Loader a pantalla completa                              | El formulario es el contenido útil; esconderlo castiga al caso mayoritario                                               |
| Zod duplicado (contrato + formulario)                | Reutilizar el esquema compartido con mensajes en inglés | El usuario lee español; el servidor sigue siendo la autoridad                                                            |
| `details` del `422` tipado en el contrato            | Parsear a mano en la web                                | Una sola definición para los dos lados; el `429` se distingue solo                                                       |
| `mapApiError` fuera de React                         | Lógica dentro del componente                            | Se prueba sin montar nada y los dos formularios la comparten                                                             |
| MSW con estado                                       | `vi.mock('lib/api')`                                    | Se ejercita el interceptor real (cabeceras, refresh, reintento)                                                          |
| Lista de zonas horarias curada + detectada           | Todas las de `Intl`                                     | Cientos de opciones son peores que 25 + la tuya; la detectada siempre está                                               |
| Sin `React.lazy` en `/app`                           | Dividir el chunk                                        | Es un chunk diminuto y obligaría a aserciones asíncronas en cada test; la división de la landing queda para más adelante |

---

## 9. Limitaciones y riesgos conocidos

1. **Rate limit por IP compartido con login y registro.** `/auth/refresh` tiene 5 intentos/15 min por IP. En un NAT compartido (una universidad, una residencia) varios usuarios pueden agotar el cupo entre todos. El cliente lo mitiga como puede (un refresh por carga, `single-flight`, nunca cerrar sesión por `429`) pero **no puede arreglarlo**: requiere un PR de API con un límite propio para refresh, más alto, o por sesión. Es el riesgo más serio de esta fase y queda anotado como seguimiento.
2. **`AuthProvider` en `/login` cuesta un refresh por visita anónima.** Es el precio de saber si hay que redirigir. La alternativa (una pista en `localStorage`) añade estado que puede quedar obsoleto; se prefiere simplicidad hasta que el límite del punto 1 se corrija.
3. **Sin verificación de email ni recuperación de contraseña.** Fuera de alcance por decisión de producto (`docs/product-spec.md` §8).
4. **Sin cierre de sesión en otras pestañas.** `auth:expired` es local a la pestaña; cerrar sesión en una no cierra las demás hasta que su siguiente petición falle. Se resolverá con `BroadcastChannel` si llega a molestar.
5. **La cookie `Secure` real no está validada en preview.** El gate de Vercel sigue pendiente por falta de Postgres gestionado (`docs/logs/FASE-1-AUTH.md` §11).
6. **`/app` es un esqueleto.** Enseña el saludo y dos tarjetas que anuncian las fases 1.4 y 2; no hay datos todavía.
7. **La landing no divide su bundle.** La división de código de la landing sigue pendiente y es independiente de esta fase.

---

## 10. Cómo ejecutarlo y probarlo a mano

```bash
node scripts/ensure-db.mjs     # Postgres
pnpm db:migrate
pnpm dev                       # web en http://127.0.0.1:5173, API en :3001
```

Recorrido manual:

1. `/register` → crear cuenta (contraseña de 12+). Debe entrar directo en `/app`.
2. **Recargar** en `/app`: sigue dentro (la cookie hizo su trabajo).
3. `DevTools → Application → Local Storage`: **no hay ningún token**. `Cookies`: `studylog_refresh` es `HttpOnly`.
4. "Cerrar sesión" → vuelve a `/`; entrar a `/app` → te manda a `/login?returnTo=%2Fapp`.
5. Entrar con la contraseña mal: alerta, sigues en `/login`.
6. Probar `/login?returnTo=https://example.com` estando autenticado: acabas en `/app`, no fuera.

Tests:

```bash
pnpm test                                   # todo
pnpm --filter @studylog/web test            # 59 tests web (incluye auth-form-interaction)
pnpm --filter @studylog/shared test         # contrato
pnpm test:e2e                               # Playwright (necesita Postgres)
```

> Nota: un run completo de E2E consume ~4 refreshes de la misma IP. Dos ejecuciones en menos de 15 minutos contra un servidor reutilizado pueden agotar el límite y devolver `429`; no es un fallo del test. En CI cada job arranca su propio servidor.

---

## 11. Glosario

| Término                                 | Significado                                                                               |
| --------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Access token**                        | JWT de 15 minutos que acompaña cada petición autenticada                                  |
| **Refresh token**                       | Texto de larga vida en cookie `httpOnly`; sirve para pedir un access token nuevo          |
| **Interceptor**                         | Función que envuelve `fetch` para añadir cabeceras y manejar errores en un solo sitio     |
| **Refresh silencioso**                  | Renovar el token sin que el usuario lo note, cuando llega un `401`                        |
| **`single-flight`**                     | Compartir una única promesa entre llamadas concurrentes para no repetir la operación      |
| **Bootstrap**                           | Comprobar al cargar la app si hay sesión, antes de decidir qué pintar                     |
| **`returnTo`**                          | Destino al que volver tras el login                                                       |
| **Open redirect**                       | Fallo por el que un enlace de tu web puede llevar a otro sitio                            |
| **MSW**                                 | Mock Service Worker: intercepta `fetch` en los tests con handlers HTTP                    |
| **TanStack Query**                      | Caché de datos de servidor; aquí guarda el usuario de la sesión                           |
| **RHF + Zod**                           | React Hook Form gestiona el formulario; Zod valida los valores                            |
| **`aria-invalid` / `aria-describedby`** | Atributos que anuncian a un lector de pantalla que un campo falla y dónde está el mensaje |

---

## 12. Siguiente paso

1. Corregir el límite de refresh en la API (PR de seguimiento, ver §9.1): límite propio y más alto para `/auth/refresh`, y separado del de login/registro.
2. Provisionar Postgres gestionado y completar el gate de Vercel (cookie `Secure`, cold start).
3. Fase 1.3 `feature/subjects-api` y 1.4 `feature/subjects-ui`: asignaturas sobre esta base de sesión.
