# Fase 1 — Autenticación (backend)

> Documento explicativo de lo implementado en la rama `feature/auth`.
> Fecha: 16 de noviembre de 2026.
> Especificaciones de referencia: `docs/api-spec.md` §2, `docs/security-spec.md` §§2–8, `docs/database-spec.md` §§3.1–3.2, `docs/plan.md` §1.1.

Este documento cuenta **qué se ha construido, por qué se ha construido así y cómo comprobarlo**, sin dar por sabido ningún concepto. Si solo lees una sección, lee la 3 (conceptos) y la 5 (endpoints).

---

## 1. Resumen en una frase

Ya existe una API que permite **registrarse, iniciar sesión, mantener la sesión y cerrarla de forma segura**, con contraseñas hasheadas, tokens que caducan, cookies que JavaScript no puede leer y límites contra ataques de fuerza bruta. Todavía **no hay pantallas**: eso es la fase 1.2.

---

## 2. Qué se ha añadido al proyecto

| Zona                         | Qué                                                                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Contrato (`packages/shared`) | Esquemas `authResponse` / `refreshResponse`, constantes de cookie y rate limit, código de error `INVALID_CREDENTIALS` |
| Base de datos                | Tablas `users` y `refresh_tokens` + migración `drizzle/0000_auth_users.sql`                                           |
| API                          | 5 endpoints bajo `/api/v1/auth`                                                                                       |
| Seguridad                    | argon2id, JWT corto, refresh opaco rotatorio, CSRF por `Origin`, rate limit, cabeceras de cookie                      |
| Tests                        | 30 tests de API (integración con Postgres real) + 8 del contrato + 4 de la web                                        |
| CI                           | Servicio Postgres en el job `quality` para que los tests de integración corran en cada PR                             |
| Docs                         | `api-spec`, `security-spec`, `database-spec` y `contract-v0` actualizados con las decisiones reales                   |

---

## 3. Conceptos clave (explicados desde cero)

### 3.1 Access token: el "pasaporte" de 15 minutos

Cuando haces login, el servidor devuelve un **JWT** (JSON Web Token). Un JWT es un texto con tres partes separadas por puntos:

```
eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEyMyIsInR5cGUiOiJhY2Nlc3MifQ.firma
   cabecera                 datos (payload)                          firma
```

- El **payload** lleva el id del usuario (`sub`), la fecha de emisión (`iat`), la de caducidad (`exp`) y el tipo de token (`type: "access"`).
- La **firma** se calcula con `JWT_ACCESS_SECRET`, un secreto que solo conoce el servidor. Si alguien cambia un byte del payload, la firma deja de cuadrar y el token se rechaza.
- El payload **no está cifrado**: cualquiera puede leerlo. Por eso no lleva datos sensibles, solo el id.

El cliente lo guarda **en memoria** (una variable de JavaScript) y lo manda en cada petición como `Authorization: Bearer <token>`. Si recargas la página, esa memoria se pierde: para eso existe el refresh token.

Caduca en **15 minutos**. Si te roban un access token, el daño está acotado a esos 15 minutos.

### 3.2 Refresh token: la "llave larga" que vive en una cookie

El refresh token es un texto aleatorio de 256 bits (no es un JWT: no lleva datos, solo identifica una sesión). Dura **30 días** y se envía en una **cookie**, no en el cuerpo de la respuesta.

La cookie se configura así:

| Atributo            | Valor            | Para qué sirve                                                                                 |
| ------------------- | ---------------- | ---------------------------------------------------------------------------------------------- |
| `HttpOnly`          | sí               | JavaScript **no puede leerla** (`document.cookie` no la ve). Un XSS no puede robarla.          |
| `Secure`            | sí en producción | Solo viaja por HTTPS.                                                                          |
| `SameSite=Lax`      | sí               | El navegador no la envía en peticiones lanzadas desde otro sitio. Primera barrera contra CSRF. |
| `Path=/api/v1/auth` | sí               | Solo se envía a las rutas de auth. El resto de la API nunca la ve.                             |
| `Max-Age`           | 30 días          | Caducidad de la cookie.                                                                        |

