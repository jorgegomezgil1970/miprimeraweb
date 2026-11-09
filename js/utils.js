/**
 * utils.js — Utilidades compartidas: fechas (formato español, semana en lunes),
 * identificadores, escapado de HTML y constantes de dominio.
 */

/** Categorías de vida con su nombre visible. El color vive en CSS (variables). */
export const CATEGORIES = {
  personal: { id: 'personal', label: 'Personal', color: '#7fa88a', soft: '#e6f0e8' },
  trabajo:  { id: 'trabajo',  label: 'Trabajo',  color: '#6b9bd1', soft: '#e3edf8' },
  estudio:  { id: 'estudio',  label: 'Estudio',  color: '#a38fd0', soft: '#eee9f8' },
};
export const CATEGORY_IDS = Object.keys(CATEGORIES);

export const PRIORITIES = {
  alta:  { id: 'alta',  label: 'Alta',  color: '#ec7f6d', weight: 3 },
  media: { id: 'media', label: 'Media', color: '#e8b04b', weight: 2 },
  baja:  { id: 'baja',  label: 'Baja',  color: '#8b9bb0', weight: 1 },
};

export const STATUSES = {
  pending: { id: 'pending', label: 'Pendiente' },
  doing:   { id: 'doing',   label: 'En curso' },
  done:    { id: 'done',    label: 'Hecho' },
};

/** Antelaciones disponibles para los avisos (en minutos). null = sin aviso. */
export const LEAD_OPTIONS = [
  { value: 0, label: 'A la hora' },
  { value: 5, label: '5 min antes' },
  { value: 15, label: '15 min antes' },
  { value: 30, label: '30 min antes' },
  { value: 60, label: '1 h antes' },
  { value: 1440, label: '1 día antes' },
];

export const WEEKDAYS_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
export const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Genera un identificador corto y suficientemente único para uso local. */
export function uid(prefix = 'id') {
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${rnd}`;
}

/** Escapa texto para insertarlo de forma segura en HTML. */
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const pad = (n) => String(n).padStart(2, '0');

/** Date -> 'AAAA-MM-DD' en hora local (formato interno de almacenamiento). */
export function toISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** Date -> 'HH:mm' (24 h). */
export function toTime(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
/** 'AAAA-MM-DD' (+ 'HH:mm' opcional) -> Date local. */
export function parseLocal(dateStr, timeStr = '00:00') {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = (timeStr || '00:00').split(':').map(Number);
  const out = new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0);
  return Number.isNaN(out.getTime()) ? null : out;
}
/** 'AAAA-MM-DD' -> 'dd/mm/aaaa'. */
export function fmtDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}
/** 'dd/mm/aaaa' -> 'AAAA-MM-DD' (o null si no es válida). */
export function parseDisplayDate(text) {
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(text || '');
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  if (d.getMonth() !== Number(m[2]) - 1) return null; // p. ej. 31/02
  return toISODate(d);
}
/** Valida y normaliza una hora 'H:mm' / 'HH:mm' / 'HHmm' -> 'HH:mm' o null. */
export function normalizeTime(text) {
  const t = String(text || '').trim();
  const m = /^(\d{1,2})(?::|\.|h)?(\d{2})?$/.exec(t);
  if (!m) return null;
  const h = Number(m[1]); const min = Number(m[2] || 0);
  if (h > 23 || min > 59) return null;
  return `${pad(h)}:${pad(min)}`;
}
/** Fecha larga legible: 'lunes, 9 de noviembre'. */
export function fmtLong(dateStr) {
  const d = parseLocal(dateStr);
  if (!d) return '';
  const wd = WEEKDAYS[mondayIndex(d)].toLowerCase();
  return `${wd}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}
/** Índice del día de la semana empezando en lunes (0 = lunes ... 6 = domingo). */
export function mondayIndex(d) {
  return (d.getDay() + 6) % 7;
}
export function todayISO() { return toISODate(new Date()); }
export function addDays(dateStr, n) {
  const d = parseLocal(dateStr); d.setDate(d.getDate() + n); return toISODate(d);
}
/** Diferencia en días naturales entre dos fechas ISO (b - a). */
export function diffDays(a, b) {
  return Math.round((parseLocal(b) - parseLocal(a)) / 86400000);
}
/** Lunes de la semana que contiene la fecha dada. */
export function startOfWeek(dateStr) {
  const d = parseLocal(dateStr);
  d.setDate(d.getDate() - mondayIndex(d));
  return toISODate(d);
}
/** Etiqueta relativa amable: Hoy, Mañana, Ayer o dd/mm/aaaa. */
export function relDay(dateStr) {
  const diff = diffDays(todayISO(), dateStr);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  if (diff === -1) return 'Ayer';
  return fmtDate(dateStr);
}
/** Etiqueta de antelación legible. */
export function leadLabel(minutes) {
  const opt = LEAD_OPTIONS.find((o) => o.value === Number(minutes));
  return opt ? opt.label : `${minutes} min antes`;
}
/** Minutos 'HH:mm' -> número. */
export function timeToMin(t) {
  const [h, m] = (t || '0:0').split(':').map(Number);
  return h * 60 + m;
}
/** Comprueba si el usuario prefiere movimiento reducido. */
export function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
/** Ancho de pantalla tipo móvil. */
export function isMobile() {
  return window.matchMedia?.('(max-width: 760px)').matches ?? false;
}
/** Comprueba si WebGL está disponible. */
export function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}
