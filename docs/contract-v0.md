# Contrato v0 — congelado en Fase 0

> Estado: **congelado** el 2026-11-08 (Fase 0).
> Fuente de verdad ejecutable: `packages/shared/src`.
> Contrato HTTP completo: `docs/api-spec.md`.

## 1. Qué congela esta versión

La Fase 0 fija las piezas transversales que consumirán todas las fases siguientes:

1. El envelope de error y los códigos permitidos.
2. La paginación `page` / `pageSize` y sus límites.
3. Los esquemas de entrada y salida de `user`, `subject` y `studySession`.
4. Las constantes de dominio: colores de asignatura, tamaño de página y duración máxima.
5. Los endpoints de salud (`GET /api/health`, `GET /api/health/live`).

Las rutas de negocio (`/api/v1/auth/*`, `/api/v1/subjects`, `/api/v1/sessions`, estadísticas) se implementan en las fases 1 y 2 **contra este contrato**. Añadirlas no cambia la forma de los schemas ya congelados.

## 2. Envelope de error

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "details": {}
  }
}
```

Códigos y estados en `packages/shared/src/errors.ts`:

| HTTP | `code` |
|---|---|
| 400 | `BAD_REQUEST` |
| 401 | `UNAUTHORIZED` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 409 | `CONFLICT` |
| 422 | `VALIDATION_ERROR` |
| 422 | `IDEMPOTENCY_KEY_REUSED` |
| 429 | `RATE_LIMITED` |
| 500 | `INTERNAL_ERROR` |

Reglas:

- `details` es opcional y nunca contiene secretos ni trazas internas.
- Los errores inesperados responden `INTERNAL_ERROR` sin filtrar la causa.
- Zod se valida en el borde; un `ZodError` se traduce a `VALIDATION_ERROR` con `details` serializables.

## 3. Paginación

`packages/shared/src/schemas/pagination.ts`:

- `page`: entero ≥ 1, por defecto `1`.
- `pageSize`: entero entre 1 y `MAX_PAGE_SIZE` (100), por defecto `DEFAULT_PAGE_SIZE` (20).
- Respuesta: `page`, `pageSize`, `totalItems`, `totalPages`.

## 4. Esquemas de dominio

### `user`

- `email`: normalizado a minúsculas.
- `displayName`: 1–80 caracteres.
- `password`: 12–128 caracteres (solo entrada; nunca se serializa).
- `timezone`: IANA válida, por defecto `UTC`.
- `publicUser`: `id`, `email`, `displayName`, `timezone`, `createdAt`.

### `subject`

- `name`: 1–80 caracteres.
- `colorHex`: `#RRGGBB`.
- `targetHoursWeek`: 0–168 o `null`.
- Salida: añade `id`, `userId`, `archivedAt`, `createdAt`, `updatedAt`.

### `studySession`

- `subjectId`: UUID.
- `startedAt` / `endedAt`: ISO 8601; `endedAt` debe ser posterior.
- `source`: `manual` | `pomodoro` (por defecto `manual`).
- `note`: hasta 1000 caracteres o `null`.
- Salida: añade `id`, `userId`, `durationSeconds`, `idempotencyKey`, `createdAt`, `updatedAt`.
- `MAX_SESSION_SECONDS` = 12 horas.

## 5. Constantes

- `SUBJECT_COLORS`: 10 colores accesibles; el color nunca es la única señal.
- `DEFAULT_PAGE_SIZE` = 20; `MAX_PAGE_SIZE` = 100.
- `MAX_SESSION_HOURS` = 12.

## 6. Endpoints de salud (implementados)

| Endpoint | Respuesta |
|---|---|
| `GET /api/health` | `200 { status: "ok", database: "up", timestamp }` o `503 { status: "error", database: "down" }` |
| `GET /api/health/live` | `200 { status: "ok", uptimeSeconds }` |

Ambos incluyen `x-request-id` en la respuesta.

## 7. Cómo cambiar el contrato

1. Abrir un issue de tipo `chore` describiendo el cambio y su impacto.
2. Crear `chore/contract-<slug>` desde `develop`.
3. Cambiar `packages/shared` y `docs/api-spec.md` en el mismo PR.
4. Actualizar tests de `packages/shared`.
5. Tras el merge, el resto de ramas hacen rebase y adaptan sus consumidores.

Un cambio incompatible requiere una nueva versión del prefijo HTTP (`/v2`) o una estrategia expand/contract documentada. No se rompe v0 dentro de `/v1`.
