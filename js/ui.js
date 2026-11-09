/**
 * ui.js — Componentes de interfaz reutilizables: modales (<dialog>), toasts,
 * confirmaciones, campos de fecha/hora en formato español y los formularios
 * de Tarea, Reunión y Aviso, además del detalle de tarea.
 */
import { getState, update, tagById } from './store.js';
import {
  CATEGORIES, CATEGORY_IDS, PRIORITIES, STATUSES, LEAD_OPTIONS, WEEKDAYS_SHORT, WEEKDAYS,
  esc, uid, fmtDate, parseDisplayDate, parseLocal, normalizeTime, todayISO, relDay, leadLabel,
} from './utils.js';
import { icon } from './illustrations.js';
import * as Tasks from './tasks.js';
import * as Meetings from './meetings.js';
import * as Reminders from './reminders.js';

/* ================================================================== */
/* Toasts                                                              */
/* ================================================================== */

/**
 * Muestra una notificación flotante.
 * @param {object} opts
 * @param {string} opts.message      texto principal
 * @param {string} [opts.title]      título opcional
 * @param {'info'|'success'|'warning'|'error'|'alert'} [opts.type]
 * @param {Array<{label:string,onClick:Function,primary?:boolean}>} [opts.actions]
 * @param {number} [opts.duration]   ms (0 = hasta que se cierre)
 * @param {string} [opts.category]   categoría para colorear el borde
 */
export function toast({ message, title = '', type = 'info', actions = [], duration = 4000, category = '' } = {}) {
  const host = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast toast-${type} ${category ? `cat-${category}` : ''}`;
  el.setAttribute('role', type === 'alert' || type === 'error' ? 'alert' : 'status');
  const iconName = { success: 'check', warning: 'warning', error: 'warning', alert: 'bell' }[type] || 'sparkle';
  el.innerHTML = `
    <span class="toast-icon">${icon(iconName, 18)}</span>
    <div class="toast-body">
      ${title ? `<strong class="toast-title">${esc(title)}</strong>` : ''}
      <span class="toast-msg">${esc(message)}</span>
      ${actions.length ? `<div class="toast-actions">${actions.map((a, i) =>
        `<button type="button" class="btn btn-sm ${a.primary ? 'btn-primary' : 'btn-ghost'}" data-i="${i}">${esc(a.label)}</button>`).join('')}</div>` : ''}
    </div>
    <button type="button" class="icon-btn toast-close" aria-label="Cerrar notificación">${icon('close', 16)}</button>
    ${duration ? `<span class="toast-timer" style="animation-duration:${duration}ms"></span>` : ''}`;
  host.appendChild(el);

  let timer = null;
  const close = () => {
    clearTimeout(timer);
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 220);
  };
  el.querySelector('.toast-close').addEventListener('click', close);
  el.querySelectorAll('.toast-actions button').forEach((b) => {
    b.addEventListener('click', () => { actions[Number(b.dataset.i)].onClick?.(); close(); });
  });
  if (duration) {
    // Pausar el temporizador al pasar el ratón por encima o enfocar
    let remaining = duration; let start = Date.now();
    const run = () => { start = Date.now(); timer = setTimeout(close, remaining); };
    const pause = () => { clearTimeout(timer); remaining -= Date.now() - start; el.classList.add('paused'); };
    const resume = () => { el.classList.remove('paused'); run(); };
    el.addEventListener('mouseenter', pause); el.addEventListener('mouseleave', resume);
    el.addEventListener('focusin', pause); el.addEventListener('focusout', resume);
    run();
  }
  // Limitar a 4 toasts visibles
  const all = host.querySelectorAll('.toast:not(.leaving)');
  if (all.length > 4) all[0].remove();
  return { close, el };
}

/** Toast con opción "Deshacer" durante 5 s. */
export function undoToast(message, onUndo) {
  return toast({ message, type: 'info', duration: 5000, actions: [{ label: 'Deshacer', primary: true, onClick: onUndo }] });
}

/* ================================================================== */
/* Modales                                                             */
/* ================================================================== */

/**
 * Abre un modal accesible basado en <dialog>.
 * @returns {{el: HTMLDialogElement, close: Function}}
 */
export function openModal({ title, body, footer = '', size = 'md', onMount, onClose, className = '' }) {
  const opener = document.activeElement;
  const dlg = document.createElement('dialog');
  const titleId = uid('dlg');
  dlg.className = `modal modal-${size} ${className}`;
  dlg.setAttribute('aria-labelledby', titleId);
  dlg.innerHTML = `
    <div class="modal-inner">
      <header class="modal-header">
        <h2 id="${titleId}" class="modal-title">${title}</h2>
        <button type="button" class="icon-btn" data-close aria-label="Cerrar">${icon('close')}</button>
      </header>
      <div class="modal-body">${body}</div>
      ${footer ? `<footer class="modal-footer">${footer}</footer>` : ''}
    </div>`;
  document.body.appendChild(dlg);

  let closed = false;
  const close = (result) => {
    if (closed) return; closed = true;
    dlg.classList.add('closing');
    setTimeout(() => {
      if (dlg.open) dlg.close();
      dlg.remove();
      onClose?.(result);
      if (opener && document.contains(opener)) opener.focus?.();
    }, 160);
  };
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) close(); // clic en el fondo
    if (e.target.closest('[data-close]')) close();
  });
  if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  onMount?.(dlg, close);
  // Foco inicial en el primer campo
  const first = dlg.querySelector('[autofocus], input:not([type=hidden]):not(.native-picker), select, textarea, .modal-body button');
  first?.focus();
  return { el: dlg, close };
}

/** Diálogo de confirmación. Devuelve una promesa con true/false. */
export function confirmDialog({ title = '¿Estás seguro?', message = '', confirmLabel = 'Confirmar', danger = false }) {
  return new Promise((resolve) => {
    let result = false;
    openModal({
      title: esc(title),
      size: 'sm',
      body: `<p class="confirm-msg">${esc(message)}</p>`,
      footer: `<button type="button" class="btn btn-ghost" data-close>Cancelar</button>
               <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok autofocus>${esc(confirmLabel)}</button>`,
      onMount: (dlg, close) => {
        dlg.querySelector('[data-ok]').addEventListener('click', () => { result = true; close(); });
        dlg.querySelector('[data-ok]').focus();
      },
      onClose: () => resolve(result),
    });
  });
}

/* ================================================================== */
/* Piezas de formulario                                                */
/* ================================================================== */

/** Insignia de categoría. */
export function catBadge(cat, withLabel = true) {
  const c = CATEGORIES[cat] || CATEGORIES.personal;
  return `<span class="cat-badge cat-${c.id}" title="${c.label}">${icon(c.id, 14)}${withLabel ? `<span>${c.label}</span>` : `<span class="sr-only">${c.label}</span>`}</span>`;
}
/** Insignia de prioridad. */
export function prioBadge(p) {
  const pr = PRIORITIES[p] || PRIORITIES.media;
  return `<span class="prio-badge prio-${pr.id}"><span class="dot"></span>${pr.label}</span>`;
}
/** Chips de etiquetas. */
export function tagChips(ids = []) {
  return ids.map(tagById).filter(Boolean)
    .map((t) => `<span class="tag-chip" style="--tag:${esc(t.color)}">#${esc(t.name)}</span>`).join('');
}

