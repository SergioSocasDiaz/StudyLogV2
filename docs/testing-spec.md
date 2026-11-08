# Especificación de testing — StudyLogV2

## 1. Objetivos

- Detectar regresiones en flujos críticos: auth, ownership, sesiones, estadísticas y Pomodoro.
- Verificar que los datos no se duplican ni se pierden.
- Probar cálculos sensibles a zona horaria y DST.
- Mantener la UI accesible y sin errores visuales graves.
- Dar confianza antes de la revisión humana y del merge a `develop`.

## 2. Herramientas

- **Vitest** para unitarios e integración.
- **React Testing Library** para componentes y hooks.
- **Supertest** para la API Express.
- **MSW** para simular la API en tests de frontend.
- **Playwright** para E2E.
- **axe-core** (opcional) para accesibilidad automatizada.
- **Postgres real en Docker** para integración de API.

## 3. Capas de prueba

### 3.1 Unitarias

- Cálculo de duración y validaciones de fechas.
- Cálculo de rachas y series semanales.
- Agregados por asignatura.
- Máquina de estados del Pomodoro.
- Utilidades de fechas/timezone.
- Validaciones Zod compartidas.
- Normalización de colores y nombres.

### 3.2 Integración de API

- Supertest contra Express + Postgres real.
- Registro, login, refresh, logout y reutilización de refresh.
- Ownership: usuario A no lee ni modifica recursos de B.
- CRUD de asignaturas y sesiones.
- Idempotencia: misma clave + mismo payload; misma clave + payload distinto.
- Paginación estable.
- Solapamientos y duraciones inválidas.
- Rate limiting.
- Estadísticas con rangos y zonas horarias.
- Migraciones aplicadas en la base de test.

### 3.3 Componentes

- Formularios de login/registro con errores inline.
- Rutas protegidas y refresh silencioso.
- Lista y edición de asignaturas.
- Dashboard con datos, vacío, carga y error.
- Timer del Pomodoro con reloj falso.
- Modal accesible: foco, Escape, restauración.
- Gráficas con fallback textual.

### 3.4 E2E

Flujos mínimos:

1. Registro → login → crear asignatura → recargar → sesión mantenida.
2. Crear sesión manual → aparece en dashboard y totales → editar → eliminar.
3. Iniciar Pomodoro → navegar → recargar → completar → una sola sesión creada.
4. Reintentar creación con la misma `Idempotency-Key` → no duplica.
5. Landing → CTA → registro.
6. Post-MVP: amistad → leaderboard visible según privacidad.

### 3.5 Visual y accesibilidad

- Capturas en 1440, 1024, 768 y 390 px.
- Gate de `design-taste-frontend` para la landing.
- `@web-design-guidelines` en cada PR de UI.
- Navegación por teclado en flujos principales.
- Contraste, foco visible, labels y `aria-live`.
- `prefers-reduced-motion`.

### 3.6 Rendimiento

- `perf` del skill de diseño sin FAIL.
- Lighthouse o equivalente para la landing.
- Presupuesto orientativo: LCP < 2.5 s, CLS < 0.1, INP < 200 ms.
- Revisar bundle de Recharts y ReactBits.

