/**
 * reminders.js — Avisos independientes, motor de avisos, sonido y vista "Avisos".
 *
 * Modelo Reminder (aviso independiente, sin tarea asociada):
 *   { id, title, category, date: 'AAAA-MM-DD', time: 'HH:mm', lead: minutos, done, createdAt }
 *
 * Registro de avisos disparados (state.alerts.log), AlertEntry:
 *   { id, key, kind: 'task'|'meeting'|'reminder', refId, title, category,
 *     dueAt (ISO), firedAt (ISO), status: 'active'|'snoozed'|'done'|'dismissed',
 *     snoozeUntil (ISO|null), missed: boolean }
 *
 * El motor revisa cada 30 s tareas, reuniones y avisos. La clave `key` incluye la
 * fecha y la antelación, de modo que si se edita la hora el aviso vuelve a programarse.
 */
import { getState, update, clone, matchesFilter } from './store.js';
import {
  uid, esc, parseLocal, relDay, toTime, toISODate, leadLabel, CATEGORIES,
} from './utils.js';
import { icon, emptyReminders } from './illustrations.js';
import {
  toast, undoToast, confirmDialog, catBadge, openTaskDetail, openMeetingDetail, openReminderForm,
} from './ui.js';
import * as Tasks from './tasks.js';

const CHECK_INTERVAL = 30_000;      // 30 s
const SNOOZE_MIN = 10;
const MAX_AGE_DAYS = 30;            // no recuperar avisos más antiguos
const KIND_LABEL = { task: 'Tarea', meeting: 'Reunión', reminder: 'Aviso' };

/* ================================================================== */
/* Avisos independientes (CRUD)                                        */
/* ================================================================== */
export function getReminder(id) { return getState().reminders.find((r) => r.id === id); }

export function createReminder(data) {
  const r = {
    id: uid('r'), title: data.title.trim(), category: CATEGORIES[data.category] ? data.category : 'personal',
    date: data.date, time: data.time, lead: Number(data.lead) || 0, done: false, createdAt: new Date().toISOString(),
  };
  update((s) => { s.reminders.push(r); }, { type: 'reminder-create', id: r.id });
  checkNow();
  return r;
}
export function updateReminder(id, patch) {
  update((s) => { const r = s.reminders.find((x) => x.id === id); if (r) Object.assign(r, patch, { done: false }); }, { type: 'reminder-update', id });
  checkNow();
}
export function deleteReminder(id) {
  const index = getState().reminders.findIndex((x) => x.id === id);
  if (index < 0) return;
  const r = clone(getState().reminders[index]);
  update((s) => { s.reminders.splice(index, 1); }, { type: 'reminder-delete', id });
  undoToast(`Aviso «${r.title}» eliminado`, () => update((s) => {
    if (!s.reminders.some((x) => x.id === id)) s.reminders.splice(Math.min(index, s.reminders.length), 0, r);
  }, { type: 'undo' }));
}
export async function removeReminderWithConfirm(id) {
  const r = getReminder(id);
  if (!r) return;
  const ok = await confirmDialog({ title: 'Borrar aviso', message: `¿Seguro que quieres borrar «${r.title}»?`, confirmLabel: 'Borrar', danger: true });
  if (ok) deleteReminder(id);
}

/* ================================================================== */
/* Fuentes de avisos                                                   */
/* ================================================================== */

/**
 * Lista todos los avisos programables (disparados o no).
 * Las tareas sin hora avisan tomando las 09:00 de su fecha límite.
 */
