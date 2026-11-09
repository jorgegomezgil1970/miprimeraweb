# Organiza

Gestor personal de **tareas, reuniones y avisos** para tres ámbitos de vida: **Personal**, **Trabajo** y **Estudio**.
Hecho exclusivamente con **HTML, CSS y JavaScript vanilla (ES modules)**. La única librería externa es **Three.js 0.160.0**,
cargada desde CDN con `importmap`. Sin frameworks, sin bundlers, sin Node y sin backend: todo se guarda en `localStorage`.

---

## Cómo ejecutarla

Los navegadores basados en Chromium (Chrome, Edge…) bloquean los módulos ES cuando se abre un archivo con `file://`,
así que lo más fiable es usar un servidor estático:

**Opción 1: Python**

```bash
python -m http.server 8000
```

Después abre <http://localhost:8000> en el navegador.

**Opción 2: VS Code + extensión «Live Server».** Clic derecho en `index.html` → *Open with Live Server*.

**Opción 3: abrir `index.html` directamente.** Funciona en Firefox. En Chrome/Edge la página detecta que los módulos
no han cargado y muestra estas mismas instrucciones en lugar de quedarse en blanco.

> El 3D necesita conexión para descargar Three.js del CDN (jsDelivr). Sin conexión o sin WebGL, el Inicio y el Calendario
> muestran automáticamente una **versión 2D** y el resto de la app funciona igual.

---

## Plan de arquitectura

```
index.html ──► js/app.js (arranque + enrutado por hash: #/inicio, #/tareas, #/kanban, #/calendario, #/avisos, #/ajustes)
                 │
                 ├─ js/store.js ........ estado único + persistencia localStorage (versión de esquema, migraciones)
                 ├─ js/utils.js ........ fechas dd/mm/aaaa, semana en lunes, constantes (categorías, prioridades…)
                 ├─ js/ui.js ........... modales <dialog>, toasts, confirmaciones, formularios y detalles
                 ├─ js/illustrations.js  iconos e ilustraciones SVG generados por código
                 │
                 ├─ js/tasks.js ........ lógica de tareas (subtareas, recurrencia, etiquetas) + vista Tareas
                 ├─ js/kanban.js ....... tablero con drag & drop (HTML5 DnD + pointer events + teclado)
                 ├─ js/meetings.js ..... reuniones y detección de solapamientos
                 ├─ js/reminders.js .... avisos sueltos, motor (setInterval 30 s), sonido Web Audio, vista Avisos
                 ├─ js/settings.js ..... Ajustes, exportar/importar JSON, datos de ejemplo, borrar todo
                 │
                 ├─ js/dashboard.js .... vista Inicio (tarjetas HTML + carga diferida del 3D / alternativa 2D)
                 ├─ js/calendar.js ..... vista Calendario (panel del día + carga diferida del 3D / alternativa 2D)
                 └─ js/three/
                      ├─ common.js ..... renderer, luces, bucle rAF con pausa, tweens, dispose
                      ├─ dashboard3d.js  islas por categoría, torus de progreso, hover/tooltip/clic
                      └─ calendar3d.js . losetas mensuales, columnas semanales, raycasting, transiciones
```

Principios:

- **Flujo unidireccional.** Todas las mutaciones pasan por `store.update(fn, meta)`. Ese método guarda y avisa a los suscriptores.
  `app.js` reenvía cada cambio a la vista activa (`view.update(meta)`) y al contador de avisos.
- **Vistas con ciclo de vida** `mount(el)` / `update(meta)` / `unmount()`. Al salir de una vista 3D se llama a `dispose()`,
  que libera geometrías, materiales, renderer, controles y listeners.
- **El 3D es opcional.** Los módulos de Three.js se importan con `import()` dinámico dentro de `try/catch`: si fallan, se usa la versión 2D.
- **Accesibilidad primero.** HTML semántico, `<dialog>` nativo, `aria-live` en toasts y listas, foco visible y alternativas de teclado al
  arrastre (botones ← →) y al canvas 3D (lista de días accesible con el teclado).

## Modelo de datos

Se guarda en `localStorage` bajo la clave `organiza:data`:

