/**
 * meetings.js — Lógica de reuniones: CRUD, detección de solapamientos y consultas.
 *
 * Modelo Meeting:
 * {
 *   id, title, category,
 *   date: 'AAAA-MM-DD', start: 'HH:mm', end: 'HH:mm',
 *   location, participants, notes,
 *   reminder: null | minutos de antelación,
 *   createdAt, updatedAt
 * }
 */
import { getState, update, clone, matchesFilter } from './store.js';
import { uid, parseLocal, todayISO, timeToMin, CATEGORIES } from './utils.js';
import { undoToast, confirmDialog } from './ui.js';

export function getMeeting(id) { return getState().meetings.find((m) => m.id === id); }

/** Fecha/hora de inicio como Date. */
export function meetingStart(m) { return parseLocal(m.date, m.start); }
export function meetingEnd(m) { return parseLocal(m.date, m.end); }

function normalize(data) {
  const now = new Date().toISOString();
  return {
    id: data.id || uid('m'),
    title: (data.title || 'Reunión').trim(),
    category: CATEGORIES[data.category] ? data.category : 'trabajo',
    date: data.date || todayISO(),
    start: data.start || '09:00',
    end: data.end || '10:00',
    location: data.location || '',
    participants: data.participants || '',
    notes: data.notes || '',
    reminder: data.reminder === undefined ? null : data.reminder,
    createdAt: data.createdAt || now,
    updatedAt: now,
  };
}

export function createMeeting(data) {
  const m = normalize(data);
  update((s) => { s.meetings.push(m); }, { type: 'meeting-create', id: m.id });
  return m;
}

export function updateMeeting(id, patch) {
  update((s) => {
    const m = s.meetings.find((x) => x.id === id);
    if (m) Object.assign(m, patch, { updatedAt: new Date().toISOString() });
  }, { type: 'meeting-update', id });
}

export function deleteMeeting(id) {
  const index = getState().meetings.findIndex((x) => x.id === id);
  if (index < 0) return;
  const m = clone(getState().meetings[index]);
  update((s) => { s.meetings.splice(index, 1); }, { type: 'meeting-delete', id });
  undoToast(`Reunión «${m.title}» eliminada`, () => update((s) => {
    if (!s.meetings.some((x) => x.id === id)) s.meetings.splice(Math.min(index, s.meetings.length), 0, m);
  }, { type: 'undo' }));
}

export async function removeMeetingWithConfirm(id) {
  const m = getMeeting(id);
  if (!m) return;
  const ok = await confirmDialog({ title: 'Borrar reunión', message: `¿Seguro que quieres borrar «${m.title}»?`, confirmLabel: 'Borrar', danger: true });
  if (ok) deleteMeeting(id);
}

/**
 * Devuelve las reuniones que se solapan con la dada (mismo día e intervalos que se cruzan).
 * Se comprueban TODAS las categorías: un solapamiento es real aunque el filtro lo oculte.
 */
export function findOverlaps(m) {
  if (!m.date || !m.start || !m.end) return [];
  const a1 = timeToMin(m.start); const a2 = timeToMin(m.end);
  return getState().meetings.filter((o) => o.id !== m.id && o.date === m.date
    && a1 < timeToMin(o.end) && timeToMin(o.start) < a2);
}

/** Reuniones de una fecha (según filtro), ordenadas por hora. */
export function meetingsOn(dateStr, { filtered = true } = {}) {
  return getState().meetings
    .filter((m) => m.date === dateStr && (!filtered || matchesFilter(m)))
    .sort((a, b) => a.start.localeCompare(b.start));
}

/** Próximas reuniones (que aún no han terminado), según filtro. */
export function upcomingMeetings(limit = 5) {
  const now = new Date();
  return getState().meetings
    .filter(matchesFilter)
    .filter((m) => meetingEnd(m) >= now)
    .sort((a, b) => meetingStart(a) - meetingStart(b))
    .slice(0, limit);
}

/** Duración en minutos. */
export function durationMin(m) { return Math.max(15, timeToMin(m.end) - timeToMin(m.start)); }