export function collectSources() {
  const s = getState();
  const out = [];
  const push = (kind, item, dueAt, lead) => {
    if (!dueAt) return;
    const triggerAt = new Date(dueAt.getTime() - lead * 60000);
    out.push({
      key: `${kind}:${item.id}:${dueAt.toISOString()}:${lead}`,
      kind, refId: item.id, title: item.title, category: item.category,
      dueAt, triggerAt, lead, createdAt: item.createdAt ? new Date(item.createdAt) : null,
    });
  };
  for (const t of s.tasks) {
    if (t.status === 'done' || !t.dueDate || t.reminder === null || t.reminder === undefined) continue;
    push('task', t, parseLocal(t.dueDate, t.dueTime || '09:00'), Number(t.reminder));
  }
  for (const m of s.meetings) {
    if (m.reminder === null || m.reminder === undefined) continue;
    push('meeting', m, parseLocal(m.date, m.start), Number(m.reminder));
  }
  for (const r of s.reminders) {
    if (r.done) continue;
    push('reminder', r, parseLocal(r.date, r.time), Number(r.lead) || 0);
  }
  return out;
}

/* ================================================================== */
/* Motor                                                               */
/* ================================================================== */
let timer = null;
let bootTime = Date.now();
let firstRun = true;

export function startEngine() {
  bootTime = Date.now();
  firstRun = true;
  checkNow();
  clearInterval(timer);
  timer = setInterval(checkNow, CHECK_INTERVAL);
  // Revisar también al volver a la pestaña
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkNow(); });
}

/** Revisa los avisos pendientes de disparar. */
export function checkNow() {
  const now = new Date();
  const s = getState();
  const known = new Set(s.alerts.log.map((e) => e.key));
  const sources = collectSources();
  const sourceKeys = new Set(sources.map((x) => x.key));
  const fresh = [];   // avisos a mostrar ahora
  const missed = [];  // avisos perdidos mientras la app estaba cerrada
  const minDate = now.getTime() - MAX_AGE_DAYS * 86400000;

  for (const src of sources) {
    if (known.has(src.key) || src.triggerAt > now) continue;
    if (src.dueAt.getTime() < minDate) continue;
    // Si el elemento se creó cuando su fecha ya había pasado, no tiene sentido avisar
    if (src.createdAt && src.dueAt.getTime() + 60_000 < src.createdAt.getTime()) continue;
    const isMissed = src.triggerAt.getTime() < bootTime - 60_000 && firstRun;
    const entry = {
      id: uid('al'), key: src.key, kind: src.kind, refId: src.refId, title: src.title,
      category: src.category, dueAt: src.dueAt.toISOString(), firedAt: now.toISOString(),
      status: 'active', snoozeUntil: null, missed: isMissed,
    };
    (isMissed ? missed : fresh).push(entry);
  }

  // Pospuestos cuyo tiempo ha vencido
  const woken = s.alerts.log.filter((e) => e.status === 'snoozed' && e.snoozeUntil && new Date(e.snoozeUntil) <= now);
  // Activos cuya fuente ya no existe o se completó (p. ej. tarea hecha) -> resolver
  const stale = s.alerts.log.filter((e) => (e.status === 'active' || e.status === 'snoozed') && !sourceKeys.has(e.key));

  if (fresh.length || missed.length || woken.length || stale.length) {
    update((st) => {
      st.alerts.log.push(...fresh, ...missed);
      for (const w of woken) { const e = st.alerts.log.find((x) => x.id === w.id); e.status = 'active'; e.snoozeUntil = null; e.firedAt = now.toISOString(); }
      for (const o of stale) { const e = st.alerts.log.find((x) => x.id === o.id); e.status = 'done'; }
      // Mantener el historial acotado
      if (st.alerts.log.length > 300) st.alerts.log = st.alerts.log.slice(-300);
    }, { type: 'alerts' });
  }

  [...fresh, ...woken].forEach((e) => showAlertToast(e));
  if (fresh.length || woken.length) playChime();
  if (missed.length) {
    toast({
      type: 'warning', title: 'Avisos perdidos', duration: 10000,
      message: missed.length === 1
        ? `Mientras Organiza estaba cerrada venció: «${missed[0].title}».`
        : `Mientras Organiza estaba cerrada vencieron ${missed.length} avisos.`,
      actions: [{ label: 'Ver avisos', primary: true, onClick: () => { location.hash = '#/avisos'; } }],
    });
  }
  firstRun = false;
}

