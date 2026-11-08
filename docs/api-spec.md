# Especificación de API — StudyLogV2

## 1. Convenciones generales

- **Base URL**: `/api/v1`.
- **Formato**: JSON (`application/json`).
- **Autenticación**: access token JWT en `Authorization: Bearer <token>`.
- **Refresh token**: cookie `httpOnly`; no se expone en el body.
- **Validación**: Zod en el borde de la API.
- **Autorización**: cada recurso se filtra por `user_id`; nunca se confía en IDs del cliente.
- **Versionado**: prefijo `/v1`; cambios incompatibles requieren nueva versión.

### 1.1 Cabeceras relevantes

| Cabecera | Uso |
|---|---|
| `Authorization: Bearer <token>` | Access token |
| `Content-Type: application/json` | Peticiones con body |
| `Idempotency-Key` | Creación idempotente de sesiones |
| `Origin` | Validación CSRF en peticiones mutables |

### 1.2 Formato de error

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid study session",
    "details": {}
  }
}
```

Códigos previstos:

| Código HTTP | `code` | Uso |
|---|---|---|
| 400 | `BAD_REQUEST` | Petición mal formada |
| 401 | `UNAUTHORIZED` | Token ausente, inválido o expirado |
| 403 | `FORBIDDEN` | Autenticado sin permiso |
| 404 | `NOT_FOUND` | Recurso inexistente o no visible |
| 409 | `CONFLICT` | Solapamiento, duplicado o estado incompatible |
| 422 | `VALIDATION_ERROR` | Datos semánticamente inválidos |
| 422 | `IDEMPOTENCY_KEY_REUSED` | Misma clave con payload distinto |
| 429 | `RATE_LIMITED` | Demasiadas peticiones |
| 500 | `INTERNAL_ERROR` | Error no esperado; sin detalles internos |

## 2. Autenticación

### 2.1 `POST /auth/register`

Request:

```json
{
  "email": "student@example.com",
  "password": "una-contraseña-segura",
  "displayName": "Ana",
  "timezone": "Europe/Madrid"
}
```

Response `201`:

```json
{
  "user": {
    "id": "uuid",
    "email": "student@example.com",
    "displayName": "Ana",
    "timezone": "Europe/Madrid"
  },
  "accessToken": "jwt-corto"
}
```

El cliente mantiene `accessToken` en memoria; el refresh token viaja en cookie `httpOnly`.

Reglas:

- Email único y normalizado.
- Contraseña con longitud mínima y sin devolverla nunca.
- Mensaje genérico si el email ya existe, para no facilitar enumeración.
- Rate limiting agresivo.

### 2.2 `POST /auth/login`

Request:

```json
{
  "email": "student@example.com",
  "password": "una-contraseña-segura"
}
```

Response `200`:

```json
{
  "user": {
    "id": "uuid",
    "email": "student@example.com",
    "displayName": "Ana",
    "timezone": "Europe/Madrid"
  },
  "accessToken": "jwt-corto"
}
```

Reglas:

- Error genérico `INVALID_CREDENTIALS` si email o contraseña no coinciden.
- No revelar si el email existe.
- Rate limiting por IP y por email.

### 2.3 `POST /auth/refresh`

- Lee el refresh token de la cookie.
- Rota el token: revoca el actual y emite uno nuevo.
- Si detecta reutilización de un token revocado, revoca la familia completa.
- Response `200` con nuevo `accessToken` y cookie actualizada.
- Response `401` si no hay sesión válida.

### 2.4 `POST /auth/logout`

- Revoca el refresh token actual.
- Limpia la cookie.
- Response `204`.

### 2.5 `GET /auth/me`

Response `200`:

```json
{
  "id": "uuid",
  "email": "student@example.com",
  "displayName": "Ana",
  "timezone": "Europe/Madrid",
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

## 3. Asignaturas

### 3.1 `GET /subjects`

Query params opcionales:

- `includeArchived=true|false` (default `false`).

Response `200`:

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Cálculo",
      "colorHex": "#2563EB",
      "targetHoursWeek": 6,
      "archivedAt": null,
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

### 3.2 `POST /subjects`

Request:

```json
{
  "name": "Cálculo",
  "colorHex": "#2563EB",
  "targetHoursWeek": 6
}
```

Response `201` con la asignatura creada.

Validaciones:

- `name` no vacío tras `trim`.
- `colorHex` con formato `#RRGGBB`.
- `targetHoursWeek >= 0`.
- Nombre único entre asignaturas activas del mismo usuario (recomendado).

### 3.3 `PATCH /subjects/:id`

Acepta cambios parciales de `name`, `colorHex`, `targetHoursWeek` y `archivedAt`.

### 3.4 `POST /subjects/:id/archive` y `POST /subjects/:id/unarchive`

- Archivar conserva la asignatura y sus sesiones, pero la oculta de los listados activos.
- Desarchivar la vuelve a mostrar.
- Response `200` con la asignatura actualizada.
- Alternativa: usar `PATCH` con `archivedAt`; elegir una sola forma en el contrato.

### 3.5 `DELETE /subjects/:id`

- Archiva la asignatura si tiene sesiones.
- Si no tiene sesiones, puede eliminarla físicamente.
- Response `204` o `200` con la asignatura archivada.
- No borra sesiones históricas.

## 4. Sesiones de estudio

### 4.1 `GET /sessions`

Query params:

| Parámetro | Tipo | Uso |
|---|---|---|
| `from` | ISO 8601 | Inicio del rango |
| `to` | ISO 8601 | Fin del rango |
| `subjectId` | UUID | Filtrar por asignatura |
| `page` | entero | Página, desde 1 |
| `pageSize` | entero | Tamaño, máximo razonable (p. ej. 100) |

Response `200`:

```json
{
  "data": [
    {
      "id": "uuid",
      "subjectId": "uuid",
      "startedAt": "2026-01-01T18:00:00.000Z",
      "endedAt": "2026-01-01T18:50:00.000Z",
      "durationSeconds": 3000,
      "source": "pomodoro",
      "note": null
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 1,
    "totalPages": 1
  }
}
```

### 4.2 `POST /sessions`

Cabecera obligatoria recomendada: `Idempotency-Key: <uuid>`.

Request:

```json
{
  "subjectId": "uuid",
  "startedAt": "2026-01-01T18:00:00.000Z",
  "endedAt": "2026-01-01T18:50:00.000Z",
  "source": "manual",
  "note": "Repaso de límites"
}
```

Response `201` con la sesión creada.

Reglas:

- `durationSeconds` se calcula en servidor; no se acepta del cliente.
- `endedAt > startedAt`.
- `subjectId` debe pertenecer al usuario.
- Evitar solapamientos; devolver `409` con detalle.
- Misma `Idempotency-Key` + mismo payload: devolver la misma sesión.
- Misma `Idempotency-Key` + payload distinto: `422 IDEMPOTENCY_KEY_REUSED`.

### 4.3 `PATCH /sessions/:id`

- Cambios parciales de `subjectId`, `startedAt`, `endedAt`, `note`.
- Recalcular `durationSeconds`.
- Revalidar solapamientos.
- Invalidar estadísticas y leaderboard del usuario.

### 4.4 `DELETE /sessions/:id`

- Response `204`.
- Invalidar estadísticas y leaderboard del usuario.

## 5. Estadísticas

### 5.1 `GET /stats/summary`

Query params:

- `range=today|week|month|all` (default `week`).
- `timezone` opcional; por defecto, la del usuario.

Response `200`:

```json
{
  "range": "week",
  "from": "2026-01-05T00:00:00.000Z",
  "to": "2026-01-11T23:59:59.999Z",
  "totalSeconds": 12600,
  "totalHours": 3.5,
  "streakDays": 4,
  "sessionsCount": 8,
  "bySubject": [
    {
      "subjectId": "uuid",
      "name": "Cálculo",
      "colorHex": "#2563EB",
      "totalSeconds": 7200
    }
  ]
}
```

### 5.2 `GET /stats/weekly`

Query params:

- `weeks` (default 12).
- `timezone` opcional.

Response `200`:

```json
{
  "data": [
    {
      "weekStart": "2026-01-05",
      "totalSeconds": 12600,
      "totalHours": 3.5
    }
  ]
}
```

Reglas:

- Las estadísticas personales usan la zona horaria del usuario.
- El leaderboard usa una ventana UTC fija.
- Las sesiones solapadas o eliminadas no cuentan.

## 6. Leaderboard y emblemas (post-MVP)

### 6.1 `GET /leaderboard/weekly`

Query params:

- `scope=friends|global` (default `friends`).
- `page`, `pageSize`.

Response `200`:

```json
{
  "data": [
    {
      "rank": 1,
      "userId": "uuid",
      "displayName": "Ana",
      "totalSeconds": 36000,
      "streakDays": 7
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 1,
    "totalPages": 1
  },
  "weekStart": "2026-01-05",
  "weekEnd": "2026-01-11"
}
```

Reglas:

- `friends` solo incluye amistades aceptadas.
- `global` requiere opt-in explícito.
- No exponer email ni datos privados.
- Ventana semanal UTC fija.
- Puede servirse desde caché/vista materializada con TTL.

### 6.2 `GET /badges`

Response `200`:

```json
{
  "data": [
    {
      "code": "FIRST_SESSION",
      "name": "Primer paso",
      "description": "Registra tu primera sesión",
      "icon": "spark",
      "awardedAt": "2026-01-01T18:50:00.000Z"
    }
  ]
}
```

### 6.3 Endpoints de amigos (post-MVP)

| Método | Ruta | Uso |
|---|---|---|
| GET | `/friends` | Listar amistades aceptadas |
| GET | `/friends/requests` | Solicitudes pendientes |
| POST | `/friends/requests` | Enviar solicitud |
| POST | `/friends/requests/:id/accept` | Aceptar |
| POST | `/friends/requests/:id/block` | Bloquear |
| DELETE | `/friends/:id` | Eliminar amistad |

## 7. Paginación

Todas las listas potencialmente largas usan:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 0,
    "totalPages": 0
  }
}
```

## 8. Idempotencia

- Obligatoria en `POST /sessions`; recomendada en cualquier creación con efectos.
- La clave se genera en el cliente o en el evento que inicia la acción, no en la capa de reintento.
- Se guarda única por usuario.
- Si la clave existe con el mismo payload, se devuelve el resultado original.
- Si la clave existe con otro payload, se devuelve `422 IDEMPOTENCY_KEY_REUSED`.
- La retención de claves debe superar la ventana de reintentos.

## 9. Documentación y contrato

- Los schemas Zod de `packages/shared` son la fuente de verdad.
- Generar OpenAPI desde ellos o mantener una especificación derivada.
- No duplicar tipos a mano entre frontend y backend.
- En desarrollo se puede exponer `/api/docs`; en producción, protegerlo o deshabilitarlo.

## 10. Rate limiting

- Login, registro y refresh: límites estrictos por IP y por email.
- Endpoints de escritura: límite razonable por usuario.
- Respuesta `429` con `Retry-After`.
- Implementación con Upstash Redis o equivalente; no usar memoria local en Vercel.
