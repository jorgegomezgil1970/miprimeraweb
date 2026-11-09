/**
 * illustrations.js — Iconos e ilustraciones SVG propios generados por código.
 * Estilo plano, minimalista, línea fina y colores pastel coherentes con la paleta.
 * No se usa ninguna librería de iconos externa.
 */

/* ------------------------------------------------------------------ */
/* Iconos (24×24, trazo 1.75, color = currentColor)                    */
/* ------------------------------------------------------------------ */
const ICON_PATHS = {
  // Navegación
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h5v-6h4v6h5V9.5"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1.2 1.2L7 5M3.5 12l1.2 1.2L7 11M3.5 18l1.2 1.2L7 17"/>',
  kanban: '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="9.5" y="4" width="5" height="10" rx="1.5"/><rect x="16" y="4" width="5" height="13" rx="1.5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/>',
  // Acciones
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  trash: '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/><path d="M10 11v5M14 11v5"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  snooze: '<circle cx="12" cy="13" r="7.5"/><path d="M10 10.5h4l-4 5h4M5 3.5 2.5 6M19 3.5 21.5 6"/>',
  open: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  drag: '<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>',
  left: '<path d="m15 5-7 7 7 7"/>',
  right: '<path d="m9 5 7 7-7 7"/>',
  repeat: '<path d="M4 11V9a3 3 0 0 1 3-3h12l-3-3M20 13v2a3 3 0 0 1-3 3H5l3 3"/>',
  tag: '<path d="M3.5 12.5V4.5a1 1 0 0 1 1-1h8l8 8-9 9z"/><circle cx="8" cy="8" r="1.4"/>',
  pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z"/><circle cx="12" cy="10" r="2.3"/>',
  users: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19.5a6 6 0 0 1 12 0"/><circle cx="17" cy="9.5" r="2.4"/><path d="M15.5 14.4a5 5 0 0 1 5.5 5"/>',
  sound: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 16V5M7 9.5l5-5 5 5M5 20h14"/>',
  warning: '<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17v.2"/>',
  cube: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
  columns: '<rect x="3.5" y="4" width="4" height="16" rx="1"/><rect x="10" y="4" width="4" height="16" rx="1"/><rect x="16.5" y="4" width="4" height="16" rx="1"/>',
  meeting: '<rect x="3" y="5" width="18" height="15" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4M8 14h4"/>',
  sparkle: '<path d="M12 3.5 13.8 10.2 20.5 12l-6.7 1.8L12 20.5l-1.8-6.7L3.5 12l6.7-1.8z"/>',
  // Categorías
  personal: '<path d="M12 20.5s-7.5-4.6-7.5-10.3A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.6c0 5.7-7.5 10.3-7.5 10.3z"/>',
  trabajo: '<rect x="3" y="7.5" width="18" height="12.5" rx="2.2"/><path d="M8.5 7.5V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5v2M3 13h18"/>',
  estudio: '<path d="M3.5 6.5C6 5 9 5 12 7c3-2 6-2 8.5-.5V19c-2.5-1.5-5.5-1.5-8.5.5-3-2-6-2-8.5-.5z"/><path d="M12 7v12.5"/>',
  all: '<circle cx="7.5" cy="7.5" r="3"/><circle cx="16.5" cy="7.5" r="3"/><circle cx="12" cy="16.5" r="3"/>',
};

/**
 * Devuelve el SVG de un icono.
 * @param {string} name   nombre del icono
 * @param {number} size   tamaño en px
 */
export function icon(name, size = 20, extraClass = '') {
  const paths = ICON_PATHS[name] || ICON_PATHS.sparkle;
  return `<svg class="icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
}

/* ------------------------------------------------------------------ */
/* Ilustraciones                                                       */
/* ------------------------------------------------------------------ */
// Paleta pastel
const P = {
  sage: '#cfe3d4', sageD: '#7fa88a',
  blue: '#d6e5f6', blueD: '#6b9bd1',
  lav: '#e4dcf5', lavD: '#a38fd0',
  coral: '#f8d3cc', coralD: '#ec7f6d',
  amber: '#f7e3b8', amberD: '#e8b04b',
  ink: '#56637a', line: '#c9d1dd', paper: '#ffffff', bg: '#f1f4f8',
};

/** Envoltorio común: viewBox 240×180 y estilo de línea fina. */
function frame(inner, label) {
  return `<svg class="illustration" viewBox="0 0 240 180" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg">
  <g fill="none" stroke="${P.ink}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${inner}</g></svg>`;
}

