# Especificación de UI y diseño — StudyLogV2

## 1. Dirección visual

Referencia estructural: **expo.dev** (tipografía grande, hero oscuro, producto real, CTA claro). No se copia su código, copy, imágenes ni efecto firma.

Tipo de página según `design-taste-frontend`: **software**. Eso permite un efecto/hero técnico, pero con moderación.

Objetivo: una landing que parezca de una empresa real, con UI real del producto, y una app interna clara, rápida y accesible. Evitar el aspecto de plantilla o de dashboard genérico.

## 2. Proceso de diseño

Antes de escribir la landing:

1. Hacer el **plan de diseño** con `@frontend-design`: paleta, tipografía, layout, principios y crítica contra los defaults genéricos.
2. Ejecutar los scripts de deal del skill para elegir paleta/tipografía, en lugar de elegir “a ojo”.
3. Escribir todo el copy primero.
4. Construir y pasar el **gate** de `design-taste-frontend` hasta `GATE: PASS` o justificar los `OPEN`.
5. Aplicar `@web-design-guidelines` sobre los archivos cambiados.

## 3. Sistema visual

### 3.1 Tokens

Usar tokens semánticos en Tailwind v4 (`@theme`):

```css
--color-bg
--color-surface
--color-surface-raised
--color-ink
--color-ink-muted
--color-accent
--color-accent-ink
--color-success
--color-warning
--color-danger
--color-border
--radius-sm
--radius-md
--radius-lg
--shadow-card
--font-display
--font-body
--duration-fast
--duration-base
```

Requisitos:

- Una sola escala de radios.
- Un solo estilo de tarjeta.
- Un solo par de botones (primario/secundario).
- Un solo estilo de enlace.
- Contraste WCAG AA como mínimo.
- Nada de violeta/lavanda en el diseño propio.
- Paleta de asignaturas segura para daltonismo; el color no es la única señal.

### 3.2 Tipografía

- Máximo dos familias: una display y una de texto, o una sola bien explotada.
- Escala tipográfica intencional; evitar defaults sin jerarquía.
- Evitar los tratamientos que el skill marca como genéricos: acento de una sola palabra, todo en mayúsculas para labels, eyebrows innecesarios.
- Cargar solo los pesos usados y con `font-display: swap`.

### 3.3 Layout

- Contenedor con ejes izquierdo/derecho iguales.
- Una sección por pantalla en la landing; el hero ocupa la primera pantalla solo.
- Nada de scroll-jacking, parallax en texto ni fade-in en cada sección.
- Responsive real a 390, 768, 1024 y 1440 px; sin overflow a 320 px.
- Objetivos táctiles de 44px fuera de texto corrido.

## 4. Landing

### 4.1 Secciones

1. **Hero**: qué es StudyLog, para quién, CTA y dashboard real. Un dato duro en la primera pantalla.
2. **Problema**: las horas se pierden; el progreso no se ve.
3. **Tour del producto**: dashboard, asignaturas con color, gráficas y Pomodoro.
4. **Cómo funciona**: 3 pasos reales (crear asignaturas → registrar o usar Pomodoro → ver progreso).
5. **Rachas y leaderboard**: evolución social del producto.
6. **CTA final + footer**.

### 4.2 Reglas de copy

- Copy en español, claro y específico.
- El h1 nombra la categoría y el usuario o el beneficio.
- Botones con verbo + objeto (“Crear cuenta”, “Ver mi progreso”).
- Sin superlativos vacíos, sin “potencia”, “revoluciona”, “supercarga”.
- Sin testimonios, métricas, clientes o resultados inventados.
- Si se usan datos de demo, marcarlos como demo dentro de la UI.
- Créditos de imágenes en una sola línea de footer; nunca captions debajo de una imagen.

### 4.3 Reglas visuales

- El hero muestra UI real del producto, no una ilustración genérica.
- Sin captions ni descripciones debajo de imágenes, renders o visuales.
- Sin placeholders ni direcciones de ejemplo visibles.
- Un solo efecto/hero técnico; el resto, sistema visual disciplinado.
- Hover/press visibles en botones, enlaces y tarjetas enlazadas.
- Entrada del hero una vez al cargar.
- Movimiento reducido respetado.

## 5. Autenticación

### 5.1 Login

- Email, contraseña, mostrar/ocultar contraseña.
- “¿Olvidaste tu contraseña?” solo si la fase lo incluye; si no, no mostrar enlace muerto.
- Error genérico de credenciales.
- CTA a registro.
- `autocomplete="email"` y `autocomplete="current-password"`.

### 5.2 Registro

- Nombre visible, email, contraseña, confirmación si se decide, zona horaria.
- Requisitos de contraseña visibles antes de enviar.
- Errores inline.
- CTA a login.
- `autocomplete="new-password"`.

### 5.3 Layout

- Split layout en desktop; una columna en móvil.
- Visual del producto o abstracción de tiempo/estudio, no una foto de stock genérica.
- Foco visible y navegación por teclado.

