# Especificación de seguridad — StudyLogV2

## 1. Objetivos

- Proteger cuentas, sesiones de estudio y datos personales.
- Evitar accesos cruzados entre usuarios.
- Resistir fuerza bruta, reutilización de tokens y CSRF.
- No filtrar información interna en errores ni logs.

## 2. Contraseñas

- Hash con **argon2id** (preferido) o bcrypt con coste alto si argon2 no es viable en el runtime.
- Nunca guardar ni loggear contraseñas en claro.
- Longitud mínima razonable (p. ej. 8–12 caracteres) y límite máximo para evitar abusos.
- No imponer reglas de composición que favorezcan contraseñas débiles; permitir frases largas.
- Comparación en tiempo constante cuando aplique.

## 3. JWT y sesiones

### 3.1 Access token

- JWT firmado con `JWT_ACCESS_SECRET`.
- Vida corta: 15 minutos.
- Se mantiene en memoria en el frontend; no en `localStorage`.
- Claims mínimos: `sub` (user id), `iat`, `exp`, `type: "access"`.
- No incluir datos sensibles.

### 3.2 Refresh token

- Cookie `httpOnly`, `secure` en producción, `SameSite=Lax` (o `None` si hay dominios separados).
- Vida de 7–30 días.
- Token opaco (no JWT) generado con aleatoriedad criptográfica.
- Se guarda solo su hash en `refresh_tokens`.
- Rotación en cada uso.
- Detección de reutilización: si se usa un token revocado, revocar toda la familia y forzar login.
- Logout revoca el token actual y limpia la cookie.

### 3.3 Flujo de sesión

```text
Login → access token en memoria + refresh cookie
Petición → Authorization: Bearer
401 → intentar POST /api/v1/auth/refresh una vez → reintentar la petición
Refresh inválido → limpiar sesión y redirigir a login
```

Evitar bucles infinitos de refresh: un solo reintento por petición.

## 4. CSRF

- `SameSite=Lax` como primera defensa.
- Validar `Origin`/`Referer` en peticiones mutables.
- Si web y API están en dominios distintos, usar `SameSite=None; Secure` y token CSRF de doble envío.
- No aceptar peticiones mutables sin comprobación de origen.

## 5. CORS

- Si hay un solo proyecto Vercel, mismo origen: no hace falta CORS amplio.
- Si hay dominios separados, allowlist explícita del origen del frontend.
- `credentials: true` solo para el origen permitido.
- No usar `*` con credenciales.

## 6. Autorización

- Toda consulta filtra por `user_id` del token.
- No confiar en `userId` enviado por el cliente.
- Verificar que `subjectId` pertenece al usuario antes de crear/editar sesiones.
- Para amistades y leaderboard, comprobar relación y visibilidad.
- Devolver `404` en lugar de `403` cuando revelar la existencia del recurso sea sensible.

## 7. Validación de entrada

- Zod en el borde: body, query params, params de ruta y headers relevantes.
- Límites de longitud en textos y notas.
- Validar formato de fechas ISO 8601 y rangos.
- Validar `colorHex` con regex `^#[0-9A-Fa-f]{6}$`.
- Validar `timezone` contra una lista/IANA válida.
- Rechazar payloads con campos inesperados cuando sea razonable.

## 8. Rate limiting

- Login/registro/refresh: límites por IP y por email.
- Escrituras: límite por usuario.
- Respuesta `429` con `Retry-After`.
- Usar Upstash Redis o equivalente; la memoria local no sirve en serverless.

## 9. Cabeceras y endurecimiento

- Helmet para cabeceras de seguridad.
- HSTS en producción.
- CSP razonable para la SPA y los assets.
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy`.
- `Permissions-Policy` para limitar APIs del navegador.
- No exponer `X-Powered-By`.

## 10. Secretos y configuración

- Secretos solo en variables de entorno.
- `.env.example` sin valores reales.
- No commitear `.env`.
- Rotar `JWT_ACCESS_SECRET` con plan de invalidación de sesiones.
- Separar secretos de preview y producción.

Variables previstas:

```text
DATABASE_URL=
DATABASE_URL_UNPOOLED=
JWT_ACCESS_SECRET=
ACCESS_TOKEN_TTL=
REFRESH_TOKEN_TTL_DAYS=
APP_ORIGIN=
NODE_ENV=
LOG_LEVEL=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
RESEND_API_KEY=
SENTRY_DSN=
VITE_SENTRY_DSN=
```

## 11. Logs y errores

- No loggear tokens, contraseñas, cookies ni datos personales completos.
- Errores `500` con mensaje genérico al cliente.
- Logs estructurados con request id y user id (sin email).
- Sentry u otro sistema de errores con scrubbing de datos sensibles.

## 12. Privacidad

- Leaderboards: nombre visible e identificador público, nunca email.
- Leaderboard global con opt-in.
- Permitir eliminar cuenta y datos asociados.
- Documentar retención de refresh tokens y logs.
- No usar datos reales en entornos de demo/test.

## 13. Checklist de seguridad por PR

- [ ] No hay secretos en el diff.
- [ ] Toda ruta nueva valida entrada con Zod.
- [ ] Toda consulta nueva filtra por propietario.
- [ ] Los errores no filtran detalles internos.
- [ ] Las mutaciones nuevas tienen rate limit si son sensibles.
- [ ] Las cookies mantienen `httpOnly` y `secure` en producción.
- [ ] No se introduce `localStorage` para tokens.
- [ ] Se revisan dependencias nuevas.