/** Toast animado de un aviso con acciones Hecho / Posponer / Abrir. */
function showAlertToast(entry) {
  const due = new Date(entry.dueAt);
  const when = `${relDay(toISODate(due))} a las ${toTime(due)}`;
  toast({
    type: 'alert', category: entry.category, duration: 20000,
    title: `${KIND_LABEL[entry.kind]} · ${CATEGORIES[entry.category]?.label || ''}`,
    message: `${entry.title} — ${when}`,
    actions: [
      { label: 'Hecho', primary: true, onClick: () => markDone(entry.id) },
      { label: `Posponer ${SNOOZE_MIN} min`, onClick: () => snooze(entry.id) },
      { label: 'Abrir', onClick: () => openSource(entry) },
    ],
  });
}

/* ---------- Acciones sobre avisos ---------- */
export function markDone(alertId) {
  const e = getState().alerts.log.find((x) => x.id === alertId);
  if (!e) return;
  update((s) => {
    const a = s.alerts.log.find((x) => x.id === alertId);
    a.status = 'done'; a.snoozeUntil = null;
    if (a.kind === 'reminder') { const r = s.reminders.find((x) => x.id === a.refId); if (r) r.done = true; }
  }, { type: 'alerts' });
  // En una tarea, "Hecho" completa la tarea
  if (e.kind === 'task' && Tasks.getTask(e.refId)?.status !== 'done') Tasks.setStatus(e.refId, 'done');
}
export function snooze(alertId, minutes = SNOOZE_MIN) {
  update((s) => {
    const a = s.alerts.log.find((x) => x.id === alertId);
    if (a) { a.status = 'snoozed'; a.snoozeUntil = new Date(Date.now() + minutes * 60000).toISOString(); }
  }, { type: 'alerts' });
  toast({ message: `Aviso pospuesto ${minutes} min`, duration: 2500 });
}
export function dismiss(alertId) {
  update((s) => { const a = s.alerts.log.find((x) => x.id === alertId); if (a) a.status = 'dismissed'; }, { type: 'alerts' });
}
export function openSource(entry) {
  if (entry.kind === 'task') openTaskDetail(entry.refId);
  if (entry.kind === 'meeting') openMeetingDetail(entry.refId);
  if (entry.kind === 'reminder') { const r = getReminder(entry.refId); if (r) openReminderForm(r); }
}
export function clearHistory() {
  update((s) => { s.alerts.log = s.alerts.log.filter((e) => e.status === 'active' || e.status === 'snoozed'); }, { type: 'alerts' });
}

/** Número de avisos pendientes de atender (para el contador). */
export function pendingCount() {
  return getState().alerts.log.filter((e) => e.status === 'active' && matchesFilter(e)).length;
}

/** Próximos avisos (aún no disparados) en los próximos `days` días. */
export function upcoming(days = 7) {
  const now = Date.now();
  const limit = now + days * 86400000;
  const known = new Set(getState().alerts.log.map((e) => e.key));
  return collectSources()
    .filter((x) => !known.has(x.key) && x.triggerAt.getTime() > now && x.triggerAt.getTime() <= limit)
    .filter(matchesFilter)
    .sort((a, b) => a.triggerAt - b.triggerAt);
}

/* ================================================================== */
/* Sonido (Web Audio API)                                              */
/* ================================================================== */
let audioCtx = null;
function ctx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  return audioCtx;
}
/** Desbloquea el audio tras el primer gesto del usuario (política de autoplay). */
export function unlockAudio() {
  const once = (e) => {
    if (e.type === 'keydown' && e.key === 'Escape') return; // Escape no cuenta como gesto de activación
    ctx()?.resume?.();
    window.removeEventListener('pointerdown', once); window.removeEventListener('keydown', once);
  };
  window.addEventListener('pointerdown', once);
  window.addEventListener('keydown', once);
}

/**
 * Sonido de alerta corto y agradable: dos notas suaves (Mi5 → La5)
 * con envolvente exponencial y un armónico ligero.
 * Si existiera un archivo en /assets/sounds se podría usar; aquí se genera por código.
 */
