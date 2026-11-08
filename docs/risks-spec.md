# Registro de riesgos — StudyLogV2

| # | Riesgo | Impacto | Prob. | Mitigación | Fase |
|---|---|---|---|---|---|
| R1 | **Caché write-behind** provoca pérdida o duplicación de sesiones | Alto | Media | No usarla. UI optimista + TanStack Query + debounce 800–1200 ms + flush + `Idempotency-Key` + Postgres como verdad. Reconciliación y rollback visibles | 2 |
| R2 | **Express en Vercel** no encaja (cold start, body limit, nativos, tiempo máximo) | Alto | Media | Spike timeboxed en Fase 0; handlers finos; pool pequeño; módulos nativos verificados; plan B: separar web y API con CORS y cookies entre dominios | 0 |
| R3 | **Plan Hobby no comercial** incumplido al monetizar | Alto | Media | Revisar términos antes de cobrar; presupuesto para Pro; alternativa de hosting documentada | 0, 6 |
| R4 | **Cold starts** y latencia en serverless | Medio | Alta | Región co-location con la DB, conexión pooled, bundle pequeño, evitar dependencias pesadas; en Pro, mínimos de instancia | 0, 6 |
| R5 | **Timezone/DST** rompe rachas y series semanales | Medio | Alta | Guardar UTC, calcular en zona IANA del usuario, tests de DST, ventana UTC fija y documentada para leaderboard | 2, 5 |
| R6 | **Leaderboard** lento o inconsistente | Medio | Media | Índices, vista materializada o agregado, caché 30–60 s con invalidación al escribir, top 50, `EXPLAIN ANALYZE` | 5, 6 |
| R7 | **Diseño “AI slop”** y landing genérica | Medio | Alta | Copy primero, UI real, sistema visual único, gate `design-taste-frontend` hasta GATE PASS, revisión humana | 4 |
| R8 | **ReactBits** añade peso, licencia dudosa o JS inseguro | Medio | Media | Auditoría humana, vendorización, licencia registrada, lazy load, fallback, prueba sin el chunk | 4 |
| R9 | **Auth insegura** (XSS, CSRF, tokens expuestos) | Crítico | Baja/Media | Cookies `httpOnly`/`Secure`/`SameSite`, rotación con detección de reuso, rate limit, validación de `Origin`, CSP, auditoría de deps | 1, 6 |
| R10 | **Scope creep** retrasa el MVP | Alto | Alta | Fases 0–4 como MVP; Fase 5 post-MVP; issues pequeños; cambios de alcance solo con decisión explícita | Todas |
| R11 | **Rate limit en memoria** evadible entre instancias serverless | Medio | Media | Límites por IP+usuario, Upstash/DB para auth si se detecta abuso, monitoreo de 429 | 1, 6 |
| R12 | **Duplicados por reintentos** de red | Alto | Media | `Idempotency-Key` persistida antes del POST, unicidad `(user_id, key)`, TTL y limpieza | 2, 3 |
| R13 | **Migraciones** en arranque o concurrentes | Alto | Media | Migrar en CI/CD con conexión directa, expand/contract, backup previo, nunca en el boot de la función | 0, 6 |
| R14 | **Fugas de datos** entre usuarios (IDOR) | Crítico | Media | Ownership en cada consulta, 404 en vez de 403, tests A/B, revisión de Spec | 1–5 |
| R15 | **Conflictos de merge** entre agentes | Medio | Alta | Un agente por rama/worktree, matriz de propiedad, PRs pequeños, rebase diario | Todas |
| R16 | **Coste/límites de DB** (conexiones, almacenamiento) | Medio | Media | Pooled en runtime, conexión directa solo en CI, límites de rango en stats, limpieza por cron | 2, 6 |
| R17 | **Pérdida de datos** por falta de backups probados | Crítico | Baja | Backups automáticos, restore drill en staging, runbook documentado | 6 |

## Riesgos de producto

| # | Riesgo | Mitigación |
|---|---|---|
| P1 | El usuario percibe el registro manual como fricción | Pomodoro integrado, autocompletado y edición rápida |
| P2 | Las gráficas no aportan decisiones | Mostrar progreso por asignatura, objetivos y rachas; evitar gráficas decorativas |
| P3 | La capa social se construye antes de validar el MVP | Fase 5 bloqueada hasta cerrar Fase 4 |
| P4 | La landing promete funciones que aún no existen | Rachas/leaderboard se presentan como evolución, no como disponibles |
| P5 | Datos de demo se confunden con datos reales | Etiqueta visible “Datos de demostración” |

## Seguimiento

- Revisar este registro al cerrar cada fase.
- Añadir riesgos nuevos con el mismo formato.
- Actualizar `plan.md` si cambia una mitigación o una fase.