/** Campo de fecha dd/mm/aaaa con selector nativo de apoyo. */
export function dateField({ id, name, value = '', label, required = false }) {
  return `<div class="field">
    <label for="${id}">${label}${required ? ' <span aria-hidden="true">*</span>' : ''}</label>
    <div class="date-field">
      <input type="text" id="${id}" name="${name}" inputmode="numeric" placeholder="dd/mm/aaaa" maxlength="10"
        autocomplete="off" value="${value ? fmtDate(value) : ''}" ${required ? 'required' : ''} data-date-input>
      <button type="button" class="icon-btn" data-date-pick aria-label="Elegir fecha en calendario">${icon('calendar', 18)}</button>
      <input type="date" class="native-picker" tabindex="-1" aria-hidden="true">
    </div>
  </div>`;
}
/** Campo de hora 24 h (hh:mm). */
export function timeField({ id, name, value = '', label, required = false }) {
  return `<div class="field">
    <label for="${id}">${label}${required ? ' <span aria-hidden="true">*</span>' : ''}</label>
    <input type="text" id="${id}" name="${name}" inputmode="numeric" placeholder="hh:mm" maxlength="5"
      autocomplete="off" value="${esc(value)}" ${required ? 'required' : ''} data-time-input>
  </div>`;
}
/** Selector de categoría como grupo de radios con aspecto de chips. */
function categoryRadios(name, value) {
  return `<fieldset class="field chips-field"><legend>Categoría</legend><div class="chips">
    ${CATEGORY_IDS.map((c) => `<label class="chip-radio cat-${c}">
      <input type="radio" name="${name}" value="${c}" ${value === c ? 'checked' : ''}>
      <span>${icon(c, 15)} ${CATEGORIES[c].label}</span></label>`).join('')}
  </div></fieldset>`;
}
/** Selector de antelación del aviso. */
function leadSelect(id, value) {
  return `<div class="field"><label for="${id}">Aviso</label>
    <select id="${id}" name="reminder">
      <option value="" ${value === null || value === undefined || value === '' ? 'selected' : ''}>Sin aviso</option>
      ${LEAD_OPTIONS.map((o) => `<option value="${o.value}" ${Number(value) === o.value && value !== null && value !== '' ? 'selected' : ''}>${o.label}</option>`).join('')}
    </select></div>`;
}