En la base de datos **nunca se guarda el token**, solo su hash SHA-256. Si alguien vuelca la base de datos, no obtiene sesiones utilizables.

### 3.3 Rotación: cada refresh cambia la llave

Cada vez que el cliente llama a `/auth/refresh`, el servidor:

1. Busca el token por su hash.
2. Lo marca como revocado (`revoked_reason = 'rotated'`).
3. Crea un token **nuevo** y lo devuelve en una cookie nueva.

Así, un refresh token robado solo sirve **una vez** y deja de funcionar en cuanto el dueño legítimo lo usa.

### 3.4 Familias: una sesión por dispositivo

Cada login crea una **familia** (`family_id`). Todos los tokens que salen de ese login comparten familia. Si se detecta un uso sospechoso, se revoca la familia y solo ese dispositivo queda fuera; los demás dispositivos del usuario siguen conectados.

```
Login (móvil)   → familia A → token A1 → A2 → A3
Login (portátil) → familia B → token B1 → B2
```

### 3.5 Detección de robo y la ventana de gracia de 10 segundos

Si llega un token **ya revocado**, hay dos explicaciones posibles:

- **Ataque**: alguien copió el token y lo está reutilizando.
- **Carrera normal**: dos pestañas del mismo navegador refrescan a la vez con la misma cookie. La primera rota el token; la segunda llega con uno que acaba de quedar revocado.

Sin protección, el caso normal (dos pestañas) expulsaría al usuario. La solución implementada:

| Situación                                                 | Qué hace el servidor                                                                                      |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Token revocado hace **≤ 10 s** y el motivo fue `rotated`  | No revoca nada: emite un **token hermano** en la misma familia. Ambas pestañas siguen dentro.             |
| Token revocado **> 10 s** después, o por `logout`/`reuse` | Considera el token robado y **revoca la familia completa**. Todas las sesiones de ese dispositivo mueren. |

La ventana está en `REFRESH_REUSE_GRACE_SECONDS` (10 s por defecto).

> Detalle técnico: no se devuelve el token sucesor (porque solo se guarda su hash, no el texto). Se emite un **hermano nuevo** de la misma familia, que es equivalente y no necesita guardar secretos en claro.

### 3.6 Contraseñas: argon2id

Las contraseñas se guardan como hash con **argon2id**, el algoritmo recomendado hoy:

- Es **lento a propósito** (~10–15 ms por hash): un atacante que robe la base de datos no puede probar miles de millones de contraseñas por segundo.
- Usa **sal aleatoria** por usuario: dos personas con la misma contraseña tienen hashes distintos.
- Es **memory-hard**: consume 19 MiB por cálculo, lo que encarece el ataque con GPUs.

Parámetros en `apps/api/src/lib/password.ts`: `memoryCost 19456`, `timeCost 2`, `parallelism 1` (línea base OWASP).

**Detalle anti-enumeración:** si el email no existe, el login verifica igualmente contra un hash de relleno. Sin eso, "email inexistente" respondería en 1 ms y "contraseña incorrecta" en 12 ms: la diferencia de tiempo revelaría qué cuentas existen.

### 3.7 CSRF: que otra web no actúe en tu nombre

CSRF es un ataque en el que una web maliciosa hace que **tu navegador** envíe una petición a nuestra API, aprovechando que llevas la cookie. Defensas implementadas:

1. `SameSite=Lax`: el navegador no manda la cookie en peticiones cruzadas.
2. Comprobación de `Origin`/`Referer` contra `APP_ORIGIN` en toda petición mutante (POST, PUT, PATCH, DELETE).

Si una petición mutante llega con un `Origin` que no está en la lista → `403 FORBIDDEN`. Si no trae ni `Origin` ni `Referer` (curl, tests, servidor a servidor), se permite: un cliente que no es navegador no lleva cookies de la víctima.

### 3.8 Rate limiting: contra la fuerza bruta

`register`, `login` y `refresh` limitan intentos por **IP** y por **email**:

- 5 intentos por ventana de 15 minutos.
- Al pasarse: `429 RATE_LIMITED` con cabecera `Retry-After` (segundos que faltan).
- El email se convierte en clave **hasheada** (`sha256`), para que el almacén de límites no sea una lista de emails.