```js
{
  version: 1,                       // versión de esquema (migraciones en store.js)
  tasks: [{
    id, title, description,
    category: 'personal' | 'trabajo' | 'estudio',
    priority: 'alta' | 'media' | 'baja',
    tags: [tagId],
    dueDate: 'AAAA-MM-DD' | '', dueTime: 'HH:mm' | '',
    status: 'pending' | 'doing' | 'done',
    subtasks: [{ id, text, done }],
    recurrence: { type: 'none' | 'daily' | 'weekly' | 'monthly', days: [0..6] },  // 0 = lunes
    reminder: null | minutosDeAntelacion,          // 0, 5, 15, 30, 60, 1440
    seriesId?,                                      // enlaza las instancias de una tarea recurrente
    createdAt, updatedAt, completedAt
  }],
  meetings: [{
    id, title, category, date: 'AAAA-MM-DD', start: 'HH:mm', end: 'HH:mm',
    location, participants, notes, reminder, createdAt, updatedAt
  }],
  reminders: [{ id, title, category, date, time, lead, done, createdAt }],   // avisos independientes
  tags: [{ id, name, color }],
  alerts: { log: [{                                   // avisos disparados
    id, key, kind: 'task' | 'meeting' | 'reminder', refId, title, category,
    dueAt, firedAt, status: 'active' | 'snoozed' | 'done' | 'dismissed', snoozeUntil, missed
  }] },
  settings: { sound, volume, defaultLead, onboarded, filter: 'all' | categoría }
}
```

Internamente las fechas se guardan como `AAAA-MM-DD` y `HH:mm`, y en pantalla siempre se muestran como **dd/mm/aaaa** y **24 h**.
La `key` de un aviso incluye la fecha y la antelación (`task:<id>:<fecha ISO>:<antelación>`). Así, al editar la hora,
el aviso se vuelve a programar y no se repite el que ya sonó.

---

## Funciones

- **Filtro global** Todas / Personal / Trabajo / Estudio en la barra superior. Afecta a todas las vistas.
- **Botón flotante «+»** con menú (Tarea / Reunión / Aviso), utilizable con teclado (flechas y Escape).
- **Tareas**: título, descripción, categoría, prioridad, etiquetas con color (crear, renombrar y borrar en Ajustes o crear al vuelo en el
  formulario), fecha y hora límite, estado, subtareas con barra de progreso, recurrencia (diaria, semanal por días o mensual) y aviso con antelación.
  Se pueden crear, editar, completar, duplicar y borrar (con confirmación y «Deshacer» durante 5 s).
  Al completar una tarea recurrente se crea la siguiente instancia. Incluye búsqueda, filtro por estado, ordenación por fecha, prioridad
  o creación y marca visual de las tareas vencidas.
- **Kanban**: Pendiente / En curso / Hecho. Arrastre nativo con ratón, arrastre táctil desde el asa ⋮⋮ con pointer events
  y botones ← → para el teclado.
- **Reuniones**: fecha, inicio y fin, lugar o enlace, participantes, notas y aviso. El formulario avisa en vivo de los
  **solapamientos**, que también se señalan en el calendario.
- **Avisos**: antelación por elemento (a la hora, 5 min, 15 min, 30 min, 1 h o 1 día) y valor por defecto en Ajustes.
  Cuando un aviso vence aparece un toast animado con los botones **Hecho / Posponer 10 min / Abrir**, suena una alerta
  generada con Web Audio y se actualiza el contador de la navegación. El panel muestra los avisos pendientes, los de los próximos 7 días y el historial.
  El motor revisa cada 30 s. Al reabrir la app, muestra los avisos que se perdieron mientras estaba cerrada.
- **Inicio 3D**: islas por categoría con las tareas pendientes de hoy y de los próximos 7 días (cubo = pendiente, esfera = en curso,
  tamaño = prioridad, brillo coral = vencida), anillos torus con el % completado, OrbitControls con límites, hover con tooltip,
  clic para abrir el detalle y animación al completar. Las islas se recolocan (en fila, triángulo o columna) según el ancho de la pantalla.
- **Calendario 3D**: losetas mensuales con el día de hoy elevado, indicadores apilados (cubo = tarea, cilindro = reunión,
  cono = aviso), transición animada entre meses y vista semanal con bloques cuya altura representa la duración. Las reuniones solapadas
  se colocan en carriles. Al hacer clic en un día se abre su panel lateral con el botón «Añadir».
- **Ajustes**: sonido (on/off, volumen y prueba), antelación por defecto, gestor de etiquetas, exportar e importar JSON
  (con validación y confirmación), «Cargar ejemplo», «Ver bienvenida» y «Borrar todos los datos» (doble confirmación).