export function playChime(force = false) {
  const { sound, volume } = getState().settings;
  if (!sound && !force) return;
  const ac = ctx();
  if (!ac) return;
  if (ac.state === 'suspended') ac.resume?.();
  const t0 = ac.currentTime + 0.02;
  const master = ac.createGain();
  master.gain.value = Math.max(0, Math.min(1, Number(volume) || 0)) * 0.5;
  master.connect(ac.destination);
  [[659.25, 0], [880, 0.16]].forEach(([freq, offset]) => {
    [1, 2].forEach((harm) => {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = harm === 1 ? 'sine' : 'triangle';
      osc.frequency.value = freq * harm;
      const start = t0 + offset;
      const peak = harm === 1 ? 0.9 : 0.12;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(peak, start + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.9);
      osc.connect(g).connect(master);
      osc.start(start);
      osc.stop(start + 1);
    });
  });
}

/* ================================================================== */
/* Vista Avisos                                                        */
/* ================================================================== */
function whenText(date) {
  return `${relDay(toISODate(date))} · ${toTime(date)}`;
}

function entryHTML(e, mode) {
  const due = new Date(e.dueAt);
  return `<li class="alert-item cat-${e.category} ${e.status}" data-alert="${e.id}">
    <span class="alert-kind" aria-hidden="true">${icon(e.kind === 'task' ? 'list' : e.kind === 'meeting' ? 'meeting' : 'bell', 18)}</span>
    <div class="alert-main">
      <strong>${esc(e.title)}</strong>
      <div class="task-meta">${catBadge(e.category)}<span class="muted small">${KIND_LABEL[e.kind]} · ${whenText(due)}</span>
        ${e.missed ? '<span class="overdue-badge">Perdido</span>' : ''}
        ${e.status === 'snoozed' ? `<span class="status-badge status-doing">Pospuesto hasta ${toTime(new Date(e.snoozeUntil))}</span>` : ''}
        ${mode === 'history' ? `<span class="muted small">${e.status === 'done' ? 'Hecho' : 'Descartado'}</span>` : ''}</div>
    </div>
    <div class="alert-actions">
      ${mode === 'pending' ? `
        <button type="button" class="btn btn-sm btn-primary" data-a="done">${icon('check', 16)} Hecho</button>
        <button type="button" class="btn btn-sm btn-ghost" data-a="snooze">${icon('snooze', 16)} Posponer 10 min</button>
        <button type="button" class="btn btn-sm btn-ghost" data-a="open">${icon('open', 16)} Abrir</button>
        <button type="button" class="icon-btn" data-a="dismiss" aria-label="Descartar aviso ${esc(e.title)}" title="Descartar">${icon('close', 16)}</button>`
      : `<button type="button" class="btn btn-sm btn-ghost" data-a="open">${icon('open', 16)} Abrir</button>`}
    </div>
  </li>`;
}

function upcomingHTML(src) {
  const isRem = src.kind === 'reminder';
  return `<li class="alert-item cat-${src.category}" data-src-kind="${src.kind}" data-src-id="${src.refId}">
    <span class="alert-kind" aria-hidden="true">${icon(src.kind === 'task' ? 'list' : src.kind === 'meeting' ? 'meeting' : 'bell', 18)}</span>
    <div class="alert-main">
      <strong>${esc(src.title)}</strong>
      <div class="task-meta">${catBadge(src.category)}
        <span class="muted small">Sonará ${whenText(src.triggerAt)}${src.lead ? ` (${leadLabel(src.lead).toLowerCase()} de las ${toTime(src.dueAt)})` : ''}</span></div>
    </div>
    <div class="alert-actions">
      <button type="button" class="btn btn-sm btn-ghost" data-u="open">${icon(isRem ? 'edit' : 'open', 16)} ${isRem ? 'Editar' : 'Abrir'}</button>
      ${isRem ? `<button type="button" class="icon-btn danger" data-u="delete" aria-label="Borrar aviso ${esc(src.title)}">${icon('trash', 16)}</button>` : ''}
    </div>
  </li>`;
}