## 6. Dashboard

### 6.1 Cabecera

- Total de hoy/semana, racha y objetivo.
- Acción principal: registrar sesión o iniciar Pomodoro.
- Selector de rango si aplica.

### 6.2 Componentes

- Tarjetas de estadísticas.
- Gráfica semanal (Recharts) con tabla accesible alternativa.
- Desglose por asignatura con color + nombre.
- Lista de sesiones recientes con editar/eliminar.
- Estado vacío que invita a crear la primera asignatura.
- Skeletons de carga y errores con reintento.

### 6.3 Asignaturas

- Tarjetas o filas con color, nombre y horas.
- Crear/editar en modal o panel lateral.
- Selector de color con paleta accesible.
- Archivar con confirmación; no borrar historial.

### 6.4 Historial

- Lista paginada o virtualizada.
- Filtros por fecha y asignatura.
- Edición y borrado con confirmación.
- Fechas en la zona horaria del usuario.

## 7. Pomodoro

- Modal accesible (`<dialog>` o Radix Dialog).
- Estados: `idle`, `focus`, `paused`, `break`, `completed`.
- Tiempo restante calculado desde `endsAt` y `Date.now()`.
- Selector de asignatura antes de iniciar.
- Botones: iniciar, pausar, reanudar, reiniciar, saltar descanso, guardar.
- Persistencia en `localStorage` y recuperación al recargar.
- Notificación al terminar; fallback a título/audio si se deniega el permiso.
- Focus trap, Escape y restauración de foco.
- No anunciar cada segundo con `aria-live`; anunciar hitos.
- Respetar `prefers-reduced-motion`.

## 8. Leaderboard y emblemas (post-MVP)

- Ranking semanal de amigos y global.
- Fila: posición, nombre visible, horas, racha.
- No mostrar email ni datos privados.
- Global con opt-in.
- Emblemas en grid con estado obtenido/pendiente.
- Estados vacíos claros: “Añade un amigo para competir”.

## 9. ReactBits

- No integrar ningún componente sin auditoría humana previa.
- Guardar componentes aprobados en `src/components/vendor/reactbits/` con licencia/atribución.
- Lazy load de los pesados.
- Comprobar bundle y rendimiento.
- Respetar `prefers-reduced-motion`.
- Máximo un efecto llamativo en la landing; el resto, disciplina visual.
- Evitar shaders o animaciones que bloqueen la interacción o el scroll.

## 10. Accesibilidad

- HTML semántico y landmarks.
- Skip link.
- Foco visible y orden de tabulación lógico.
- Formularios con labels visibles y errores asociados.
- Contraste AA.
- No depender solo del color.
- Diálogos con focus trap y Escape.
- `prefers-reduced-motion`.
- Charts con alternativa textual/tabla.
- Navegación completa por teclado.
- Textos alternativos en imágenes.
- `lang` correcto.

## 11. Responsive

- 390, 768, 1024 y 1440 px como anchos de referencia.
- Sin overflow horizontal a 320 px.
- Una columna en móvil; menú full-screen si es necesario.
- Sidebar del dashboard colapsable.
- Botones principales a ancho completo en móvil.

## 12. Rendimiento

- Code splitting por ruta.
- Lazy load de Recharts y ReactBits pesados.
- Fuentes optimizadas.
- Imágenes con dimensiones explícitas y formatos modernos.
- Evitar layout shift.
- Presupuesto orientativo: LCP < 2.5 s, CLS < 0.1, INP < 200 ms.

## 13. SEO y metadatos

- `<title>` y meta description específicos.
- Open Graph y Twitter card.
- `lang="es"`.
- Sitemap y robots.
- URL canónica.
- Datos estructurados solo si son veraces.

## 14. Gates de diseño

### 14.1 `design-taste-frontend`

Antes de pedir revisión humana de la landing:

```bash
node <skill>/scripts/gate.mjs \
  --start http://localhost:5173/ \
  --kind software \
  --category "seguimiento de horas de estudio" \
  --primary "Crear cuenta"
```

Además:

- `copy-lint` sin FAIL (y WARN justificados).
- `consistency` en 1440, 1024, 768 y 390.
- `check` sin hallazgos.
- `perf` sin FAIL.
- Capturas en 1440, 1024, 768 y 390.
- No considerar terminado hasta `GATE: PASS` o documentar los `OPEN` con motivo.

### 14.2 `web-design-guidelines`

En cada PR de UI:

1. Obtener la guía actualizada desde la URL del skill.
2. Revisar los archivos cambiados.
3. Reportar hallazgos en formato `file:line`.
4. Corregir o justificar.

## 15. Prohibiciones

- Captions o descripciones debajo de imágenes/renders.
- Testimonios, clientes, métricas o resultados inventados.
- Fotos de stock presentadas como producto real.
- Violeta/lavanda en el diseño propio.
- Fade-in en cada sección, parallax en texto o scroll-jacking.
- Copiar código, copy, imágenes o efecto firma de Expo.
- Placeholders visibles en producción.