/** Conecta el comportamiento de los campos de fecha y hora dentro de un contenedor. */
export function wireDateTimeFields(root) {
  root.querySelectorAll('.date-field').forEach((wrap) => {
    const text = wrap.querySelector('[data-date-input]');
    const native = wrap.querySelector('.native-picker');
    const btn = wrap.querySelector('[data-date-pick]');
    // Inserta las barras automáticamente al escribir
    text.addEventListener('input', (e) => {
      if (e.inputType?.startsWith('delete')) return;
      let v = text.value.replace(/[^\d/]/g, '');
      if (/^\d{2}$/.test(v) || /^\d{1,2}\/\d{2}$/.test(v)) v += '/';
      text.value = v.slice(0, 10);
    });
    text.addEventListener('blur', () => validateDate(text));
    btn.addEventListener('click', () => {
      native.value = parseDisplayDate(text.value) || todayISO();
      try { native.showPicker(); } catch { native.focus(); native.click(); }
    });
    native.addEventListener('change', () => {
      if (native.value) { text.value = fmtDate(native.value); validateDate(text); text.dispatchEvent(new Event('change', { bubbles: true })); }
    });
  });
  root.querySelectorAll('[data-time-input]').forEach((inp) => {
    inp.addEventListener('input', (e) => {
      if (e.inputType?.startsWith('delete')) return;
      let v = inp.value.replace(/[^\d:]/g, '');
      if (/^\d{2}$/.test(v)) v += ':';
      inp.value = v.slice(0, 5);
    });
    inp.addEventListener('blur', () => {
      if (!inp.value) { inp.setCustomValidity(''); return; }
      const n = normalizeTime(inp.value);
      if (n) { inp.value = n; inp.setCustomValidity(''); } else inp.setCustomValidity('Hora no válida (usa hh:mm, 24 h).');
    });
  });
}
function validateDate(text) {
  if (!text.value) { text.setCustomValidity(''); return; }
  text.setCustomValidity(parseDisplayDate(text.value) ? '' : 'Fecha no válida (usa dd/mm/aaaa).');
}

/** Lee un campo de fecha ya validado -> 'AAAA-MM-DD' o ''. */
function readDate(form, name) {
  return parseDisplayDate(form.elements[name].value) || '';
}
function readTime(form, name) {
  return normalizeTime(form.elements[name].value) || '';
}
function readLead(form) {
  const v = form.elements.reminder.value;
  return v === '' ? null : Number(v);
}

/** Muestra los errores de validación nativos y devuelve si el formulario es válido. */
function checkForm(form) {
  form.querySelectorAll('[data-date-input]').forEach(validateDate);
  form.querySelectorAll('[data-time-input]').forEach((i) => i.dispatchEvent(new Event('blur')));
  if (!form.checkValidity()) { form.reportValidity(); return false; }
  return true;
}

/* ================================================================== */
/* Formulario de Tarea                                                 */
/* ================================================================== */

/**
 * Abre el formulario de tarea (crear o editar).
 * @param {object|null} task     tarea existente o null para crear
 * @param {object} defaults      valores iniciales (p. ej. { dueDate })
 */