export const RemindersView = {
  el: null,
  mount(el) {
    this.el = el;
    el.innerHTML = `
      <header class="view-header">
        <div><h1>Avisos</h1><p class="muted">Se revisan automáticamente cada 30 segundos.</p></div>
        <button type="button" class="btn btn-primary" id="rem-new">${icon('plus', 18)} Nuevo aviso</button>
      </header>
      <section class="panel" aria-labelledby="rem-pending-h"><h2 id="rem-pending-h">Pendientes <span class="count" id="rem-pending-n"></span></h2><ul class="alert-list" id="rem-pending"></ul></section>
      <section class="panel" aria-labelledby="rem-up-h"><h2 id="rem-up-h">Próximos 7 días</h2><ul class="alert-list" id="rem-up"></ul></section>
      <section class="panel" aria-labelledby="rem-hist-h">
        <div class="panel-head"><h2 id="rem-hist-h">Historial</h2><button type="button" class="btn btn-sm btn-ghost" id="rem-clear">Limpiar historial</button></div>
        <ul class="alert-list" id="rem-hist"></ul></section>`;
    el.querySelector('#rem-new').addEventListener('click', () => openReminderForm());
    el.querySelector('#rem-clear').addEventListener('click', async () => {
      if (await confirmDialog({ title: 'Limpiar historial', message: 'Se borrará el historial de avisos atendidos.', confirmLabel: 'Limpiar' })) clearHistory();
    });
    el.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-a]');
      if (b) {
        const id = b.closest('[data-alert]').dataset.alert;
        const entry = getState().alerts.log.find((x) => x.id === id);
        if (b.dataset.a === 'done') markDone(id);
        if (b.dataset.a === 'snooze') snooze(id);
        if (b.dataset.a === 'dismiss') dismiss(id);
        if (b.dataset.a === 'open' && entry) openSource(entry);
        return;
      }
      const u = ev.target.closest('[data-u]');
      if (u) {
        const li = u.closest('[data-src-id]');
        const entry = { kind: li.dataset.srcKind, refId: li.dataset.srcId };
        if (u.dataset.u === 'open') openSource(entry);
        if (u.dataset.u === 'delete') removeReminderWithConfirm(entry.refId);
      }
    });
    this.update();
  },
  update() {
    if (!this.el) return;
    const log = getState().alerts.log.filter(matchesFilter);
    const pending = log.filter((e) => e.status === 'active' || e.status === 'snoozed').sort((a, b) => b.dueAt.localeCompare(a.dueAt));
    const history = log.filter((e) => e.status === 'done' || e.status === 'dismissed').sort((a, b) => b.firedAt.localeCompare(a.firedAt)).slice(0, 50);
    const up = upcoming(7);
    const empty = (title, text, ill = '') => `<li class="empty ${ill ? '' : 'compact'}">${ill}<h3>${title}</h3><p class="muted">${text}</p></li>`;
    this.el.querySelector('#rem-pending-n').textContent = pending.length ? `(${pending.length})` : '';
    this.el.querySelector('#rem-pending').innerHTML = pending.length ? pending.map((e) => entryHTML(e, 'pending')).join('')
      : empty('Nada pendiente', 'Cuando venza un aviso aparecerá aquí.', emptyReminders());
    this.el.querySelector('#rem-up').innerHTML = up.length ? up.map(upcomingHTML).join('')
      : empty('Sin avisos programados', 'Añade un aviso o configura la antelación en tareas y reuniones.');
    this.el.querySelector('#rem-hist').innerHTML = history.length ? history.map((e) => entryHTML(e, 'history')).join('')
      : empty('Historial vacío', 'Aquí verás los avisos ya atendidos.');
  },
  unmount() { this.el = null; },
};

/** Lista de avisos independientes de un día (para el calendario). */
export function remindersOn(dateStr) {
  return getState().reminders.filter((r) => r.date === dateStr && matchesFilter(r)).sort((a, b) => a.time.localeCompare(b.time));
}