## 4. Comandos

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter api test -- src/routes/auth.test.ts
pnpm --filter web test -- src/features/pomodoro/Timer.test.tsx
pnpm test:e2e
pnpm test:e2e -- tests/auth.spec.ts
pnpm build
docker compose -f infra/docker-compose.yml up -d db
pnpm db:migrate
pnpm db:seed
```

## 5. Base de datos de test

- Usar Postgres real en Docker, no mocks para integración.
- Aislar tests por transacción, esquema o base de datos dedicada.
- Aplicar migraciones antes de la suite.
- Seed mínimo y determinista.
- Nunca usar datos de producción.
- Limpiar `idempotency` y tokens entre tests cuando aplique.

## 6. Fixtures y datos

- Factories para usuarios, asignaturas y sesiones.
- Fechas fijas y zonas horarias explícitas.
- Casos de DST: `Europe/Madrid` y `America/New_York`.
- Datos de demo de la landing marcados como demo.
- No incluir emails reales, tokens reales ni secretos.

## 7. CI

Orden obligatorio:

```text
install → lint → typecheck → test → build
```

Job separado:

```text
e2e: Postgres service → migrate → seed → Playwright
```

Reglas:

- `--frozen-lockfile`.
- Cache de pnpm.
- Artefactos de test y trazas E2E en fallo.
- CI verde obligatorio antes de revisión humana.
- No mergear con tests rojos o flaky sin justificación.

## 8. Tests flaky

- Un test flaky se investiga; no se ignora.
- Evitar esperas arbitrarias; usar condiciones observables.
- Aislar el estado entre tests.
- Reintentos de CI solo como diagnóstico, no como solución permanente.
- Documentar cualquier test excluido y su motivo.

## 9. Cobertura

- No usar la cobertura como sustituto de pruebas de comportamiento.
- Priorizar rutas críticas y casos de borde.
- Si se fija un umbral, que sea sobre lógica de negocio, no sobre líneas triviales.
- Revisar que los tests fallan cuando el comportamiento se rompe.

## 10. Definition of Done de testing

- [ ] Tests unitarios de lógica nueva.
- [ ] Tests de integración de API si cambia el contrato o la DB.
- [ ] Test de ownership si se añade un recurso.
- [ ] Test de idempotencia si se añade una escritura reintentable.
- [ ] Test de timezone/DST si se toca una fecha o racha.
- [ ] E2E si cambia un flujo de usuario.
- [ ] Accesibilidad revisada si hay UI.
- [ ] Gate visual/perf si es landing o cambio visual relevante.
- [ ] CI verde y sin flaky conocidos.
- [ ] `@code-review` ejecutado antes de la revisión humana.

## 11. Definition of Done general

Aplica a toda tarea, con independencia de la fase:

- [ ] **Criterios de aceptación** del issue cumplidos y verificables.
- [ ] **Lint y typecheck** sin errores (`pnpm lint`, `pnpm typecheck`).
- [ ] **Tests unitarios y de integración** añadidos o actualizados y pasando.
- [ ] **E2E** actualizado si el cambio afecta un flujo de usuario.
- [ ] **Sin secretos** en código, logs, fixtures ni capturas.
- [ ] **Contrato actualizado** en `packages/shared` si cambia la API (PR propio si es transversal).
- [ ] **Migración probada** en local y en preview, con rollback conocido.
- [ ] **`@code-review`** ejecutado contra `develop` con el issue como spec; hallazgos resueltos o justificados.
- [ ] **`@web-design-guidelines`** y gate de `design-taste-frontend` si hay UI.
- [ ] **Preview de Vercel** funcionando con el flujo principal.
- [ ] **Aprobación humana** y CI verde antes del merge.
- [ ] **Documentación** relevante actualizada (README, `AGENTS.md`, `docs/`) si cambian comandos o comportamiento.

## 12. Definition of Done por fase

| Fase | Unit / integración | E2E | Migración | Contrato | Revisión UI / gate | Preview |
|---|---|---|---|---|---|---|
| 0. Fundación | Tooling y healthcheck | Smoke de carga y health | Inicial + seed | v0 congelado | — | Sí (spike) |
| 1. Auth + asignaturas | Auth, ownership, rate limit | Registro → login → crear asignatura → recarga | `users`, `refresh_tokens`, `subjects` | Auth + subjects | Guidelines en formularios | Sí |
| 2. Sesiones + dashboard | CRUD, idempotencia, stats, debounce | Crear/editar/eliminar y ver totales | `study_sessions` | Sessions + stats | Guidelines + gate visual | Sí |
| 3. Pomodoro | Reducer, reloj, persistencia, finalización única | Temporizador sobrevive recarga y crea una sesión | Ninguna nueva | Session create (reutiliza) | Modal accesible + gate | Sí |
| 4. Landing + pulido | Componentes y SEO | CTA a registro y navegación | Ninguna | Ninguno | `design-taste-frontend` GATE PASS + guidelines | Sí |
| 5. Social | Privacidad, bloqueos, badges idempotentes | Amistad → ranking visible según privacidad | Social + agregados | Social + leaderboard | Guidelines + gate | Sí |
| 6. Producción | Seguridad y observabilidad | Smoke de producción | Verificadas + restore | Congelado | Auditoría final | Producción |