La implementación está detrás de una interfaz (`RateLimitStore`) con dos versiones:

| Store         | Cuándo                                                                          | Aviso                                                                              |
| ------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Memoria       | Desarrollo, CI, tests, y como fallback                                          | En serverless cada instancia tiene su propio contador: **no es una defensa real**. |
| Upstash Redis | Cuando `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` están configurados | Contador compartido entre instancias.                                              |

Si el store falla (Redis caído), el sistema **deja pasar** la petición y lo registra en el log. Se prefiere disponibilidad de login a bloqueo total; el fallo es visible en observabilidad.

---

## 4. Base de datos

Migración: `apps/api/drizzle/0000_auth_users.sql`. Se aplica con `pnpm db:migrate`; **nunca** al arrancar la función serverless.

### 4.1 `users`

| Columna                     | Tipo          | Notas                                         |
| --------------------------- | ------------- | --------------------------------------------- |
| `id`                        | `uuid`        | PK, `gen_random_uuid()`                       |
| `email`                     | `text`        | Único por `lower(email)`, CHECK de minúsculas |
| `password_hash`             | `text`        | argon2id; nunca sale en una respuesta         |
| `display_name`              | `text`        | 1–80 caracteres, no puede ser solo espacios   |
| `timezone`                  | `text`        | IANA, por defecto `UTC`                       |
| `created_at` / `updated_at` | `timestamptz` | UTC                                           |

**Decisión: `text` + índice único sobre `lower(email)` en lugar de `citext`.**
El modelo de referencia usaba `citext`, pero esa extensión requiere `postgresql-contrib` y no está en todas las instalaciones (de hecho, falta en el Postgres local de este equipo). La alternativa da la misma garantía sin dependencias:

```sql
CREATE UNIQUE INDEX users_email_lower_unique ON users (lower(email));
CHECK (email = lower(email))
```

El contrato Zod ya convierte el email a minúsculas; el CHECK impide que una escritura manual en SQL rompa la regla.

### 4.2 `refresh_tokens`

| Columna          | Tipo          | Para qué                                                  |
| ---------------- | ------------- | --------------------------------------------------------- |
| `id`             | `uuid`        | PK                                                        |
| `user_id`        | `uuid`        | FK a `users.id`, `ON DELETE CASCADE`                      |
| `token_hash`     | `text`        | SHA-256 del token, único                                  |
| `family_id`      | `uuid`        | Agrupa los tokens de un mismo login                       |
| `replaced_by_id` | `uuid`        | Enlace al token que sustituyó a este (cadena de rotación) |
| `expires_at`     | `timestamptz` | Caducidad (30 días)                                       |
| `revoked_at`     | `timestamptz` | Cuándo se revocó, si se revocó                            |
| `revoked_reason` | `text`        | `rotated` \| `logout` \| `reuse`                          |
| `user_agent`     | `text`        | Navegador que abrió la sesión (auditoría)                 |
| `created_at`     | `timestamptz` | Creación                                                  |

Índices: `user_id`, `family_id`, `expires_at` (este último para la limpieza por cron de la fase 6) y único en `token_hash`.

La rotación se hace en **una transacción**: se inserta el sucesor y se revoca el actual solo si sigue activo (`WHERE revoked_at IS NULL`). Si dos peticiones compiten, una gana y la otra cae en la ventana de gracia. Así nunca se sobrescribe una revocación por reutilización sospechosa.

---

## 5. API: los cinco endpoints

Base: `/api/v1`. Formato: JSON. Errores con el envelope común:

```json
{ "error": { "code": "UNAUTHORIZED", "message": "Authentication required" } }
```

