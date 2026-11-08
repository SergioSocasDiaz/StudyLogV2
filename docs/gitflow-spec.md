# Especificación de Gitflow y revisión — StudyLogV2

## 1. Modelo de ramas

```text
main        ●──────────────●────────●   (producción, releases/hotfix)
             \            /        /
develop       ●──●──●──●──●────────●     (integración)
               \  \  \
          feature  feature  feature
```

| Rama | Propósito | Reglas |
|---|---|---|
| `main` | Producción | Solo releases y hotfixes; protegida |
| `develop` | Integración | Recibe PRs de features y fixes; protegida |
| `feature/<ticket>-<slug>` | Nueva funcionalidad | Sale de `develop`, PR a `develop` |
| `fix/<ticket>-<slug>` | Corrección no urgente | Sale de `develop`, PR a `develop` |
| `release/<version>` | Estabilización | Sale de `develop`; merge a `main` y back-merge a `develop` |
| `hotfix/<version>` | Corrección urgente | Sale de `main`; merge a `main` y a `develop` |

Reglas:

- Nada se commitea directamente a `main` ni a `develop`.
- PRs a `develop` con **squash merge** y borrado de rama.
- Release: `develop` → `main` → back-merge a `develop`.
- Hotfix: `main` → `main` y `develop`.
- Un PR enlaza su issue (`Closes #123`) y no mezcla refactors ajenos.
- Un agente por rama y por worktree; nunca dos agentes en la misma rama.

## 2. Convención de commits

Usar Conventional Commits:

```text
feat(web): add subject color picker
fix(api): reject overlapping study sessions
chore(ci): add postgres service to e2e job
docs: update api spec
refactor(pomodoro): extract timer reducer
test(api): cover refresh token reuse
```

Tipos habituales: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `build`, `ci`.

## 3. Flujo obligatorio de un agente

1. Crear rama desde `develop`.
2. Implementar una porción vertical pequeña.
3. Ejecutar:
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm build
   ```
   Y el E2E correspondiente si toca flujo crítico.
4. Revisar el diff propio y actualizar `AGENTS.md`/docs si cambian comandos o convenciones.
5. Ejecutar `@code-review` con punto fijo `develop` y el issue de GitHub como spec.
   - El skill lanza **Standards** y **Spec** en paralelo.
   - Pegar/resumir los hallazgos en el PR.
   - Corregir o justificar cada uno.
6. Para UI, ejecutar `@web-design-guidelines` y el gate de `design-taste-frontend`.
7. Abrir PR a `develop` con la plantilla.
8. CI verde + preview de Vercel funcionando.
9. Revisión humana y merge.

**Ningún agente fusiona sin aprobación humana.**

## 4. Revisión con `@code-review`

- **Punto fijo**: `develop` (`git diff develop...HEAD`).
- **Spec**: issue de GitHub enlazado en el PR.
- **Ejes**:
  - **Standards**: ¿cumple los estándares del repo y el baseline de smells?
  - **Spec**: ¿implementa lo que pedía el issue?
- Se ejecutan en subagentes separados para no contaminar contextos.
- Cada informe debe ser breve (orientativamente < 400 palabras).
- Los hallazgos se corrigen o se justifican por escrito en el PR.
- Si no hay spec, el eje Spec se omite y se indica en el PR.
- `@code-review` no sustituye a los tests ni a la revisión humana.

## 5. Revisión de UI

Antes de pedir revisión humana de una tarea de UI:

1. `@web-design-guidelines` sobre los archivos cambiados, con salida `file:line`.
2. Gate de `design-taste-frontend` para la landing:
   - `copy-lint`
   - `consistency`
   - `check`
   - `perf`
3. Capturas en 1440, 1024, 768 y 390 px.
4. Revisión de teclado, foco, contraste y `prefers-reduced-motion`.

No se acepta `GATE: OPEN` por comodidad; debe justificarse impacto y responsable.

## 6. Plantilla de PR

```markdown
## Qué
...

## Por qué
Closes #123

## Cambios
- ...

## Cómo probar
1. ...
2. ...

## Capturas / vídeo (UI)
...

## Contrato / API
...

## Migración / rollback
...

## Riesgo
...

