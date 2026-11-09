/**
 * utils.js — Utilidades compartidas: fechas (formato español, semana en lunes),
 * identificadores, escapado de HTML y constantes de dominio.
 */
/*
 * Organiza usa scripts clásicos (sin módulos ES) para poder abrirse con doble clic
 * (file://) en cualquier navegador. Cada archivo es una función autoejecutable que
 * publica su API en el espacio de nombres global `window.Organiza` (O.Utils, O.Store…).
 */
window.Organiza = window.Organiza || {};
/**
 * Acceso diferido a otro módulo: útil para dependencias circulares (p. ej. ui ↔ tasks),
 * ya que la propiedad se resuelve en el momento de la llamada, no al cargar el script.
 */
window.Organiza.lazy = (name) => new Proxy({}, { get: (_, key) => window.Organiza[name][key] });

(function () {
  'use strict';
  const O = window.Organiza;

  /** Categorías de vida con su nombre visible. El color vive en CSS (variables). */
  const CATEGORIES = {
    personal: { id: 'personal', label: 'Personal', color: '#7fa88a', soft: '#e6f0e8' },
    trabajo:  { id: 'trabajo',  label: 'Trabajo',  color: '#6b9bd1', soft: '#e3edf8' },
    estudio:  { id: 'estudio',  label: 'Estudio',  color: '#a38fd0', soft: '#eee9f8' },
  };
  const CATEGORY_IDS = Object.keys(CATEGORIES);

  const PRIORITIES = {
    alta:  { id: 'alta',  label: 'Alta',  color: '#ec7f6d', weight: 3 },
    media: { id: 'media', label: 'Media', color: '#e8b04b', weight: 2 },
    baja:  { id: 'baja',  label: 'Baja',  color: '#8b9bb0', weight: 1 },
  };

  const STATUSES = {
    pending: { id: 'pending', label: 'Pendiente' },
    doing:   { id: 'doing',   label: 'En curso' },
    done:    { id: 'done',    label: 'Hecho' },
  };

  /** Antelaciones disponibles para los avisos (en minutos). null = sin aviso. */
  const LEAD_OPTIONS = [
    { value: 0, label: 'A la hora' },
    { value: 5, label: '5 min antes' },
    { value: 15, label: '15 min antes' },
    { value: 30, label: '30 min antes' },
    { value: 60, label: '1 h antes' },
    { value: 1440, label: '1 día antes' },
  ];

  const WEEKDAYS_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
    'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  /** Genera un identificador corto y suficientemente único para uso local. */
  function uid(prefix = 'id') {
    const rnd = Math.random().toString(36).slice(2, 8);
    return `${prefix}_${Date.now().toString(36)}${rnd}`;
  }

  /** Escapa texto para insertarlo de forma segura en HTML. */
  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  const pad = (n) => String(n).padStart(2, '0');

  /** Date -> 'AAAA-MM-DD' en hora local (formato interno de almacenamiento). */
  function toISODate(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  /** Date -> 'HH:mm' (24 h). */
  function toTime(d) {
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  /** 'AAAA-MM-DD' (+ 'HH:mm' opcional) -> Date local. */
  function parseLocal(dateStr, timeStr = '00:00') {
    if (!dateStr) return null;
    const [y, m, d] = dateStr.split('-').map(Number);
    const [hh, mm] = (timeStr || '00:00').split(':').map(Number);
    const out = new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0);
    return Number.isNaN(out.getTime()) ? null : out;
  }
  /** 'AAAA-MM-DD' -> 'dd/mm/aaaa'. */
  function fmtDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }
  /** 'dd/mm/aaaa' -> 'AAAA-MM-DD' (o null si no es válida). */
  function parseDisplayDate(text) {
    const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(text || '');
    if (!m) return null;
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    if (d.getMonth() !== Number(m[2]) - 1) return null; // p. ej. 31/02
    return toISODate(d);
  }
  /** Valida y normaliza una hora 'H:mm' / 'HH:mm' / 'HHmm' -> 'HH:mm' o null. */
  function normalizeTime(text) {
    const t = String(text || '').trim();
    const m = /^(\d{1,2})(?::|\.|h)?(\d{2})?$/.exec(t);
    if (!m) return null;
    const h = Number(m[1]); const min = Number(m[2] || 0);
    if (h > 23 || min > 59) return null;
    return `${pad(h)}:${pad(min)}`;
  }
  /** Fecha larga legible: 'lunes, 9 de noviembre'. */
  function fmtLong(dateStr) {
    const d = parseLocal(dateStr);
    if (!d) return '';
    const wd = WEEKDAYS[mondayIndex(d)].toLowerCase();
    return `${wd}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
  }
  /** Índice del día de la semana empezando en lunes (0 = lunes ... 6 = domingo). */
  function mondayIndex(d) {
    return (d.getDay() + 6) % 7;
  }
  function todayISO() { return toISODate(new Date()); }
  function addDays(dateStr, n) {
    const d = parseLocal(dateStr); d.setDate(d.getDate() + n); return toISODate(d);
  }
  /** Diferencia en días naturales entre dos fechas ISO (b - a). */
  function diffDays(a, b) {
    return Math.round((parseLocal(b) - parseLocal(a)) / 86400000);
  }
  /** Lunes de la semana que contiene la fecha dada. */
  function startOfWeek(dateStr) {
    const d = parseLocal(dateStr);
    d.setDate(d.getDate() - mondayIndex(d));
    return toISODate(d);
  }
  /** Etiqueta relativa amable: Hoy, Mañana, Ayer o dd/mm/aaaa. */
  function relDay(dateStr) {
    const diff = diffDays(todayISO(), dateStr);
    if (diff === 0) return 'Hoy';
    if (diff === 1) return 'Mañana';
    if (diff === -1) return 'Ayer';
    return fmtDate(dateStr);
  }
  /** Etiqueta de antelación legible. */
  function leadLabel(minutes) {
    const opt = LEAD_OPTIONS.find((o) => o.value === Number(minutes));
    return opt ? opt.label : `${minutes} min antes`;
  }
  /** Minutos 'HH:mm' -> número. */
  function timeToMin(t) {
    const [h, m] = (t || '0:0').split(':').map(Number);
    return h * 60 + m;
  }
  /** Comprueba si el usuario prefiere movimiento reducido. */
  function prefersReducedMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }
  /** Ancho de pantalla tipo móvil. */
  function isMobile() {
    return window.matchMedia?.('(max-width: 760px)').matches ?? false;
  }
  /** Comprueba si el navegador admite transformaciones CSS 3D (preserve-3d). */
  function has3D() {
    try { return !!(window.CSS && CSS.supports('transform-style', 'preserve-3d')); } catch { return false; }
  }

  O.Utils = { uid, esc, toISODate, toTime, parseLocal, fmtDate, parseDisplayDate, normalizeTime, fmtLong, mondayIndex, todayISO, addDays, diffDays, startOfWeek, relDay, leadLabel, timeToMin, prefersReducedMotion, isMobile, has3D, CATEGORIES, CATEGORY_IDS, PRIORITIES, STATUSES, LEAD_OPTIONS, WEEKDAYS_SHORT, WEEKDAYS, MONTHS };
})();
