# Especificación de producto — StudyLogV2

## 1. Propósito

StudyLogV2 es una plataforma para que estudiantes universitarios registren sus horas de estudio y su esfuerzo, y vean el progreso reflejado gráficamente. El producto debe ayudar a responder preguntas como:

- ¿Cuánto he estudiado hoy, esta semana o este mes?
- ¿Cómo se reparte mi tiempo entre asignaturas?
- ¿Estoy manteniendo una racha de estudio?
- ¿Cómo voy frente a mis amigos o frente a la comunidad?

## 2. Usuarios

- **Estudiante universitario**: registra sesiones de estudio, organiza asignaturas y consulta su progreso.
- **Estudiante social** (post-MVP): compite con amigos mediante rachas semanales y leaderboards.
- **Visitante**: llega a la landing, entiende el producto y decide registrarse.

## 3. Propuesta de valor

- Registro rápido de sesiones manuales y con temporizador Pomodoro.
- Asignaturas con color propio para identificar el esfuerzo de un vistazo.
- Dashboard con totales, gráficas y rachas.
- Evolución a una capa social con amigos, leaderboard y emblemas.

## 4. Alcance

### 4.1 MVP

El MVP incluye las fases 0 a 4 de `plan.md`:

- Landing page descriptiva y profesional.
- Registro e inicio de sesión con JWT.
- Gestión de asignaturas con color.
- Registro manual de sesiones de estudio.
- Dashboard con horas, gráficas y desglose por asignatura.
- Temporizador Pomodoro en modal.
- Persistencia en Postgres.
- Despliegue en Vercel con Postgres gestionado.

### 4.2 Post-MVP

La fase 5 añade:

- Rachas de días estudiados.
- Amigos y solicitudes de amistad.
- Leaderboard semanal de amigos y global.
- Emblemas.

### 4.3 Fuera de alcance inicial

- Aplicación móvil nativa.
- Integraciones con calendarios o plataformas universitarias.
- Pagos o suscripciones.
- WebSockets o colaboración en tiempo real.
- Procesamiento de lenguaje natural o recomendaciones con IA.
- Subida de archivos o avatares personalizados (se pueden usar iniciales).

## 5. Requisitos funcionales

### 5.1 Landing

- Explicar qué es StudyLog, para quién es y qué problema resuelve.
- Mostrar UI real del producto, no una ilustración genérica.
- Incluir CTA a registro y acceso a login.
- Presentar el producto, el flujo de uso, las asignaturas con color, las gráficas, el Pomodoro y la evolución social.
- No inventar testimonios, clientes, métricas o resultados.
- Si se usan datos de demo, marcarlos como demo dentro de la interfaz.

### 5.2 Autenticación

- Registro con email, contraseña, nombre visible y zona horaria.
- Login con email y contraseña.
- Sesión persistente mediante refresh token en cookie `httpOnly`.
- Logout con revocación del refresh token.
- Recuperación de sesión al recargar la página.
- Rutas protegidas con redirección a login.
- Mensajes de error claros y sin filtrar si un email existe o no.

### 5.3 Asignaturas

- Crear, listar, editar y archivar asignaturas.
- Cada asignatura tiene nombre y color.
- El color debe ser válido y accesible; no puede ser la única señal de identificación.
- El usuario solo puede ver y modificar sus propias asignaturas.
- Archivar una asignatura no debe borrar sus sesiones históricas.

### 5.4 Sesiones de estudio

- Registrar una sesión manual con asignatura, inicio, fin y nota opcional.
- Registrar una sesión desde el Pomodoro.
- Editar y eliminar sesiones.
- Calcular la duración en servidor.
- Evitar solapamientos por usuario.
- Evitar duplicados por reintentos mediante `Idempotency-Key`.
- Listar sesiones con filtros por fecha y asignatura, con paginación.

### 5.5 Dashboard

- Mostrar total de horas de hoy, semana y mes.
- Mostrar racha actual.
- Mostrar gráfica semanal y desglose por asignatura.
- Mostrar sesiones recientes.
- Ofrecer estados vacíos que inviten a crear la primera asignatura o sesión.
- Actualizarse de forma optimista tras crear, editar o eliminar una sesión.

### 5.6 Pomodoro