## Revisión
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] E2E si aplica
- [ ] `@code-review` contra `develop`
- [ ] Hallazgos corregidos o justificados
- [ ] `@web-design-guidelines` / gate de diseño si UI
- [ ] Preview de Vercel revisada
```

## 7. Protección de ramas

`main` y `develop`:

- PR obligatorio.
- 1 aprobación humana.
- Checks requeridos: lint, typecheck, test, build.
- Sin force push.
- Conversaciones resueltas.
- Historial lineal (squash merge).
- Rama actualizada antes del merge.

## 8. Releases

- `release/<version>` se crea desde `develop` cuando el MVP está estable.
- Solo bugfixes y ajustes de release; no features nuevas.
- Se prueba en preview/staging.
- Merge a `main`, tag `vX.Y.Z`, deploy a producción.
- Back-merge a `develop`.
- Release notes con cambios relevantes.

## 9. Hotfixes

- `hotfix/<version>` desde `main`.
- Corrección mínima y testeada.
- Merge a `main` y a `develop`.
- Tag y deploy.
- Si el hotfix afecta a una migración, probar restore/rollback.

## 10. Paralelización y worktrees

### 10.1 Dependencias entre fases

```text
Fase 0 (fundación + contrato v0)
   └── Fase 1
         ├── auth-api ──► auth-ui
         └── subjects-api ──► subjects-ui
               └── Fase 2
                     ├── sessions-api ──► stats-api ──► dashboard-ui
                     └── (contrato de stats antes de dashboard-ui)
                           └── Fase 3 (pomodoro; depende de sessions-api)
                                 └── Fase 4 (landing + a11y)
                                       └── Fase 5 (post-MVP)
                                             └── Fase 6 (producción)