export function openTaskForm(task = null, defaults = {}) {
  const s = getState();
  const isEdit = !!task;
  const filterCat = s.settings.filter !== 'all' ? s.settings.filter : 'personal';
  const t = task ? structuredClone(task) : {
    title: '', description: '', category: filterCat, priority: 'media', tags: [],
    dueDate: '', dueTime: '', status: 'pending', subtasks: [],
    recurrence: { type: 'none', days: [] }, reminder: null, ...defaults,
  };
  if (!isEdit && t.dueDate && t.reminder === null && defaults.reminder === undefined) t.reminder = s.settings.defaultLead;

  const body = `<form class="form" novalidate id="task-form">
    <div class="field"><label for="tf-title">Título <span aria-hidden="true">*</span></label>
      <input id="tf-title" name="title" required maxlength="140" value="${esc(t.title)}" autofocus placeholder="¿Qué hay que hacer?"></div>
    <div class="field"><label for="tf-desc">Descripción</label>
      <textarea id="tf-desc" name="description" rows="2" maxlength="2000" placeholder="Detalles opcionales">${esc(t.description)}</textarea></div>
    ${categoryRadios('category', t.category)}
    <div class="grid-2">
      <fieldset class="field chips-field"><legend>Prioridad</legend><div class="chips">
        ${Object.values(PRIORITIES).map((p) => `<label class="chip-radio prio-${p.id}">
          <input type="radio" name="priority" value="${p.id}" ${t.priority === p.id ? 'checked' : ''}>
          <span><span class="dot"></span>${p.label}</span></label>`).join('')}
      </div></fieldset>
      <div class="field"><label for="tf-status">Estado</label>
        <select id="tf-status" name="status">${Object.values(STATUSES).map((st) =>
          `<option value="${st.id}" ${t.status === st.id ? 'selected' : ''}>${st.label}</option>`).join('')}</select></div>
    </div>
    <div class="grid-2">
      ${dateField({ id: 'tf-date', name: 'dueDate', value: t.dueDate, label: 'Fecha límite' })}
      ${timeField({ id: 'tf-time', name: 'dueTime', value: t.dueTime, label: 'Hora límite' })}
    </div>
    <div class="grid-2">
      <div class="field"><label for="tf-rec">Repetir</label>
        <select id="tf-rec" name="recurrence">
          ${[['none', 'No se repite'], ['daily', 'Cada día'], ['weekly', 'Cada semana'], ['monthly', 'Cada mes']]
            .map(([v, l]) => `<option value="${v}" ${t.recurrence?.type === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select></div>
      ${leadSelect('tf-lead', t.reminder)}
    </div>
    <fieldset class="field weekdays" id="tf-days" ${t.recurrence?.type === 'weekly' ? '' : 'hidden'}>
      <legend>Días de la semana</legend><div class="chips">
      ${WEEKDAYS_SHORT.map((d, i) => `<label class="chip-check" title="${WEEKDAYS[i]}">
        <input type="checkbox" name="days" value="${i}" ${t.recurrence?.days?.includes(i) ? 'checked' : ''}>
        <span aria-hidden="true">${d}</span><span class="sr-only">${WEEKDAYS[i]}</span></label>`).join('')}
      </div></fieldset>
    <fieldset class="field"><legend>Etiquetas</legend>
      <div class="chips" id="tf-tags">${tagCheckboxes(t.tags)}</div>
      <div class="inline-add">
        <label for="tf-newtag" class="sr-only">Nueva etiqueta</label>
        <input id="tf-newtag" placeholder="Nueva etiqueta" maxlength="24">
        <input type="color" id="tf-newtag-color" value="#6b9bd1" aria-label="Color de la nueva etiqueta">
        <button type="button" class="btn btn-sm btn-ghost" id="tf-addtag">${icon('plus', 16)} Crear</button>
      </div>
    </fieldset>
    <fieldset class="field"><legend>Subtareas</legend>
      <ul class="subtask-editor" id="tf-subs">${t.subtasks.map(subtaskRow).join('')}</ul>
      <div class="inline-add">
        <label for="tf-newsub" class="sr-only">Nueva subtarea</label>
        <input id="tf-newsub" placeholder="Añadir subtarea y pulsar Enter" maxlength="140">
        <button type="button" class="btn btn-sm btn-ghost" id="tf-addsub">${icon('plus', 16)} Añadir</button>
      </div>
    </fieldset>
  </form>`;

  openModal({
    title: isEdit ? 'Editar tarea' : 'Nueva tarea',
    body,
    size: 'lg',
    footer: `<button type="button" class="btn btn-ghost" data-close>Cancelar</button>
             <button type="submit" form="task-form" class="btn btn-primary">${isEdit ? 'Guardar cambios' : 'Crear tarea'}</button>`,
    onMount: (dlg, close) => {
      const form = dlg.querySelector('#task-form');
      wireDateTimeFields(form);
      const rec = form.elements.recurrence;
      rec.addEventListener('change', () => { dlg.querySelector('#tf-days').hidden = rec.value !== 'weekly'; });
      // Al poner fecha por primera vez, proponer la antelación por defecto
      form.elements.dueDate.addEventListener('change', () => {
        if (form.elements.reminder.value === '' && !isEdit) form.elements.reminder.value = String(s.settings.defaultLead);
      });

      // Subtareas
      const subs = dlg.querySelector('#tf-subs');
      const newSub = dlg.querySelector('#tf-newsub');
      const addSub = () => {
        const text = newSub.value.trim(); if (!text) return;
        subs.insertAdjacentHTML('beforeend', subtaskRow({ id: uid('st'), text, done: false }));
        newSub.value = ''; newSub.focus();
      };
      dlg.querySelector('#tf-addsub').addEventListener('click', addSub);
      newSub.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addSub(); } });
      subs.addEventListener('click', (e) => { const b = e.target.closest('[data-del-sub]'); if (b) b.closest('li').remove(); });

      // Etiquetas rápidas
      dlg.querySelector('#tf-addtag').addEventListener('click', () => {
        const name = dlg.querySelector('#tf-newtag').value.trim();
        if (!name) return;
        const tag = Tasks.createTag(name, dlg.querySelector('#tf-newtag-color').value);
        const checked = [...form.querySelectorAll('input[name=tags]:checked')].map((i) => i.value);
        dlg.querySelector('#tf-tags').innerHTML = tagCheckboxes([...checked, tag.id]);
        dlg.querySelector('#tf-newtag').value = '';
      });

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!checkForm(form)) return;
        const dueDate = readDate(form, 'dueDate');
        const recType = form.elements.recurrence.value;
        let days = [...form.querySelectorAll('input[name=days]:checked')].map((i) => Number(i.value));
        if (recType === 'weekly' && !days.length) {
          // Si no se eligió ningún día, usar el de la fecha límite (o hoy)
          const base = dueDate ? parseLocal(dueDate) : new Date();
          days = [(base.getDay() + 6) % 7];
        }
        const data = {
          title: form.elements.title.value.trim(),
          description: form.elements.description.value.trim(),
          category: form.elements.category.value || 'personal',
          priority: form.elements.priority.value || 'media',
          status: form.elements.status.value,
          dueDate,
          dueTime: dueDate ? readTime(form, 'dueTime') : '',
          recurrence: { type: recType, days: recType === 'weekly' ? days : [] },
          reminder: dueDate ? readLead(form) : null,
          tags: [...form.querySelectorAll('input[name=tags]:checked')].map((i) => i.value),
          subtasks: [...subs.querySelectorAll('li')].map((li) => ({
            id: li.dataset.id, text: li.querySelector('input[type=text]').value.trim(),
            done: li.querySelector('input[type=checkbox]').checked,
          })).filter((st) => st.text),
        };
        if (recType !== 'none' && !dueDate) data.dueDate = todayISO();
        if (isEdit) { Tasks.updateTask(task.id, data); toast({ message: 'Tarea actualizada', type: 'success', duration: 2500 }); }
        else { Tasks.createTask(data); toast({ message: 'Tarea creada', type: 'success', duration: 2500 }); }
        close();
      });
    },
  });
}
function tagCheckboxes(selected = []) {
  const tags = getState().tags;
  if (!tags.length) return '<span class="muted small">Aún no hay etiquetas.</span>';
  return tags.map((tg) => `<label class="chip-check tag" style="--tag:${esc(tg.color)}">
    <input type="checkbox" name="tags" value="${tg.id}" ${selected.includes(tg.id) ? 'checked' : ''}>
    <span>#${esc(tg.name)}</span></label>`).join('');
}
function subtaskRow(st) {
  return `<li data-id="${st.id}">
    <input type="checkbox" ${st.done ? 'checked' : ''} aria-label="Completada">
    <input type="text" value="${esc(st.text)}" aria-label="Texto de la subtarea" maxlength="140">
    <button type="button" class="icon-btn" data-del-sub aria-label="Quitar subtarea">${icon('close', 16)}</button></li>`;
}

/* ================================================================== */
/* Detalle de tarea                                                    */
/* ================================================================== */
export function openTaskDetail(id) {
  const task = Tasks.getTask(id);
  if (!task) { toast({ message: 'La tarea ya no existe.', type: 'warning' }); return; }
  const render = (t) => {
    const prog = Tasks.progress(t);
    const overdue = Tasks.isOverdue(t);
    return `<div class="detail">
      <div class="detail-badges">${catBadge(t.category)} ${prioBadge(t.priority)}
        <span class="status-badge status-${t.status}">${STATUSES[t.status].label}</span>
        ${overdue ? '<span class="overdue-badge">Vencida</span>' : ''}</div>
      ${t.description ? `<p class="detail-desc">${esc(t.description)}</p>` : ''}
      <dl class="detail-meta">
        ${t.dueDate ? `<div><dt>${icon('clock', 16)} Fecha límite</dt><dd>${relDay(t.dueDate)}${t.dueDate && relDay(t.dueDate) !== fmtDate(t.dueDate) ? ` (${fmtDate(t.dueDate)})` : ''}${t.dueTime ? ` · ${t.dueTime}` : ''}</dd></div>` : ''}
        ${t.recurrence?.type !== 'none' ? `<div><dt>${icon('repeat', 16)} Repetición</dt><dd>${Tasks.recurrenceLabel(t)}</dd></div>` : ''}
        ${t.reminder !== null && t.reminder !== undefined && t.dueDate ? `<div><dt>${icon('bell', 16)} Aviso</dt><dd>${leadLabel(t.reminder)}</dd></div>` : ''}
        ${t.tags.length ? `<div><dt>${icon('tag', 16)} Etiquetas</dt><dd class="chips">${tagChips(t.tags)}</dd></div>` : ''}
      </dl>
      ${t.subtasks.length ? `<section class="detail-subs" aria-label="Subtareas">
        <div class="progress-row"><span>Subtareas ${prog.done}/${prog.total}</span>
        <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${prog.pct}" aria-label="Progreso de subtareas"><span style="width:${prog.pct}%"></span></div></div>
        <ul class="checklist">${t.subtasks.map((st) => `<li><label><input type="checkbox" data-sub="${st.id}" ${st.done ? 'checked' : ''}><span>${esc(st.text)}</span></label></li>`).join('')}</ul>
      </section>` : ''}
    </div>`;
  };
  openModal({
    title: esc(task.title),
    body: `<div data-detail>${render(task)}</div>`,
    size: 'md',
    footer: `<button type="button" class="btn btn-ghost btn-danger-text" data-act="delete">${icon('trash', 16)} Borrar</button>
      <button type="button" class="btn btn-ghost" data-act="duplicate">${icon('copy', 16)} Duplicar</button>
      <button type="button" class="btn btn-ghost" data-act="edit">${icon('edit', 16)} Editar</button>
      <button type="button" class="btn btn-primary" data-act="toggle">${icon('check', 16)} ${task.status === 'done' ? 'Reabrir' : 'Completar'}</button>`,
    onMount: (dlg, close) => {
      dlg.addEventListener('change', (e) => {
        const sub = e.target.closest('[data-sub]');
        if (!sub) return;
        Tasks.toggleSubtask(id, sub.dataset.sub);
        const fresh = Tasks.getTask(id);
        if (fresh) dlg.querySelector('[data-detail]').innerHTML = render(fresh);
        dlg.querySelector(`[data-sub="${sub.dataset.sub}"]`)?.focus();
      });
      dlg.querySelector('.modal-footer').addEventListener('click', async (e) => {
        const b = e.target.closest('[data-act]'); if (!b) return;
        const act = b.dataset.act;
        if (act === 'edit') { close(); setTimeout(() => openTaskForm(Tasks.getTask(id)), 170); }
        if (act === 'duplicate') { Tasks.duplicateTask(id); close(); }
        if (act === 'toggle') { Tasks.toggleDone(id); close(); }
        if (act === 'delete') { close(); setTimeout(() => Tasks.removeTaskWithConfirm(id), 170); }
      });
    },
  });
}

/* ================================================================== */
/* Formulario de Reunión                                               */
/* ================================================================== */
export function openMeetingForm(meeting = null, defaults = {}) {
  const s = getState();
  const isEdit = !!meeting;
  const filterCat = s.settings.filter !== 'all' ? s.settings.filter : 'trabajo';
  const m = meeting ? structuredClone(meeting) : {
    title: '', category: filterCat, date: todayISO(), start: '10:00', end: '11:00',
    location: '', participants: '', notes: '', reminder: s.settings.defaultLead, ...defaults,
  };
  const body = `<form class="form" novalidate id="meeting-form">
    <div class="field"><label for="mf-title">Título <span aria-hidden="true">*</span></label>
      <input id="mf-title" name="title" required maxlength="140" value="${esc(m.title)}" autofocus placeholder="Ej.: Reunión de equipo"></div>
    ${categoryRadios('category', m.category)}
    <div class="grid-3">
      ${dateField({ id: 'mf-date', name: 'date', value: m.date, label: 'Fecha', required: true })}
      ${timeField({ id: 'mf-start', name: 'start', value: m.start, label: 'Inicio', required: true })}
      ${timeField({ id: 'mf-end', name: 'end', value: m.end, label: 'Fin', required: true })}
    </div>
    <div class="overlap-warning" id="mf-overlap" role="status" aria-live="polite"></div>
    <div class="field"><label for="mf-loc">Lugar o enlace</label>
      <input id="mf-loc" name="location" maxlength="300" value="${esc(m.location)}" placeholder="Sala 2 o https://…"></div>
    <div class="field"><label for="mf-part">Participantes</label>
      <input id="mf-part" name="participants" maxlength="300" value="${esc(m.participants)}" placeholder="Ana, Luis, equipo de diseño…"></div>
    <div class="field"><label for="mf-notes">Notas</label>
      <textarea id="mf-notes" name="notes" rows="3" maxlength="3000">${esc(m.notes)}</textarea></div>
    ${leadSelect('mf-lead', m.reminder)}
  </form>`;
  openModal({
    title: isEdit ? 'Editar reunión' : 'Nueva reunión',
    body,
    size: 'lg',
    footer: `${isEdit ? `<button type="button" class="btn btn-ghost btn-danger-text" data-del>${icon('trash', 16)} Borrar</button>` : ''}
      <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
      <button type="submit" form="meeting-form" class="btn btn-primary">${isEdit ? 'Guardar cambios' : 'Crear reunión'}</button>`,
    onMount: (dlg, close) => {
      const form = dlg.querySelector('#meeting-form');
      wireDateTimeFields(form);
      const warn = dlg.querySelector('#mf-overlap');
      const collect = () => ({
        id: meeting?.id,
        title: form.elements.title.value.trim(),
        category: form.elements.category.value || 'trabajo',
        date: readDate(form, 'date'),
        start: readTime(form, 'start'),
        end: readTime(form, 'end'),
        location: form.elements.location.value.trim(),
        participants: form.elements.participants.value.trim(),
        notes: form.elements.notes.value.trim(),
        reminder: readLead(form),
      });
      // Avisar del solapamiento en vivo
      const refreshOverlap = () => {
        const d = collect();
        if (!d.date || !d.start || !d.end) { warn.innerHTML = ''; return; }
        const list = Meetings.findOverlaps(d);
        warn.innerHTML = list.length ? `${icon('warning', 16)} Se solapa con: ${list.map((o) => `<strong>${esc(o.title)}</strong> (${o.start}–${o.end})`).join(', ')}` : '';
      };
      form.addEventListener('change', refreshOverlap);
      form.addEventListener('focusout', refreshOverlap);
      refreshOverlap();
      dlg.querySelector('[data-del]')?.addEventListener('click', () => { close(); setTimeout(() => Meetings.removeMeetingWithConfirm(meeting.id), 170); });

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!checkForm(form)) return;
        const d = collect();
        if (d.end <= d.start) {
          form.elements.end.setCustomValidity('La hora de fin debe ser posterior al inicio.');
          form.reportValidity(); form.elements.end.setCustomValidity(''); return;
        }
        const overlaps = Meetings.findOverlaps(d);
        if (overlaps.length) {
          toast({ type: 'warning', title: 'Solapamiento', message: `«${d.title}» coincide con ${overlaps.map((o) => `«${o.title}»`).join(', ')}.`, duration: 6000 });
        }
        delete d.id;
        if (isEdit) { Meetings.updateMeeting(meeting.id, d); toast({ message: 'Reunión actualizada', type: 'success', duration: 2500 }); }
        else { Meetings.createMeeting(d); toast({ message: 'Reunión creada', type: 'success', duration: 2500 }); }
        close();
      });
    },
  });
}