### 5.1 `POST /api/v1/auth/register` → `201`

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "ana@example.com",
  "password": "una-contraseña-segura",
  "displayName": "Ana",
  "timezone": "Europe/Madrid"
}
```

Respuesta:

```json
{
  "user": {
    "id": "0f8fad5b-...",
    "email": "ana@example.com",
    "displayName": "Ana",
    "timezone": "Europe/Madrid",
    "createdAt": "2026-11-16T20:33:56.000Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiJ9..."
}
```

Además, `Set-Cookie: studylog_refresh=...; HttpOnly; SameSite=Lax; Path=/api/v1/auth`.

Errores: `422 VALIDATION_ERROR` (contraseña corta, email inválido, timezone inválida), `409 CONFLICT` (email ya registrado, con mensaje genérico), `429 RATE_LIMITED`.

### 5.2 `POST /api/v1/auth/login` → `200`

```json
{ "email": "ana@example.com", "password": "una-contraseña-segura" }
```

Misma respuesta que el registro. Errores: `401 INVALID_CREDENTIALS` (email o contraseña mal, sin distinguir cuál), `429 RATE_LIMITED`.

### 5.3 `POST /api/v1/auth/refresh` → `200`

Sin cuerpo: el token viaja en la cookie.

```json
{ "accessToken": "eyJhbGciOiJIUzI1NiJ9..." }
```

Rota el refresh token y actualiza la cookie. Errores: `401 UNAUTHORIZED` (sin cookie, caducado, revocado o familia revocada) y en ese caso la cookie se elimina.

### 5.4 `POST /api/v1/auth/logout` → `204`

Sin cuerpo. Revoca el token actual (solo esa sesión) y borra la cookie. Es **idempotente**: llamarlo dos veces, o sin cookie, también devuelve `204`.

### 5.5 `GET /api/v1/auth/me` → `200`

```http
Authorization: Bearer <accessToken>
```

Devuelve el usuario público (`id`, `email`, `displayName`, `timezone`, `createdAt`). Sin token, token caducado, firma incorrecta o token de tipo equivocado → `401 UNAUTHORIZED`.

### 5.6 Códigos de error usados

| HTTP | Código                | Cuándo                                                        |
| ---- | --------------------- | ------------------------------------------------------------- |
| 401  | `UNAUTHORIZED`        | Falta el access token, es inválido o caducó; refresh inválido |
| 401  | `INVALID_CREDENTIALS` | Email o contraseña incorrectos en login                       |
| 403  | `FORBIDDEN`           | `Origin` no permitido (CSRF)                                  |
| 409  | `CONFLICT`            | Email ya registrado                                           |
| 422  | `VALIDATION_ERROR`    | Payload inválido (Zod)                                        |
| 429  | `RATE_LIMITED`        | Demasiados intentos; incluye `Retry-After`                    |
| 500  | `INTERNAL_ERROR`      | Fallo inesperado, sin detalles internos                       |

---

## 6. Mapa de archivos

```text
packages/shared/src/
  schemas/auth.ts           authResponseSchema, refreshResponseSchema
  constants.ts              REFRESH_COOKIE_NAME/PATH, AUTH_RATE_LIMIT, grace, API_PREFIX
  errors.ts                 INVALID_CREDENTIALS

apps/api/src/
  config/env.ts             nuevas variables + lista de orígenes permitidos
  db/schema.ts              tablas users y refresh_tokens (Drizzle)
  db/client.ts              drizzle con schema tipado
  drizzle/0000_auth_users.sql  migración
  lib/password.ts           argon2id + hash de relleno anti-timing
  lib/tokens.ts             firmar/verificar JWT, generar/hashear refresh
  lib/cookies.ts            set/clear/read de la cookie httpOnly
  lib/rate-limit.ts         interfaz RateLimitStore + memoria + Upstash
  middleware/require-auth.ts   valida el Bearer y expone el userId
  middleware/origin-check.ts   CSRF por Origin/Referer
  repositories/users.ts        consultas de usuarios
  repositories/refresh-tokens.ts  consultas + rotación transaccional
  services/auth.ts          reglas de negocio (registro, login, refresh, logout, me)
  routes/auth.ts            los cinco endpoints
  app.ts                    montaje de /api/v1 y de las dependencias
  test/db.ts                migraciones + limpieza entre tests
  routes/auth.test.ts       19 tests de integración
  lib/password.test.ts      5 tests
  lib/rate-limit.test.ts    2 tests
```

**Capas:** `routes` valida y traduce HTTP; `services` decide; `repositories` habla con Postgres; `lib` son utilidades sin estado. Ninguna ruta escribe SQL: así el ownership y las reglas se prueban sin montar HTTP.

---

## 7. Configuración

Variables nuevas o modificadas en `.env.example`:

```dotenv
JWT_ACCESS_SECRET=...                 # mínimo 32 caracteres; en producción no puede ser el de desarrollo
ACCESS_TOKEN_TTL=15                   # minutos de vida del access token
REFRESH_TOKEN_TTL_DAYS=30             # días de vida del refresh token
APP_ORIGIN=http://127.0.0.1:5173      # lista separada por comas; sin comodines
REFRESH_REUSE_GRACE_SECONDS=10        # ventana para el caso multi-pestaña
AUTH_RATE_LIMIT_MAX_ATTEMPTS=5
AUTH_RATE_LIMIT_WINDOW_MINUTES=15
UPSTASH_REDIS_REST_URL=               # opcional; activa el rate limit distribuido
UPSTASH_REDIS_REST_TOKEN=
```

`APP_ORIGIN` cambió de `http://localhost:5173` a `http://127.0.0.1:5173` porque Vite sirve en `127.0.0.1` (`apps/web/vite.config.ts`). Si no coinciden, toda petición mutante devolvería `403`.

---

## 8. Cómo ejecutarlo y probarlo

```bash
# 1. Base de datos (si no está arrancada)
node scripts/ensure-db.mjs

# 2. Migración
pnpm db:migrate

# 3. API en desarrollo
pnpm dev:api            # http://127.0.0.1:3001

# 4. Prueba manual del flujo
curl -i -X POST http://127.0.0.1:3001/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"ana@example.com","password":"una-contraseña-segura","displayName":"Ana","timezone":"Europe/Madrid"}'
```

Tests:

```bash
pnpm test                                   # todo (necesita Postgres arrancado)
pnpm --filter @studylog/api test            # solo API
pnpm --filter @studylog/api test -- src/routes/auth.test.ts
pnpm --filter @studylog/shared test
```

Los tests de API usan **Postgres real**, no mocks: aplican la migración y truncan las tablas entre casos. Prueban, entre otras cosas:

- Registro correcto, flags de la cookie, email duplicado con distinto uso de mayúsculas.
- Login correcto, contraseña mal, email inexistente (mismo código y mismo coste).
- Rotación de refresh y que el token viejo no se reutiliza.
- Reutilización dentro de la ventana de gracia (200) y fuera (401 + familia revocada).
- Logout idempotente y que el refresh posterior falla.
- `/me` sin token, con token caducado y con token de tipo incorrecto.
- Rate limit `429` + `Retry-After`.
- CSRF: origen ajeno `403`, origen permitido `201`.

---

## 9. CI

El job `quality` de `.github/workflows/ci.yml` ahora levanta `postgres:16-alpine` (`studylog_test`) y exporta `DATABASE_URL`, `JWT_ACCESS_SECRET`, `APP_ORIGIN` y `LOG_LEVEL=warn`. Los tests aplican la migración por sí mismos (`src/test/db.ts`), así que un cambio de esquema roto falla en CI sin pasos manuales.

Orden sin cambios: `install → lint → typecheck → test → build`.

---

## 10. Decisiones y alternativas descartadas

| Decisión                          | Alternativa descartada        | Por qué                                                                                                                                            |
| --------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| argon2id con `@node-rs/argon2`    | `argon2` (node-gyp), `scrypt` | Prebuilt napi-rs: sin compilador en Vercel, binarios para linux-x64. `scrypt` queda como plan B si el módulo nativo fallara.                       |
| Refresh opaco + hash en BD        | Refresh como JWT              | Un JWT no se puede revocar sin estado extra; el token opaco sí.                                                                                    |
| `family_id` por login             | Revocar por `user_id`         | Un token robado no debería cerrar la sesión de todos los dispositivos.                                                                             |
| Ventana de gracia 10 s            | Rotación estricta             | Dos pestañas refrescando a la vez expulsarían al usuario en el flujo normal.                                                                       |
| `text` + `lower(email)` único     | `citext`                      | No depende de `postgresql-contrib`; funciona en cualquier Postgres.                                                                                |
| Rate limit en memoria por defecto | Upstash obligatorio           | Desbloquea desarrollo y CI; el adaptador distribuido está listo y se activa por entorno.                                                           |
| `409` genérico en email duplicado | `201` falso o `409` explícito | Sin verificación de email no se puede ocultar del todo; un `201` falso obligaría a implementar verificación ya. Se documenta como riesgo residual. |
| `logout` idempotente `204`        | `401` sin cookie              | Un cliente que ya perdió la cookie no debe ver un error al cerrar sesión.                                                                          |
| `Origin` ausente permitido        | Rechazar siempre              | Los clientes que no son navegador no pueden sufrir CSRF; rechazarlos rompería curl y tests sin ganar seguridad.                                    |

---

## 11. Limitaciones conocidas y trabajo pendiente

1. **Neon/Supabase sin provisionar.** Sin `DATABASE_URL` pooled, el preview de Vercel responde `503 database down` y no se puede validar el flujo real allí.
2. **Gate de Vercel pendiente.** Falta medir en un preview: cold start con argon2, `Set-Cookie` real con `Secure`, y límite de body. Debe registrarse en `docs/spikes/vercel-express.md` §3 y §5.
3. **Rate limit real solo con Upstash.** En Vercel, sin Upstash, el límite es por instancia.
4. **Sin verificación de email ni recuperación de contraseña.** Fuera de alcance por decisión de producto (`docs/product-spec.md` §8).
5. **Sin limpieza de tokens caducados.** `refresh_tokens` crecerá; la purga por cron está planificada para la fase 6. El índice `expires_at` ya está preparado.
6. **Sin UI.** La fase 1.2 (`feature/auth-ui`) consumirá estos endpoints con TanStack Query, un único refresh con mutex y `returnTo`.
7. **Una rama agrupa contrato, CI y API.** `docs/gitflow-spec.md` §10.3 pide PRs separados para `packages/shared` y `.github/workflows`. Aquí se han agrupado en `feature/auth` por indicación explícita; si se quiere respetar la regla al pie de la letra, se pueden extraer a `chore/contract-auth` y `chore/ci-integration-tests` antes del merge.

---

## 12. Glosario

| Término                     | Significado                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| **JWT**                     | Texto firmado con tres partes (cabecera, datos, firma). Se puede leer pero no modificar sin el secreto. |
| **Access token**            | JWT corto que acompaña cada petición autenticada.                                                       |
| **Refresh token**           | Texto aleatorio de larga vida que sirve para pedir un access token nuevo.                               |
| **Hash**                    | Huella irreversible de un texto. No se puede "deshacer"; solo comparar.                                 |
| **Salt**                    | Valor aleatorio que se añade antes de hashear para que dos contraseñas iguales den hashes distintos.    |
| **Rotación**                | Cambiar el refresh token por uno nuevo en cada uso.                                                     |
| **Familia**                 | Conjunto de tokens nacidos de un mismo login/dispositivo.                                               |
| **CSRF**                    | Ataque que usa tu navegador (y tus cookies) para enviar peticiones que tú no pediste.                   |
| **CORS**                    | Reglas del navegador para llamar a otro origen. Aquí no hace falta: web y API comparten origen.         |
| **Rate limit**              | Límite de intentos por ventana de tiempo.                                                               |
| **Enumeración de usuarios** | Deducir qué cuentas existen por mensajes o tiempos de respuesta distintos.                              |
| **Idempotente**             | Repetir la operación no cambia el resultado (logout dos veces sigue siendo un logout).                  |

---

## 13. Siguiente paso

1. Provisionar Neon y configurar `DATABASE_URL` (pooled) y `DATABASE_URL_UNPOOLED` (directa) en Vercel.
2. Abrir el preview de esta rama y completar el gate del spike (§11.2).
3. Implementar `feature/auth-ui` (fase 1.2): `/login`, `/register`, `/app` protegida, `AuthProvider` con TanStack Query, refresh silencioso con mutex y formularios accesibles.
4. Después, `subjects-api` y `subjects-ui` (fases 1.3 y 1.4).