- Modal accesible con estados `idle`, `focus`, `paused`, `break` y `completed`.
- Temporizador basado en `endsAt` y `Date.now()`, no en decremento por `setInterval`.
- Persistencia en `localStorage` y recuperación tras recargar.
- Notificación al terminar, con fallback a título/audio.
- Creación de sesión al completar, con `Idempotency-Key`.
- El temporizador debe sobrevivir a la navegación y a pestañas en segundo plano.

### 5.7 Social (post-MVP)

- Enviar, aceptar y bloquear solicitudes de amistad.
- Ver racha y horas semanales de amigos.
- Leaderboard semanal con ventana UTC fija.
- Leaderboard global con opt-in explícito.
- Emblemas otorgados de forma idempotente según criterios documentados.
- No exponer emails ni datos privados en rankings.

## 6. Requisitos no funcionales

- **Seguridad**: contraseñas hasheadas, JWT corto, refresh rotatorio, cookies `httpOnly`, rate limiting y autorización por propietario.
- **Rendimiento**: carga inicial razonable, gráficas lazy, sin llamadas innecesarias a Postgres.
- **Accesibilidad**: teclado, foco visible, contraste, etiquetas, `prefers-reduced-motion`.
- **Responsive**: 390, 768, 1024 y 1440 px; sin overflow a 320 px.
- **Mantenibilidad**: TypeScript estricto, contrato Zod compartido, tests y CI.
- **Portabilidad**: despliegue en Vercel con Postgres gestionado.
- **Privacidad**: solo mostrar datos necesarios en leaderboards; opción de eliminar cuenta y datos en el futuro.

## 7. Métricas de éxito sugeridas

No son cifras inventadas; son métricas a instrumentar cuando exista producto:

- Registros completados.
- Usuarios que crean al menos una asignatura.
- Usuarios que registran al menos una sesión.
- Sesiones registradas por semana.
- Retención semanal.
- Uso del Pomodoro frente a registro manual.
- Amistades y participación en leaderboard (post-MVP).

## 8. Decisiones asumidas y pendientes de confirmar

- TypeScript + pnpm + Drizzle para todo el monorepo.
- UI en español, con posibilidad de i18n posterior.
- Auth MVP: email + contraseña; recuperación de contraseña y verificación de email se posponen a fases posteriores salvo decisión contraria.
- Despliegue preferido: un solo proyecto Vercel con web + `/api` para compartir origen y cookies.
- Marca: nombre StudyLog; logo/wordmark se proponen en la fase de diseño. Si existe logo o colores de marca, se usan como restricción.
- Las reglas exactas de racha y emblemas se definirán antes de implementar la fase 5.

## 9. Reglas de negocio a definir antes de la fase 5

- Qué cuenta como día estudiado: por ejemplo, al menos una sesión o al menos 25 minutos.
- Si hay periodo de gracia para no romper una racha.
- Ventana semanal del leaderboard: UTC fija para todos.
- Criterios de emblemas: primera sesión, racha de 7 días, 10 horas semanales, 100 horas totales, etc.
- Privacidad del leaderboard global: opt-in explícito.

## 10. Principios rectores

1. **Postgres es la fuente de verdad.** No hay caché write-behind para sesiones de estudio.
2. **Contratos primero.** Los esquemas Zod compartidos se congelan antes de paralelizar API y UI.
3. **Cambios pequeños y verificables.** Una rama = un issue = un PR con criterios de aceptación explícitos.
4. **Nada llega a `main` sin CI verde, preview y aprobación humana.**
5. **El MVP se termina antes de ampliar alcance.** La fase 5 no empieza hasta cerrar la fase 4.

## 11. Criterio de MVP terminado

El MVP se considera terminado cuando un usuario nuevo puede, en producción:

1. Registrarse e iniciar sesión, y mantener la sesión tras recargar.
2. Crear asignaturas y registrar sesiones manualmente o con Pomodoro.
3. Ver sus totales, su gráfica semanal y su desglose por asignatura.
4. Recargar o navegar sin perder el temporizador ni duplicar sesiones.
5. Usar la aplicación con teclado y lector de pantalla en los flujos principales.
6. Llegar desde la landing al registro sin placeholders ni promesas falsas.

Y cuando el equipo puede desplegar, migrar y revertir con un runbook probado.