/** Detalle de reunión (solo lectura con acciones). */
export function openMeetingDetail(id) {
  const m = Meetings.getMeeting(id);
  if (!m) return;
  const overlaps = Meetings.findOverlaps(m);
  const isLink = /^https?:\/\//i.test(m.location);
  openModal({
    title: esc(m.title),
    size: 'md',
    body: `<div class="detail">
      <div class="detail-badges">${catBadge(m.category)}</div>
      <dl class="detail-meta">
        <div><dt>${icon('clock', 16)} Cuándo</dt><dd>${relDay(m.date)} · ${fmtDate(m.date)} · ${m.start}–${m.end}</dd></div>
        ${m.location ? `<div><dt>${icon('pin', 16)} Lugar</dt><dd>${isLink ? `<a href="${esc(m.location)}" target="_blank" rel="noopener">${esc(m.location)}</a>` : esc(m.location)}</dd></div>` : ''}
        ${m.participants ? `<div><dt>${icon('users', 16)} Participantes</dt><dd>${esc(m.participants)}</dd></div>` : ''}
        ${m.reminder !== null && m.reminder !== undefined ? `<div><dt>${icon('bell', 16)} Aviso</dt><dd>${leadLabel(m.reminder)}</dd></div>` : ''}
      </dl>
      ${m.notes ? `<p class="detail-desc">${esc(m.notes)}</p>` : ''}
      ${overlaps.length ? `<p class="overlap-warning">${icon('warning', 16)} Se solapa con ${overlaps.map((o) => `<strong>${esc(o.title)}</strong>`).join(', ')}</p>` : ''}
    </div>`,
    footer: `<button type="button" class="btn btn-ghost btn-danger-text" data-act="delete">${icon('trash', 16)} Borrar</button>
      <button type="button" class="btn btn-primary" data-act="edit">${icon('edit', 16)} Editar</button>`,
    onMount: (dlg, close) => {
      dlg.querySelector('[data-act=edit]').addEventListener('click', () => { close(); setTimeout(() => openMeetingForm(Meetings.getMeeting(id)), 170); });
      dlg.querySelector('[data-act=delete]').addEventListener('click', () => { close(); setTimeout(() => Meetings.removeMeetingWithConfirm(id), 170); });
    },
  });
}