- **Ilustraciones SVG propias**: bienvenida con recorrido de 3 pasos, estados vacíos (tareas, reuniones, avisos, kanban y búsqueda)
  y «¡Todo hecho!». Los iconos también son propios.

---

## Checklist del encargo

| # | Requisito | Estado |
|---|-----------|--------|
| 1 | Solo HTML/CSS/JS vanilla + Three.js 0.160.0 por importmap (OrbitControls, RoundedBoxGeometry, CSS2DRenderer) | ✅ |
| 1 | Tres categorías con color e icono; filtros globales; español; dd/mm/aaaa; 24 h; semana en lunes | ✅ (fechas con campo propio dd/mm/aaaa y selector nativo de apoyo) |
| 2 | Estructura de archivos pedida | ✅ (más `utils.js`, `settings.js`, `dashboard.js`, `calendar.js` y `three/common.js` para separar responsabilidades) |
| 3 | 6 vistas, nav lateral en PC / inferior en móvil, botón «+» | ✅ |
| 4 | Tareas completas: subtareas, etiquetas, recurrencia, aviso, duplicar, borrar con deshacer, búsqueda, orden, vencidas | ✅ |
| 5 | Kanban con DnD nativo + táctil (pointer events), actualiza el store | ✅ (+ alternativa de teclado) |
| 6 | Reuniones con todos los campos y aviso de solapamientos | ✅ |
| 7 | Motor de avisos (30 s), toast, panel, contador, sonido Web Audio, avisos perdidos, Hecho/Posponer/Abrir, avisos sueltos | ✅ |
| 8 | Dashboard 3D: islas, tamaño/color, torus de progreso, OrbitControls con límites, hover + tooltip, clic, animación al completar, tarjetas resumen | ✅ |
| 9 | Calendario 3D: losetas, hoy elevado, indicadores por forma, transición, vista semanal, panel lateral, raycasting, CSS2DRenderer | ✅ |
| 10 | rAF con pausa (pestaña oculta / vista inactiva), pixelRatio ≤ 2, dispose, reduced-motion, fallback 2D, menos objetos y sombras más ligeras en móvil | ✅ |
| 11 | Ilustraciones SVG: estados vacíos, bienvenida + onboarding de 3 pasos, «¡todo hecho!», iconos propios | ✅ |
| 12 | Diseño claro y minimalista, variables CSS, responsive desde 360 px sin scroll horizontal, accesibilidad | ✅ (contraste AA calculado para los pares de color principales) |
| 13 | Estado único versionado, try/catch en localStorage con modo en memoria, exportar/importar, borrar todo, datos de ejemplo | ✅ |

### Verificación realizada

Probado con Chromium (Playwright, WebGL por software SwiftShader). Three.js 0.160.0 se sirvió interceptando las peticiones al CDN,
porque desde el entorno de desarrollo no había acceso a jsDelivr. Se probó a 1366 px, 1280 px, 390 px y 360 px de ancho, sin errores en consola, y se comprobó:

- crear una tarea recurrente con subtareas, completarla y verificar que se genera la siguiente instancia;
- duplicar, borrar con confirmación y deshacer;
- búsqueda sin resultados;
- arrastre en el Kanban con ratón y con pointer events táctiles;
- reuniones solapadas, que muestran el aviso;
- un aviso que salta con su toast y el contador, y el botón posponer;
- avisos perdidos al recargar;
- exportar JSON e importar un JSON no válido (se rechaza);
- tooltip y clic en el 3D del Inicio y animación al completar;
- vista semanal 3D, cambio de mes y selección de día por clic en el canvas y por teclado;
- `prefers-reduced-motion`;
- la versión 2D cuando Three.js no carga;
- ausencia de scroll horizontal a 360 px.

No se ha probado en dispositivos móviles reales ni con GPU física. El sonido se genera correctamente, pero no se ha escuchado.

## Notas

- Las tareas con fecha pero sin hora se consideran vencidas al terminar el día y sus avisos toman como referencia las **09:00**.
- Si `localStorage` no está disponible (modo privado estricto o cuota llena), la app funciona en memoria, lo indica en la barra lateral
  y en Ajustes, y recomienda exportar una copia.
- `assets/sounds/` está vacía a propósito: el sonido se sintetiza con la Web Audio API.