/** Suelo/sombra suave reutilizable. */
const ground = (cx = 120, w = 86) => `<ellipse cx="${cx}" cy="156" rx="${w}" ry="8" fill="${P.bg}" stroke="none"/>`;
const sparkles = (pts) => pts.map(([x, y, c]) =>
  `<path d="M${x} ${y - 6}v12M${x - 6} ${y}h12" stroke="${c}" stroke-width="1.6"/>`).join('');

/** Sin tareas: portapapeles con lista vacía y una planta. */
export function emptyTasks() {
  return frame(`${ground()}
    <rect x="78" y="34" width="84" height="112" rx="10" fill="${P.paper}"/>
    <rect x="102" y="26" width="36" height="16" rx="5" fill="${P.blue}"/>
    <rect x="92" y="62" width="10" height="10" rx="3" fill="${P.sage}"/><path d="M110 67h38" stroke="${P.line}"/>
    <rect x="92" y="86" width="10" height="10" rx="3" fill="${P.lav}"/><path d="M110 91h30" stroke="${P.line}"/>
    <rect x="92" y="110" width="10" height="10" rx="3" fill="${P.amber}"/><path d="M110 115h34" stroke="${P.line}"/>
    <path d="M186 150c0-18-4-30-12-38M186 150c2-16 8-26 16-30" />
    <path d="M174 112c-8 2-12-4-10-10 8 0 12 4 10 10zM202 120c4-8 12-8 14-2-6 6-10 6-14 2z" fill="${P.sage}"/>
    <rect x="176" y="146" width="20" height="12" rx="3" fill="${P.coral}"/>
    ${sparkles([[56, 50, P.lavD], [196, 40, P.amberD]])}`, 'Ilustración: no hay tareas');
}

/** Sin reuniones: calendario con taza de café. */
export function emptyMeetings() {
  return frame(`${ground()}
    <rect x="62" y="36" width="104" height="104" rx="12" fill="${P.paper}"/>
    <path d="M62 60h104" /><rect x="62" y="36" width="104" height="24" rx="12" fill="${P.blue}"/>
    <path d="M86 28v16M142 28v16"/>
    ${[0, 1, 2, 3].map((r) => [0, 1, 2, 3].map((c) =>
      `<rect x="${76 + c * 20}" y="${70 + r * 16}" width="12" height="9" rx="2.5" fill="${(r + c) % 5 === 1 ? P.sage : P.bg}" stroke="none"/>`).join('')).join('')}
    <path d="M172 116h30v22a10 10 0 0 1-10 10h-10a10 10 0 0 1-10-10z" fill="${P.coral}"/>
    <path d="M202 122h4a6 6 0 0 1 0 12h-4"/><path d="M180 104c0-4 4-4 4-8M190 104c0-4 4-4 4-8"/>
    ${sparkles([[44, 64, P.sageD], [196, 52, P.lavD]])}`, 'Ilustración: no hay reuniones');
}

/** Sin avisos: campana tranquila durmiendo. */
export function emptyReminders() {
  return frame(`${ground()}
    <path d="M86 128V96a34 34 0 0 1 68 0v32l10 12H76z" fill="${P.amber}"/>
    <path d="M110 142a10 10 0 0 0 20 0"/><circle cx="120" cy="56" r="5" fill="${P.paper}"/>
    <path d="M104 102q5 4 10 0M126 102q5 4 10 0"/>
    <path d="M160 44h12l-12 14h12M178 26h8l-8 9h8" stroke="${P.lavD}"/>
    ${sparkles([[56, 70, P.blueD]])}`, 'Ilustración: no hay avisos');
}

/** Kanban vacío: tres columnas con una tarjeta flotando. */
export function emptyKanban() {
  return frame(`${ground()}
    <rect x="44" y="40" width="44" height="104" rx="8" fill="${P.bg}"/>
    <rect x="98" y="40" width="44" height="104" rx="8" fill="${P.bg}"/>
    <rect x="152" y="40" width="44" height="104" rx="8" fill="${P.bg}"/>
    <path d="M54 52h24M108 52h24M162 52h24" stroke="${P.line}"/>
    <rect x="100" y="70" width="52" height="34" rx="6" fill="${P.paper}" transform="rotate(-8 126 87)"/>
    <path d="M110 82h26M110 92h16" stroke="${P.line}" transform="rotate(-8 126 87)"/>
    <circle cx="144" cy="78" r="4" fill="${P.lav}" stroke="none"/>
    <path d="M122 118v14M116 126l6 6 6-6" stroke="${P.blueD}"/>
    ${sparkles([[30, 60, P.sageD], [212, 70, P.coralD]])}`, 'Ilustración: tablero vacío');
}

