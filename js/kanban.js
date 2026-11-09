/**
 * kanban.js — Tablero Kanban (Pendiente / En curso / Hecho).
 * - PC: HTML5 Drag and Drop API nativa.
 * - Móvil/táctil: pointer events sobre el asa de arrastre (⋮⋮), con una tarjeta "fantasma".
 * - Teclado: botones para mover la tarjeta a la columna anterior/siguiente.
 * Mover una tarjeta actualiza su estado en el store.
 */
import { getState, matchesFilter } from './store.js';
import { esc, relDay, STATUSES, PRIORITIES } from './utils.js';
import { icon, emptyKanban } from './illustrations.js';
import { catBadge, prioBadge, tagChips, openTaskDetail, openTaskForm } from './ui.js';
import * as Tasks from './tasks.js';

const COLUMNS = ['pending', 'doing', 'done'];

function cardHTML(t) {
  const prog = Tasks.progress(t);
  const overdue = Tasks.isOverdue(t);
  const idx = COLUMNS.indexOf(t.status);
  return `<li class="kcard cat-${t.category} ${overdue ? 'is-overdue' : ''}" draggable="true" data-id="${t.id}" aria-roledescription="tarjeta arrastrable">
    <div class="kcard-top">
      <button type="button" class="drag-handle icon-btn" aria-label="Arrastrar ${esc(t.title)}" title="Arrastrar">${icon('drag', 16)}</button>
      <button type="button" class="kcard-title" data-open>${esc(t.title)}</button>
    </div>
    <div class="task-meta">${catBadge(t.category, false)} ${prioBadge(t.priority)}
      ${t.dueDate ? `<span class="due ${overdue ? 'overdue' : ''}">${icon('clock', 14)} ${relDay(t.dueDate)}${t.dueTime ? ` ${t.dueTime}` : ''}</span>` : ''}</div>
    ${t.tags.length ? `<div class="task-meta">${tagChips(t.tags)}</div>` : ''}
    ${prog.total ? `<div class="progress small" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${prog.pct}" aria-label="Subtareas ${prog.done} de ${prog.total}"><span style="width:${prog.pct}%"></span></div>
      <span class="muted tiny">${prog.done}/${prog.total} subtareas</span>` : ''}
    <div class="kcard-move">
      <button type="button" class="icon-btn" data-move="-1" ${idx === 0 ? 'disabled' : ''} aria-label="Mover a ${idx > 0 ? STATUSES[COLUMNS[idx - 1]].label : ''}">${icon('left', 16)}</button>
      <button type="button" class="icon-btn" data-edit aria-label="Editar ${esc(t.title)}">${icon('edit', 16)}</button>
      <button type="button" class="icon-btn" data-move="1" ${idx === COLUMNS.length - 1 ? 'disabled' : ''} aria-label="Mover a ${idx < 2 ? STATUSES[COLUMNS[idx + 1]].label : ''}">${icon('right', 16)}</button>
    </div>
  </li>`;
}

function moveTo(id, status) {
  const t = Tasks.getTask(id);
  if (!t || t.status === status) return;
  Tasks.setStatus(id, status);
}