/* ================================================================== */
/* Formulario de Aviso independiente                                   */
/* ================================================================== */
export function openReminderForm(reminder = null, defaults = {}) {
  const s = getState();
  const isEdit = !!reminder;
  const filterCat = s.settings.filter !== 'all' ? s.settings.filter : 'personal';
  const soon = new Date(Date.now() + 60 * 60000);
  const r = reminder ? structuredClone(reminder) : {
    title: '', category: filterCat, date: todayISO(),
    time: `${String(soon.getHours()).padStart(2, '0')}:00`, lead: 0, ...defaults,
  };
  openModal({
    title: isEdit ? 'Editar aviso' : 'Nuevo aviso',
    size: 'md',
    body: `<form class="form" novalidate id="reminder-form">
      <div class="field"><label for="rf-title">Título <span aria-hidden="true">*</span></label>
        <input id="rf-title" name="title" required maxlength="140" value="${esc(r.title)}" autofocus placeholder="Ej.: Llamar al dentista"></div>
      ${categoryRadios('category', r.category)}
      <div class="grid-2">
        ${dateField({ id: 'rf-date', name: 'date', value: r.date, label: 'Fecha', required: true })}
        ${timeField({ id: 'rf-time', name: 'time', value: r.time, label: 'Hora', required: true })}
      </div>
      ${leadSelect('rf-lead', r.lead)}
    </form>`,
    footer: `${isEdit ? `<button type="button" class="btn btn-ghost btn-danger-text" data-del>${icon('trash', 16)} Borrar</button>` : ''}
      <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
      <button type="submit" form="reminder-form" class="btn btn-primary">${isEdit ? 'Guardar cambios' : 'Crear aviso'}</button>`,
    onMount: (dlg, close) => {
      const form = dlg.querySelector('#reminder-form');
      wireDateTimeFields(form);
      // El aviso independiente siempre avisa; "Sin aviso" no tiene sentido aquí
      form.elements.reminder.querySelector('option[value=""]').remove();
      if (r.lead === null || r.lead === undefined) form.elements.reminder.value = '0';
      dlg.querySelector('[data-del]')?.addEventListener('click', () => { close(); setTimeout(() => Reminders.removeReminderWithConfirm(reminder.id), 170); });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!checkForm(form)) return;
        const data = {
          title: form.elements.title.value.trim(),
          category: form.elements.category.value || 'personal',
          date: readDate(form, 'date'),
          time: readTime(form, 'time'),
          lead: readLead(form) ?? 0,
        };
        if (isEdit) { Reminders.updateReminder(reminder.id, data); toast({ message: 'Aviso actualizado', type: 'success', duration: 2500 }); }
        else { Reminders.createReminder(data); toast({ message: 'Aviso creado', type: 'success', duration: 2500 }); }
        close();
      });
    },
  });
}

