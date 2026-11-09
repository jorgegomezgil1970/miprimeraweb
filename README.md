# Organiza

Gestor personal de **tareas, reuniones y avisos** para tres ámbitos de vida: **Personal**, **Trabajo** y **Estudio**.

Está hecho **solo con HTML, CSS y JavaScript, de forma estática**:

- no usa frameworks, librerías, CDN, módulos ES, bundlers, Node ni backend;
- el 3D está hecho con **transformaciones CSS 3D** (`perspective`, `preserve-3d`, `rotateX/Z`);
- todo se guarda en el navegador (`localStorage`).

---

## Cómo ejecutarla

1. Descomprime el `.zip`.
2. Haz **doble clic en `index.html`**. Funciona directamente desde el disco (`file://`) en Chrome, Edge, Firefox y Safari, y **sin conexión a internet**.

También puedes servirla con cualquier servidor estático, aunque no es necesario. Por ejemplo, la extensión «Live Server» de VS Code o:

```bash
python -m http.server 8000
```

> Mantén juntos `index.html` y las carpetas `css/` y `js/`. Si falta algún archivo, la página muestra un aviso en lugar de quedarse en blanco.

---

## Estructura

```
index.html
css/styles.css         variables CSS, layout, componentes y escenas 3D
css/responsive.css     ajustes por tamaño de pantalla (mobile-first)
js/utils.js            espacio de nombres global, fechas dd/mm/aaaa, constantes
js/store.js            estado único + persistencia en localStorage (versión de esquema)
js/illustrations.js    iconos e ilustraciones SVG generados por código
js/ui.js               modales, toasts, confirmaciones, formularios y detalles
js/tasks.js            tareas: subtareas, recurrencia, etiquetas + vista Tareas
js/meetings.js         reuniones y solapamientos
js/reminders.js        avisos sueltos, motor de avisos (30 s), sonido Web Audio + vista Avisos
js/kanban.js           tablero con drag & drop
js/settings.js         Ajustes, exportar/importar JSON, datos de ejemplo
js/3d/common3d.js      cajas 3D en CSS, órbita (arrastrar/zoom), tooltips
js/3d/dashboard3d.js   islas 3D del Inicio
js/3d/calendar3d.js    calendario 3D (mes y semana)
js/dashboard.js        vista Inicio (escena 3D + tarjetas resumen)
js/calendar.js         vista Calendario (escena 3D + panel del día)
js/app.js              arranque y enrutado por vistas (#/inicio, #/tareas…)
assets/sounds/         vacía a propósito: el sonido se genera con Web Audio API
```

### Cómo se organiza el código sin módulos

Cada archivo es una función autoejecutable que publica su API en `window.Organiza`
(`O.Utils`, `O.Store`, `O.Tasks`…). Los `<script defer>` de `index.html` se cargan **en orden**.
Las dependencias circulares (por ejemplo `ui` ↔ `tasks`) se resuelven con `O.lazy('Tasks')`, que busca la función en el momento de llamarla.

Las mutaciones pasan por `store.update(fn, meta)`, que guarda y notifica a la vista activa.
Cada vista tiene un ciclo de vida `mount` / `update` / `unmount`. Al salir de una vista 3D, su escena se elimina por completo.

## Modelo de datos

Se guarda en `localStorage` con la clave `organiza:data`:

```js
{
  version: 1,
  tasks: [{ id, title, description, category, priority, tags: [tagId],
            dueDate: 'AAAA-MM-DD', dueTime: 'HH:mm', status: 'pending'|'doing'|'done',
            subtasks: [{ id, text, done }],
            recurrence: { type: 'none'|'daily'|'weekly'|'monthly', days: [0..6] },  // 0 = lunes
            reminder: null | minutos, seriesId?, createdAt, updatedAt, completedAt }],
  meetings: [{ id, title, category, date, start, end, location, participants, notes, reminder }],
  reminders: [{ id, title, category, date, time, lead, done }],          // avisos independientes
  tags: [{ id, name, color }],
  alerts: { log: [{ id, key, kind, refId, title, category, dueAt, firedAt,
                    status: 'active'|'snoozed'|'done'|'dismissed', snoozeUntil, missed }] },
  settings: { sound, volume, defaultLead, onboarded, filter }
}
```

