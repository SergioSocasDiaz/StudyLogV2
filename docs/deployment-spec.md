# Especificación de despliegue — StudyLogV2

## 1. Topología preferida

Un **solo proyecto Vercel** que sirve:

- La SPA React compilada como sitio estático.
- La API Express como función serverless bajo `/api`.

Ventajas:

- Mismo origen para web y API.
- Cookies `httpOnly` sin CORS ni `SameSite=None`.
- Menos configuración y menos superficie de error.

Si el spike de Fase 0 falla, separar en dos proyectos:

- `studylog-web` (estático).
- `studylog-api` (serverless).
- Ajustar CORS con allowlist, `credentials: true`, cookies `SameSite=None; Secure` y validación CSRF.

## 2. Express en Vercel

- `api/index.ts` exporta la app Express.
- La app debe ser stateless: sin memoria compartida, sin websockets y sin procesos en background.
- Handlers finos; lógica en servicios.
- Validar en el spike:
  - Cold start aceptable.
  - Límite de body.
  - Módulos nativos (argon2).
  - Tiempo máximo de ejecución.
  - Pool de conexiones.
  - Cookies same-origin.
  - `requestId` y logs.

Ejemplo orientativo de `vercel.json` (validar en Fase 0):

```json
{
  "buildCommand": "pnpm --filter web build",
  "outputDirectory": "apps/web/dist",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index" }
  ]
}
```

## 3. Base de datos

- Postgres gestionado en **Neon** o **Supabase**.
- Runtime: cadena **pooled**.
- Migraciones y backups: cadena **directa** (`DATABASE_URL_UNPOOLED`).
- No crear un pool por petición; cachear el cliente a nivel de módulo.
- Revisar límites de conexiones y almacenamiento del plan gratuito.
- Región de la DB lo más cercana posible a la región de las funciones.

## 4. Variables de entorno

| Variable | Entorno | Uso |
|---|---|---|
| `DATABASE_URL` | API / CI | Conexión pooled en runtime |
| `DATABASE_URL_UNPOOLED` | CI / migraciones | Conexión directa para migraciones y backups |
| `JWT_ACCESS_SECRET` | API | Firma del access token |
| `ACCESS_TOKEN_TTL` | API | Minutos de vida del access token |
| `REFRESH_TOKEN_TTL_DAYS` | API | Días de vida del refresh token |
| `APP_ORIGIN` | API / web | Origen canónico para cookies, redirects y validación de `Origin` |
| `NODE_ENV` | Todos | `development` / `test` / `production` |
| `LOG_LEVEL` | API | Nivel de logs |
| `SENTRY_DSN` | Producción | Errores de API |
| `VITE_SENTRY_DSN` | Producción | Errores de web |
| `UPSTASH_REDIS_REST_URL` | Opcional | Rate limit distribuido / caché |
| `UPSTASH_REDIS_REST_TOKEN` | Opcional | Token de Upstash |
| `VITE_API_BASE_URL` | Solo si se separan web y API | Base de la API en el cliente |
| `RESEND_API_KEY` | Opcional | Recuperación de contraseña / emails |

Reglas:

- `.env.example` documenta las variables sin valores reales.
- `.env*` reales están en `.gitignore`.
- Secretos solo en Vercel/GitHub Secrets.
- Separar entornos Development, Preview y Production.

## 5. Migraciones

- `drizzle-kit generate` y `drizzle-kit migrate`.
- Ejecutar en CI/CD con conexión directa; **nunca al arrancar la función**.
- Estrategia expand/contract para cambios incompatibles.
- Backup antes de migraciones destructivas.
- Probar migración y rollback en preview.
- No ejecutar migraciones concurrentes desde varias instancias.
- Limpiar tokens e idempotencia caducados por cron.

## 6. CI/CD

GitHub Actions:

```text
install → lint → typecheck → test → build
```

Job separado:

```text
e2e: Postgres service → migrate → seed → Playwright
```

Despliegue:

- Preview por PR.
- `develop` → preview/staging.
- `main` → producción.
- Migraciones antes del deploy de producción, con backup.
- Smoke test tras deploy: `/api/health`, landing y login.

## 7. Preview y entornos

- Cada PR tiene preview de Vercel.
- Base de datos de preview:
  - Branch de Neon, o
  - Esquema/base dedicada.
- Evitar que previews compartan datos de producción.
- Migraciones de preview probadas antes de producción.
- Seeds de demo marcados como demo.

## 8. Cron y tareas programadas

- Vercel Cron o QStash para:
  - Refresco de leaderboard/agregados.
  - Limpieza de refresh tokens e idempotencia.
  - Evaluación de emblemas retroactivos.
- No usar `setInterval` ni memoria de instancia.
- Revisar límites del plan gratuito.

## 9. Observabilidad

- Logs estructurados con `requestId`, `userId` (sin PII sensible), ruta, estado, duración y errores.
- Sentry en web y API, con source maps y release etiquetado.
- Uptime externo sobre `/api/health` y landing.
- Métricas de DB: conexiones, latencia, consultas lentas.
- Alertas mínimas: 5xx, latencia p95, healthcheck, agotamiento de conexiones.
- No loggear tokens, contraseñas, cookies ni emails completos.

## 10. Backups y rollback

- Backups automáticos del proveedor.
- Probar restore en staging, no solo confiar en el backup.
- Runbook de rollback:
  1. Promover el deployment anterior en Vercel.
  2. Rollback de migración si aplica (expand/contract).
  3. Invalidar caché si aplica.
  4. Verificar `/api/health` y flujo de login.
  5. Comunicar el incidente.
- Documentar el runbook en `docs/` y actualizarlo en Fase 6.

## 11. Dominio, SEO y analítica

- Dominio propio con HTTPS.
- Redirecciones canónicas.
- `robots.txt`, `sitemap.xml`, Open Graph y Twitter Card.
- Analytics respetuoso con la privacidad (Plausible/Umami o Vercel Analytics), sin PII.
- Consentimiento si la analítica lo requiere.

## 12. Límites y riesgos de Vercel

- **Plan Hobby no comercial**: revisar términos antes de monetizar.
- Cold starts en serverless.
- Límite de duración de función.
- Límite de tamaño de request/response.
- Sin websockets ni procesos persistentes.
- Sin caché en memoria compartida.
- Límites de build y ancho de banda.
- Los límites concretos cambian; verificarlos en la documentación vigente antes de production.

## 13. Checklist de producción

- [ ] Variables de entorno configuradas en Production y Preview.
- [ ] Secretos fuera del repo.
- [ ] Migraciones aplicadas con backup.
- [ ] Restore probado.
- [ ] `/api/health` responde y comprueba la DB.
- [ ] Cookies `httpOnly`/`Secure`/`SameSite` correctas.
- [ ] CORS/CSRF correctos.
- [ ] Rate limiting activo.
- [ ] Sentry y logs funcionando.
- [ ] Backups automáticos activos.
- [ ] Dominio y HTTPS.
- [ ] SEO/OG correctos.
- [ ] Preview y producción probadas.
- [ ] Runbook de rollback documentado.
- [ ] Términos del plan Hobby revisados.