export const KanbanView = {
  el: null,
  cleanup: [],
  mount(el) {
    this.el = el;
    el.innerHTML = `
      <header class="view-header">
        <div><h1>Kanban</h1><p class="muted">Arrastra las tarjetas entre columnas para cambiar su estado.</p></div>
        <button type="button" class="btn btn-primary" id="kb-new">${icon('plus', 18)} Nueva tarea</button>
      </header>
      <div id="kb-empty"></div>
      <div class="kanban" id="kb-board">
        ${COLUMNS.map((c) => `<section class="kcol kcol-${c}" data-status="${c}" aria-labelledby="kh-${c}">
          <header class="kcol-head"><h2 id="kh-${c}">${STATUSES[c].label}</h2><span class="count" data-count></span></header>
          <ul class="kcol-list" data-list></ul>
        </section>`).join('')}
      </div>`;
    el.querySelector('#kb-new').addEventListener('click', () => openTaskForm());
    const board = el.querySelector('#kb-board');

    /* ---- Clics ---- */
    board.addEventListener('click', (e) => {
      const card = e.target.closest('.kcard'); if (!card) return;
      const id = card.dataset.id;
      if (e.target.closest('[data-open]')) openTaskDetail(id);
      if (e.target.closest('[data-edit]')) openTaskForm(Tasks.getTask(id));
      const mv = e.target.closest('[data-move]');
      if (mv) {
        const t = Tasks.getTask(id);
        const next = COLUMNS[COLUMNS.indexOf(t.status) + Number(mv.dataset.move)];
        if (next) {
          moveTo(id, next);
          // Mantener el foco en la tarjeta movida para el uso con teclado
          requestAnimationFrame(() => board.querySelector(`.kcard[data-id="${id}"] [data-move="${mv.dataset.move}"]:not([disabled])`)?.focus()
            || board.querySelector(`.kcard[data-id="${id}"] [data-open]`)?.focus());
        }
      }
    });

    /* ---- Drag & drop nativo (ratón) ---- */
    board.addEventListener('dragstart', (e) => {
      const card = e.target.closest('.kcard'); if (!card) return;
      e.dataTransfer.setData('text/plain', card.dataset.id);
      e.dataTransfer.effectAllowed = 'move';
      requestAnimationFrame(() => card.classList.add('dragging'));
    });
    board.addEventListener('dragend', (e) => {
      e.target.closest?.('.kcard')?.classList.remove('dragging');
      board.querySelectorAll('.kcol').forEach((c) => c.classList.remove('drop-target'));
    });
    board.addEventListener('dragover', (e) => {
      const col = e.target.closest('.kcol'); if (!col) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      board.querySelectorAll('.kcol').forEach((c) => c.classList.toggle('drop-target', c === col));
    });
    board.addEventListener('dragleave', (e) => {
      const col = e.target.closest('.kcol');
      if (col && !col.contains(e.relatedTarget)) col.classList.remove('drop-target');
    });
    board.addEventListener('drop', (e) => {
      const col = e.target.closest('.kcol'); if (!col) return;
      e.preventDefault();
      col.classList.remove('drop-target');
      const id = e.dataTransfer.getData('text/plain');
      if (id) moveTo(id, col.dataset.status);
    });

    /* ---- Arrastre táctil con pointer events (asa ⋮⋮) ---- */
    let drag = null;
    const onDown = (e) => {
      const handle = e.target.closest('.drag-handle');
      if (!handle || e.pointerType === 'mouse') return; // el ratón usa DnD nativo
      const card = handle.closest('.kcard');
      e.preventDefault();
      const rect = card.getBoundingClientRect();
      const ghost = card.cloneNode(true);
      ghost.classList.add('kcard-ghost');
      ghost.style.width = `${rect.width}px`;
      ghost.style.left = `${rect.left}px`;
      ghost.style.top = `${rect.top}px`;
      document.body.appendChild(ghost);
      card.classList.add('dragging');
      drag = { id: card.dataset.id, card, ghost, dx: e.clientX - rect.left, dy: e.clientY - rect.top, pointerId: e.pointerId };
      try { handle.setPointerCapture?.(e.pointerId); } catch { /* puntero sintético o ya liberado */ }
    };
    const colAt = (x, y) => {
      drag.ghost.style.display = 'none';
      const el2 = document.elementFromPoint(x, y);
      drag.ghost.style.display = '';
      return el2?.closest('.kcol');
    };
    const onMove = (e) => {
      if (!drag || e.pointerId !== drag.pointerId) return;
      e.preventDefault();
      drag.ghost.style.left = `${e.clientX - drag.dx}px`;
      drag.ghost.style.top = `${e.clientY - drag.dy}px`;
      const col = colAt(e.clientX, e.clientY);
      board.querySelectorAll('.kcol').forEach((c) => c.classList.toggle('drop-target', c === col));
    };
    const onUp = (e) => {
      if (!drag || e.pointerId !== drag.pointerId) return;
      const col = colAt(e.clientX, e.clientY);
      drag.ghost.remove();
      drag.card.classList.remove('dragging');
      board.querySelectorAll('.kcol').forEach((c) => c.classList.remove('drop-target'));
      const { id } = drag;
      drag = null;
      if (col && e.type === 'pointerup') moveTo(id, col.dataset.status);
    };
    board.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    this.cleanup = [
      () => window.removeEventListener('pointermove', onMove),
      () => window.removeEventListener('pointerup', onUp),
      () => window.removeEventListener('pointercancel', onUp),
      () => { drag?.ghost.remove(); drag = null; },
    ];
    this.update();
  },
  update() {
    if (!this.el) return;
    const tasks = getState().tasks.filter(matchesFilter);
    const sorter = (a, b) => PRIORITIES[b.priority].weight - PRIORITIES[a.priority].weight
      || (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
    this.el.querySelector('#kb-empty').innerHTML = tasks.length ? ''
      : `<div class="empty">${emptyKanban()}<h3>El tablero está vacío</h3><p class="muted">Crea una tarea y aparecerá en «Pendiente».</p></div>`;
    for (const status of COLUMNS) {
      const col = this.el.querySelector(`.kcol[data-status="${status}"]`);
      let list = tasks.filter((t) => t.status === status).sort(sorter);
      // La columna "Hecho" muestra las 30 más recientes para no saturar
      if (status === 'done') list = list.sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || '')).slice(0, 30);
      col.querySelector('[data-count]').textContent = tasks.filter((t) => t.status === status).length;
      col.querySelector('[data-list]').innerHTML = list.length ? list.map(cardHTML).join('')
        : '<li class="kcol-empty">Suelta aquí una tarjeta</li>';
    }
  },
  unmount() { this.cleanup.forEach((fn) => fn()); this.cleanup = []; this.el = null; },
};