En pantalla las fechas siempre se muestran como **dd/mm/aaaa** y las horas en formato **24 h**. La semana empieza en lunes.

---

## Funciones

- **Filtro global** Todas / Personal / Trabajo / Estudio y **botón «+»** para añadir rápido una tarea, una reunión o un aviso.
- **Tareas**:
  - campos: categoría, prioridad, etiquetas con color, fecha y hora límite, estado, subtareas con progreso, recurrencia y aviso;
  - acciones: crear, editar, completar, duplicar y borrar (con confirmación y «Deshacer» durante 5 s);
  - al completar una tarea recurrente se crea la siguiente;
  - búsqueda, ordenación y marca de las tareas vencidas.
- **Kanban**: arrastre con ratón (HTML5 Drag and Drop), arrastre táctil desde el asa ⋮⋮ (pointer events) y botones ← → para el teclado.
- **Reuniones**: todos los campos y aviso de **solapamientos**.
- **Avisos**:
  - motor que revisa cada 30 s;
  - toast con **Hecho / Posponer 10 min / Abrir**;
  - sonido generado con Web Audio;
  - contador en la navegación;
  - panel con pendientes, próximos e historial;
  - al reabrir la app, muestra los avisos que se perdieron mientras estaba cerrada.
- **Inicio 3D (CSS)**:
  - tres islas por categoría con las tareas de hoy y de los próximos 7 días: cubo = pendiente, esfera = en curso, tamaño = prioridad, borde coral = vencida;
  - anillo de progreso por categoría;
  - giro arrastrando con límites, zoom y botones de vista;
  - al pasar el ratón el objeto se eleva y aparece un tooltip; con un clic se abre el detalle;
  - al completar una tarea su objeto sube, gira y desaparece.
- **Calendario 3D (CSS)**:
  - losetas por día, con el día de hoy elevado;
  - indicadores apilados (cubo = tarea, esfera = reunión, cono = aviso);
  - las losetas giran al cambiar de mes;
  - vista semanal con bloques cuya **altura = duración** de la reunión;
  - un clic en un día abre el panel lateral con el botón «Añadir».
- **Accesibilidad del 3D**:
  - cada objeto y cada día es un `<button>` con `aria-label`;
  - en el calendario se navega con las flechas;
  - se respeta `prefers-reduced-motion`;
  - las animaciones se pausan con la pestaña oculta;
  - en móvil se muestran menos objetos y sin sombras;
  - si el navegador no admite CSS 3D, hay una alternativa 2D.
- **Ajustes**: sonido y volumen, antelación por defecto, etiquetas, exportar e importar JSON (con validación y confirmación), cargar ejemplo y borrar todo (doble confirmación).
- **Ilustraciones SVG propias**: bienvenida con recorrido de 3 pasos, estados vacíos y «¡Todo hecho!».

## Verificación

Probado con Chromium (Playwright), abriendo `index.html` con `file://` y **con toda la red bloqueada**: no se hizo ninguna petición externa ni hubo errores en consola. Se probó a 1366 px, 375 px y 360 px y se comprobó:

- arranque, recorrido de bienvenida y datos de ejemplo;
- tareas: crear, completar con recurrencia, duplicar, borrar y deshacer;
- Kanban con ratón y táctil;
- solapamientos de reuniones;
- un aviso que salta, posponer y avisos perdidos;
- exportar e importar;
- en el Inicio 3D: tooltip, clic, animación al completar y giro arrastrando;
- en el Calendario 3D: cambio de mes animado, vista semanal, clic en bloque y navegación con flechas;
- sin scroll horizontal.

No se ha probado en dispositivos móviles reales ni en Safari.