```

Dependencias duras:

- **Fase 0 la ejecuta un solo agente.** Es la base y toca todos los archivos de configuración.
- `auth-ui` depende del contrato y de los endpoints de `auth-api` (puede avanzar con MSW una vez congelado el contrato).
- `subjects-ui` depende de `subjects-api` y de `auth-ui` (sesión y rutas protegidas).
- `stats-api` depende del modelo de `sessions-api`.
- `dashboard-ui` depende del contrato de `stats-api` y de UI de sesiones.
- `pomodoro` depende de `sessions-api` (creación idempotente).
- `landing` depende de la UI real del dashboard (capturas y enlaces).
- Fase 5 depende del MVP cerrado; Fase 6 de la Fase 5 si se incluye, o de la Fase 4 si se decide publicar sin social.

### 10.2 Reglas de paralelización

1. **Después de congelar contratos** (Fase 0) se puede paralelizar API, UI y landing.
2. **Un agente por rama/worktree.** Nunca dos agentes en la misma rama.
3. **No tocar los mismos archivos en paralelo** (ver matriz §10.3).
4. **Cambios de contrato en PR propio** (`chore/contract-<slug>`) a `develop`; el resto de ramas hacen rebase después.
5. **Un solo dueño del lockfile.** Solo un agente ejecuta `pnpm add`/`pnpm install` a la vez; el resto espera y hace rebase.
6. **Migraciones secuenciales.** Un owner por fase; nombres con timestamp; rebase antes de generar una nueva migración para evitar colisiones.
7. **Integración diaria.** Las ramas largas se rebasan sobre `develop` al menos una vez al día.
8. **Trabajo en worktrees separados** para evitar cambios de rama bajo los pies de otro agente.

### 10.3 Matriz de propiedad de archivos

| Zona | Dueño | Regla |
|---|---|---|
| `packages/shared/**` | Agente de contrato | Solo PRs de contrato; avisar en el issue |
| `pnpm-lock.yaml`, `package.json` raíz | Agente designado de tooling | Un solo `pnpm add` a la vez |
| `apps/api/src/app.ts`, `server.ts`, middleware | Agente de API | La UI no los toca |
| `apps/api/src/db/schema.ts`, `drizzle/**` | Agente de API de la fase | Migraciones de una en una |
| `apps/web/src/app/router.tsx`, providers | Agente de web | Features no editan el router sin coordinar |
| `apps/web/src/features/<feature>/**` | Agente de esa feature | Aislamiento por carpeta |
| `.github/workflows/**` | Agente de fundación/CI | Cambios con PR propio |
| `docs/**`, `README.md`, `AGENTS.md` | Agente de documentación | Sin conflictos con features |
| `apps/web/src/index.css`, tokens de diseño | Agente de diseño | Un solo dueño del sistema visual |

### 10.4 Secuencia recomendada

1. Fase 0 con un agente.
2. En paralelo: `auth-api` y `subjects-api` (contratos ya congelados); después `auth-ui` y `subjects-ui`.
3. En paralelo: `sessions-api` y el contrato de `stats-api`; luego `stats-api` y `dashboard-ui`.
4. `pomodoro` cuando `sessions-api` esté en `develop`.
5. `landing` puede empezar el plan de diseño y el copy en paralelo con la Fase 3, pero la maquetación final espera a la UI real.
6. `a11y-polish` al final de la Fase 4, con la UI congelada.

## 11. Plantilla de tarea para agente

Copiar en el issue o en el prompt del agente. Rellenar todos los campos; si falta uno, la tarea no está lista.

````markdown
## Contexto
<Por qué existe esta tarea, qué problema resuelve y qué decisión previa la enmarca.
Enlaces a docs/plan.md, docs/*-spec.md e issues relacionados.>

## Rama
- Nombre: `feature/<ticket>-<slug>` | `fix/<ticket>-<slug>` | `chore/<slug>`
- Base: `develop`
- Worktree: `<ruta>` (un agente por worktree)

## Alcance
- <Punto 1: comportamiento observable>
- <Punto 2>
- <Punto 3>

## Fuera de alcance
- <Lo que NO se debe tocar en esta tarea>
- <Refactors, dependencias o pantallas excluidas>

## Contrato / API
- Endpoints: <método, ruta, request, response, códigos>
- Esquemas Zod en `packages/shared`: <nombres>
- Errores: <códigos y cuándo se devuelven>
- Idempotencia: <si aplica, header y semántica>
- Migración: <tabla(s), columnas, índices, si aplica>

## Criterios de aceptación
- [ ] <Criterio verificable 1>
- [ ] <Criterio verificable 2>
- [ ] <Criterio de autorización: usuario A no accede a B>
- [ ] <Criterio de accesibilidad si hay UI>

## Archivos esperados
- `apps/api/src/routes/<...>.ts`
- `apps/api/src/db/schema.ts`
- `packages/shared/src/<...>.ts`
- `apps/web/src/features/<...>/<...>.tsx`
- `<tests>`

## Comandos de verificación
```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter api test -- src/routes/<archivo>.test.ts
pnpm --filter web test -- src/features/<...>/<...>.test.tsx
pnpm build
# E2E si aplica:
pnpm test:e2e -- tests/<archivo>.spec.ts
```

## Revisión UI
- [ ] `@web-design-guidelines` sin bloqueantes
- [ ] Gate `design-taste-frontend` (`copy-lint`, `consistency`, `check`, `perf`) en GATE PASS
      o OPEN justificado por escrito
- [ ] Teclado, foco, contraste y `prefers-reduced-motion` verificados

## Revisión final
- [ ] `@code-review` con punto fijo `develop` y este issue como spec
- [ ] Hallazgos de Standards y Spec corregidos o justificados
- [ ] CI verde + preview de Vercel + aprobación humana
````

## 12. Reglas de merge

- Orden recomendado: contratos → API → UI → landing.
- Resolver conflictos en la rama, no en `develop`.
- No mergear con CI rojo, preview rota o hallazgos bloqueantes sin justificar.
- Tras el merge, borrar la rama y actualizar el issue.
- Actualizar `docs/` y `AGENTS.md` en el mismo PR si cambia el comportamiento o los comandos.

## 13. Checklist de cierre de fase

Una fase no se considera cerrada hasta que se cumplen todos estos puntos:

- [ ] Todas las ramas de la fase están fusionadas en `develop` con squash merge.
- [ ] El contrato está congelado y documentado; no quedan cambios pendientes en `packages/shared`.
- [ ] Las migraciones están aplicadas y probadas en el entorno de preview.
- [ ] CI verde en `develop` y E2E del flujo crítico pasando.
- [ ] `@code-review` y las revisiones de UI están cerradas sin hallazgos bloqueantes.
- [ ] La preview de Vercel ha sido revisada y aprobada por una persona.
- [ ] `AGENTS.md` y la documentación afectada están actualizados.
- [ ] Los riesgos de la fase se han revisado y actualizado en `risks-spec.md`.
- [ ] La salida de fase definida en `plan.md` se cumple de forma verificable.