/** Búsqueda sin resultados: lupa con signo de interrogación. */
export function noResults() {
  return frame(`${ground()}
    <circle cx="108" cy="86" r="40" fill="${P.paper}"/><circle cx="108" cy="86" r="30" fill="${P.blue}" stroke="none" opacity=".6"/>
    <path d="M137 115l30 30" stroke-width="8" stroke="${P.lavD}"/>
    <path d="M98 76a10 10 0 1 1 14 9c-3 2-4 4-4 7"/><circle cx="108" cy="100" r="1.4" fill="${P.ink}"/>
    ${sparkles([[176, 50, P.amberD], [52, 120, P.sageD]])}`, 'Ilustración: sin resultados');
}

/** Todo hecho: trofeo/medalla con confeti. */
export function allDone() {
  return frame(`${ground()}
    <circle cx="120" cy="82" r="44" fill="${P.sage}"/>
    <path d="m98 84 16 16 30-32" stroke="${P.paper}" stroke-width="7"/>
    ${[[52, 50, P.coral], [184, 44, P.lav], [196, 110, P.amber], [44, 112, P.blue], [70, 30, P.amber], [168, 140, P.coral]]
      .map(([x, y, c], i) => `<rect x="${x}" y="${y}" width="10" height="6" rx="2" fill="${c}" stroke="none" transform="rotate(${i * 37} ${x + 5} ${y + 3})"/>`).join('')}
    ${sparkles([[88, 30, P.lavD], [158, 26, P.sageD]])}`, 'Ilustración: ¡todo hecho!');
}

/** Bienvenida: tres "islas" de vida (personal, trabajo y estudio). */
export function welcome() {
  return frame(`${ground(120, 100)}
    <ellipse cx="62" cy="128" rx="34" ry="10" fill="${P.sage}"/>
    <ellipse cx="120" cy="112" rx="34" ry="10" fill="${P.blue}"/>
    <ellipse cx="178" cy="128" rx="34" ry="10" fill="${P.lav}"/>
    <path d="M62 120V96" /><circle cx="62" cy="88" r="10" fill="${P.sage}"/>
    <rect x="104" y="72" width="32" height="34" rx="5" fill="${P.paper}"/><path d="M110 82h20M110 90h14M110 98h18" stroke="${P.line}"/>
    <path d="M164 118v-20l14-8 14 8v20" fill="${P.paper}"/><path d="M164 98l14 8 14-8M178 106v12"/>
    <path d="M84 58q36-30 72 0" stroke-dasharray="3 5" stroke="${P.line}"/>
    ${sparkles([[120, 34, P.amberD], [40, 62, P.coralD], [204, 62, P.blueD]])}`, 'Ilustración de bienvenida a Organiza');
}

/** Pequeños pasos del onboarding. */
export function onboardingStep(n) {
  const pieces = {
    1: `<rect x="70" y="40" width="100" height="100" rx="14" fill="${P.paper}"/><path d="M120 66v48M96 90h48" stroke="${P.blueD}" stroke-width="5"/>`,
    2: `<rect x="56" y="48" width="38" height="84" rx="8" fill="${P.sage}"/><rect x="101" y="48" width="38" height="60" rx="8" fill="${P.blue}"/><rect x="146" y="48" width="38" height="72" rx="8" fill="${P.lav}"/>`,
    3: `<path d="M90 118V90a30 30 0 0 1 60 0v28l9 10H81z" fill="${P.amber}"/><path d="M112 134a8 8 0 0 0 16 0"/><path d="M164 70q10 10 0 20M174 62q18 18 0 36" stroke="${P.coralD}"/>`,
  };
  return frame(`${ground()}${pieces[n] || ''}`, `Paso ${n} del recorrido`);
}

/** Mapa de estados vacíos para usar de forma genérica. */
export const EMPTY = {
  tasks: emptyTasks,
  meetings: emptyMeetings,
  reminders: emptyReminders,
  kanban: emptyKanban,
  search: noResults,
  done: allDone,
};