/** Menú de elección rápida para añadir en una fecha concreta. */
export function openAddChooser(dateISO = '') {
  openModal({
    title: dateISO ? `Añadir el ${fmtDate(dateISO)}` : 'Añadir',
    size: 'sm',
    body: `<div class="chooser">
      <button type="button" class="chooser-btn" data-k="task">${icon('list', 22)}<span>Tarea</span></button>
      <button type="button" class="chooser-btn" data-k="meeting">${icon('meeting', 22)}<span>Reunión</span></button>
      <button type="button" class="chooser-btn" data-k="reminder">${icon('bell', 22)}<span>Aviso</span></button>
    </div>`,
    onMount: (dlg, close) => {
      dlg.querySelector('.chooser').addEventListener('click', (e) => {
        const b = e.target.closest('[data-k]'); if (!b) return;
        close();
        setTimeout(() => openNew(b.dataset.k, dateISO), 170);
      });
    },
  });
}

/** Abre el formulario de creación del tipo indicado, opcionalmente con fecha. */
export function openNew(kind, dateISO = '') {
  if (kind === 'task') openTaskForm(null, dateISO ? { dueDate: dateISO } : {});
  if (kind === 'meeting') openMeetingForm(null, dateISO ? { date: dateISO } : {});
  if (kind === 'reminder') openReminderForm(null, dateISO ? { date: dateISO } : {});
}

/** Marca de actualización por si alguna vista necesita refrescar algo tras un cambio. */
export function touch() { update(() => {}, { type: 'touch' }); }
