/**
 * tasks.js — Lógica de tareas (CRUD, subtareas, recurrencia, etiquetas)
 * y la vista "Tareas" (lista con búsqueda, filtros y ordenación).
 *
 * Modelo Task:
 * {
 *   id, title, description,
 *   category: 'personal'|'trabajo'|'estudio',
 *   priority: 'alta'|'media'|'baja',
 *   tags: [tagId],
 *   dueDate: 'AAAA-MM-DD' | '', dueTime: 'HH:mm' | '',
 *   status: 'pending'|'doing'|'done',
 *   subtasks: [{ id, text, done }],
 *   recurrence: { type: 'none'|'daily'|'weekly'|'monthly', days: [0..6] }  // 0 = lunes
 *   reminder: null | minutos de antelación,
 *   createdAt, updatedAt, completedAt (ISO)
 * }
 */
(function () {
  'use strict';
  const O = window.Organiza;

  const { getState, update, clone, matchesFilter } = O.Store;
  const { uid, esc, parseLocal, toISODate, todayISO, addDays, mondayIndex, fmtDate, relDay, PRIORITIES, STATUSES, WEEKDAYS, CATEGORIES } = O.Utils;
  const { icon, emptyTasks, noResults, allDone } = O.Illus;
  const { toast, undoToast, confirmDialog, openTaskDetail, openTaskForm, catBadge, prioBadge, tagChips } = O.UI;

  /* ================================================================== */
  /* Consultas                                                           */
  /* ================================================================== */
  function getTask(id) { return getState().tasks.find((t) => t.id === id); }

  /** Fecha/hora límite como Date (si no hay hora, final del día). */
  function dueDateTime(t) {
    if (!t.dueDate) return null;
    return parseLocal(t.dueDate, t.dueTime || '23:59');
  }
  /** ¿Está vencida? (no hecha y con fecha límite pasada). */
  function isOverdue(t, now = new Date()) {
    if (t.status === 'done' || !t.dueDate) return false;
    return dueDateTime(t) < now;
  }
  /** Progreso de subtareas. */
  function progress(t) {
    const total = t.subtasks?.length || 0;
    const done = t.subtasks?.filter((s) => s.done).length || 0;
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
  }
  /** Texto legible de la recurrencia. */
  function recurrenceLabel(t) {
    const r = t.recurrence || { type: 'none' };
    if (r.type === 'daily') return 'Cada día';
    if (r.type === 'monthly') return 'Cada mes';
    if (r.type === 'weekly') {
      const names = (r.days || []).slice().sort().map((d) => WEEKDAYS[d].toLowerCase());
      return names.length ? `Cada semana: ${names.join(', ')}` : 'Cada semana';
    }
    return 'No se repite';
  }

  /* ================================================================== */
  /* Mutaciones                                                          */
  /* ================================================================== */
  function normalizeTask(data) {
    const now = new Date().toISOString();
    return {
      id: data.id || uid('t'),
      title: (data.title || 'Sin título').trim(),
      description: data.description || '',
      category: CATEGORIES[data.category] ? data.category : 'personal',
      priority: PRIORITIES[data.priority] ? data.priority : 'media',
      tags: Array.isArray(data.tags) ? data.tags : [],
      dueDate: data.dueDate || '',
      dueTime: data.dueTime || '',
      status: STATUSES[data.status] ? data.status : 'pending',
      subtasks: (data.subtasks || []).map((s) => ({ id: s.id || uid('st'), text: s.text, done: !!s.done })),
      recurrence: data.recurrence?.type ? { type: data.recurrence.type, days: data.recurrence.days || [] } : { type: 'none', days: [] },
      reminder: data.reminder === undefined ? null : data.reminder,
      createdAt: data.createdAt || now,
      updatedAt: now,
      completedAt: data.completedAt || (data.status === 'done' ? now : null),
    };
  }

  function createTask(data) {
    const task = normalizeTask(data);
    update((s) => { s.tasks.push(task); }, { type: 'task-create', id: task.id });
    return task;
  }

  function updateTask(id, patch) {
    const prev = getTask(id);
    if (!prev) return;
    // Completar desde el formulario también debe generar la siguiente repetición
    if (patch.status === 'done' && prev.status !== 'done') {
      update((s) => { Object.assign(s.tasks.find((t) => t.id === id), patch, { updatedAt: new Date().toISOString() }); }, { type: 'task-update', id });
      setStatus(id, 'done', { silent: true, force: true });
      return;
    }
    update((s) => {
      const t = s.tasks.find((x) => x.id === id);
      Object.assign(t, patch, { updatedAt: new Date().toISOString() });
      if (t.status !== 'done') t.completedAt = null;
    }, { type: 'task-update', id });
  }

  /** Calcula la siguiente fecha de una tarea recurrente (siempre >= hoy). */
  function nextOccurrence(task) {
    const r = task.recurrence;
    if (!r || r.type === 'none') return null;
    const base = task.dueDate || todayISO();
    const step = (dateStr) => {
      if (r.type === 'daily') return addDays(dateStr, 1);
      if (r.type === 'weekly') {
        const days = r.days?.length ? r.days : [mondayIndex(parseLocal(dateStr))];
        let d = dateStr;
        for (let i = 0; i < 7; i++) { d = addDays(d, 1); if (days.includes(mondayIndex(parseLocal(d)))) return d; }
        return addDays(dateStr, 7);
      }
      // Mensual: mismo día del mes siguiente (ajustado al último día si no existe)
      const cur = parseLocal(dateStr);
      const originalDay = parseLocal(base).getDate();
      const target = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
      target.setDate(Math.min(originalDay, last));
      return toISODate(target);
    };
    let next = step(base);
    const today = todayISO();
    let guard = 0;
    while (next < today && guard++ < 400) next = step(next);
    return next;
  }

  /**
   * Cambia el estado de una tarea. Al completarla, si es recurrente,
   * genera automáticamente la siguiente instancia.
   */
  function setStatus(id, status, { silent = false, force = false } = {}) {
    const t = getTask(id);
    if (!t || (t.status === status && !force)) return;
    const before = clone(t); // para deshacer solo este cambio
    let generated = null;
    update((s) => {
      const task = s.tasks.find((x) => x.id === id);
      task.status = status;
      task.updatedAt = new Date().toISOString();
      task.completedAt = status === 'done' ? new Date().toISOString() : null;
      if (status === 'done' && task.recurrence?.type !== 'none') {
        const next = nextOccurrence(task);
        // Evitar duplicados si ya existe la siguiente instancia
        const exists = s.tasks.some((x) => x.seriesId && x.seriesId === (task.seriesId || task.id) && x.dueDate === next && x.status !== 'done');
        if (next && !exists) {
          generated = normalizeTask({
            ...clone(task), id: undefined, status: 'pending', completedAt: null, createdAt: undefined,
            dueDate: next, subtasks: task.subtasks.map((st) => ({ ...st, id: uid('st'), done: false })),
          });
          generated.seriesId = task.seriesId || task.id;
          s.tasks.push(generated);
        }
      }
    }, { type: status === 'done' ? 'task-complete' : 'task-status', id });

    if (silent && !generated) return;
    if (status === 'done') {
      const msg = generated ? `Completada. Siguiente repetición: ${fmtDate(generated.dueDate)}` : 'Tarea completada';
      toast({
        message: msg, type: 'success', duration: 5000,
        actions: [{
          label: 'Deshacer',
          onClick: () => update((s) => {
            const i = s.tasks.findIndex((x) => x.id === id);
            if (i >= 0) s.tasks[i] = before;
            if (generated) s.tasks = s.tasks.filter((x) => x.id !== generated.id);
          }, { type: 'undo' }),
        }],
      });
    }
  }

  /** Alterna entre hecho y pendiente. */
  function toggleDone(id) {
    const t = getTask(id);
    if (!t) return;
    setStatus(id, t.status === 'done' ? 'pending' : 'done');
  }

  function toggleSubtask(taskId, subId) {
    update((s) => {
      const t = s.tasks.find((x) => x.id === taskId);
      const st = t?.subtasks.find((x) => x.id === subId);
      if (st) st.done = !st.done;
      if (t) t.updatedAt = new Date().toISOString();
    }, { type: 'task-update', id: taskId });
  }

  function duplicateTask(id) {
    const t = getTask(id);
    if (!t) return null;
    const copy = createTask({
      ...clone(t), id: undefined, createdAt: undefined, completedAt: null, status: 'pending', seriesId: undefined,
      title: `${t.title} (copia)`, subtasks: t.subtasks.map((s) => ({ ...s, id: uid('st') })),
    });
    toast({ message: 'Tarea duplicada', type: 'success', duration: 2500 });
    return copy;
  }

  /** Borra sin preguntar, con toast "Deshacer" durante 5 s. */
  function deleteTask(id) {
    const index = getState().tasks.findIndex((x) => x.id === id);
    if (index < 0) return;
    const t = clone(getState().tasks[index]);
    update((s) => { s.tasks.splice(index, 1); }, { type: 'task-delete', id });
    undoToast(`Tarea «${t.title}» eliminada`, () => update((s) => {
      if (!s.tasks.some((x) => x.id === id)) s.tasks.splice(Math.min(index, s.tasks.length), 0, t);
    }, { type: 'undo' }));
  }

  /** Borra pidiendo confirmación primero. */
  async function removeTaskWithConfirm(id) {
    const t = getTask(id);
    if (!t) return;
    const ok = await confirmDialog({ title: 'Borrar tarea', message: `¿Seguro que quieres borrar «${t.title}»?`, confirmLabel: 'Borrar', danger: true });
    if (ok) deleteTask(id);
  }

  /* ---------- Etiquetas ---------- */
  function createTag(name, color = '#6b9bd1') {
    const clean = name.trim().replace(/^#/, '').slice(0, 24);
    const existing = getState().tags.find((t) => t.name.toLowerCase() === clean.toLowerCase());
    if (existing) return existing;
    const tag = { id: uid('tag'), name: clean, color };
    update((s) => { s.tags.push(tag); }, { type: 'tag' });
    return tag;
  }
  function renameTag(id, name) {
    update((s) => { const t = s.tags.find((x) => x.id === id); if (t && name.trim()) t.name = name.trim().replace(/^#/, ''); }, { type: 'tag' });
  }
  function setTagColor(id, color) {
    update((s) => { const t = s.tags.find((x) => x.id === id); if (t) t.color = color; }, { type: 'tag' });
  }
  function deleteTag(id) {
    update((s) => {
      s.tags = s.tags.filter((t) => t.id !== id);
      s.tasks.forEach((t) => { t.tags = t.tags.filter((x) => x !== id); });
    }, { type: 'tag' });
  }

  /* ================================================================== */
  /* Listados                                                            */
  /* ================================================================== */
  const SORTERS = {
    date: (a, b) => (a.dueDate || '9999') .localeCompare(b.dueDate || '9999') || (a.dueTime || '99').localeCompare(b.dueTime || '99'),
    priority: (a, b) => PRIORITIES[b.priority].weight - PRIORITIES[a.priority].weight || SORTERS.date(a, b),
    created: (a, b) => b.createdAt.localeCompare(a.createdAt),
  };

  /** Tareas visibles según filtro global, búsqueda, estado y orden. */
  function queryTasks({ search = '', status = 'all', sort = 'date' } = {}) {
    const q = search.trim().toLowerCase();
    const tags = getState().tags;
    return getState().tasks
      .filter(matchesFilter)
      .filter((t) => status === 'all' || (status === 'open' ? t.status !== 'done' : t.status === status))
      .filter((t) => {
        if (!q) return true;
        const tagNames = t.tags.map((id) => tags.find((x) => x.id === id)?.name || '').join(' ');
        return `${t.title} ${t.description} ${tagNames} ${t.subtasks.map((s) => s.text).join(' ')}`.toLowerCase().includes(q);
      })
      .sort(SORTERS[sort] || SORTERS.date);
  }

  /** Tareas con fecha de hoy (según filtro). */
  function tasksForToday() {
    const today = todayISO();
    return getState().tasks.filter(matchesFilter).filter((t) => t.dueDate === today);
  }

  /** HTML de una tarjeta de tarea para la lista. */
  function taskItemHTML(t) {
    const prog = progress(t);
    const overdue = isOverdue(t);
    const done = t.status === 'done';
    return `<li class="task-item cat-${t.category} ${done ? 'is-done' : ''} ${overdue ? 'is-overdue' : ''}" data-id="${t.id}">
      <label class="check">
        <input type="checkbox" data-action="toggle" ${done ? 'checked' : ''} aria-label="${done ? 'Marcar como pendiente' : 'Completar'}: ${esc(t.title)}">
        <span class="check-box">${icon('check', 14)}</span>
      </label>
      <div class="task-main">
        <button type="button" class="task-title" data-action="open">${esc(t.title)}</button>
        <div class="task-meta">
          ${catBadge(t.category)} ${prioBadge(t.priority)}
          ${t.status === 'doing' ? '<span class="status-badge status-doing">En curso</span>' : ''}
          ${t.dueDate ? `<span class="due ${overdue ? 'overdue' : ''}">${icon('clock', 14)} ${relDay(t.dueDate)}${t.dueTime ? ` ${t.dueTime}` : ''}${overdue ? ' · vencida' : ''}</span>` : ''}
          ${t.recurrence?.type !== 'none' ? `<span class="muted small" title="${esc(recurrenceLabel(t))}">${icon('repeat', 14)}<span class="sr-only">${esc(recurrenceLabel(t))}</span></span>` : ''}
          ${t.reminder !== null && t.reminder !== undefined && t.dueDate ? `<span class="muted small" title="Con aviso">${icon('bell', 14)}<span class="sr-only">Con aviso</span></span>` : ''}
          ${tagChips(t.tags)}
        </div>
        ${prog.total ? `<div class="progress small" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${prog.pct}" aria-label="Subtareas ${prog.done} de ${prog.total}"><span style="width:${prog.pct}%"></span></div>
          <span class="muted tiny">${prog.done}/${prog.total} subtareas</span>` : ''}
      </div>
      <div class="task-actions">
        <button type="button" class="icon-btn" data-action="edit" aria-label="Editar ${esc(t.title)}" title="Editar">${icon('edit', 18)}</button>
        <button type="button" class="icon-btn" data-action="duplicate" aria-label="Duplicar ${esc(t.title)}" title="Duplicar">${icon('copy', 18)}</button>
        <button type="button" class="icon-btn danger" data-action="delete" aria-label="Borrar ${esc(t.title)}" title="Borrar">${icon('trash', 18)}</button>
      </div>
    </li>`;
  }

  /** Maneja los clics de acciones dentro de una lista de tareas. */
  function handleTaskAction(e) {
    const el = e.target.closest('[data-action]');
    const item = e.target.closest('[data-id]');
    if (!el || !item) return;
    const id = item.dataset.id;
    const a = el.dataset.action;
    if (a === 'toggle') toggleDone(id);
    if (a === 'open') openTaskDetail(id);
    if (a === 'edit') openTaskForm(getTask(id));
    if (a === 'duplicate') duplicateTask(id);
    if (a === 'delete') removeTaskWithConfirm(id);
  }

  /** Banner "¡todo hecho!" si había tareas hoy y están todas completadas. */
  function allDoneBanner() {
    const today = tasksForToday();
    if (!today.length || today.some((t) => t.status !== 'done')) return '';
    return `<div class="all-done">${allDone()}<div><h3>¡Todo hecho por hoy!</h3><p class="muted">Has completado las ${today.length} tareas de hoy. Buen trabajo.</p></div></div>`;
  }

  /* ================================================================== */
  /* Vista Tareas                                                        */
  /* ================================================================== */
  const viewState = { search: '', status: 'open', sort: 'date' };

  const TasksView = {
    el: null,
    mount(el) {
      this.el = el;
      el.innerHTML = `
        <header class="view-header">
          <div><h1>Tareas</h1><p class="muted" id="tasks-count"></p></div>
          <button type="button" class="btn btn-primary" id="tasks-new">${icon('plus', 18)} Nueva tarea</button>
        </header>
        <div class="toolbar" role="search">
          <div class="search">
            ${icon('search', 18)}
            <label for="tasks-search" class="sr-only">Buscar tareas</label>
            <input type="search" id="tasks-search" placeholder="Buscar por título, descripción, etiqueta…" value="${esc(viewState.search)}">
          </div>
          <div class="field-inline">
            <label for="tasks-status">Estado</label>
            <select id="tasks-status">
              ${[['open', 'Abiertas'], ['all', 'Todas'], ['pending', 'Pendientes'], ['doing', 'En curso'], ['done', 'Hechas']]
                .map(([v, l]) => `<option value="${v}" ${viewState.status === v ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
          </div>
          <div class="field-inline">
            <label for="tasks-sort">Ordenar</label>
            <select id="tasks-sort">
              ${[['date', 'Fecha'], ['priority', 'Prioridad'], ['created', 'Creación']]
                .map(([v, l]) => `<option value="${v}" ${viewState.sort === v ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
          </div>
        </div>
        <div id="tasks-banner"></div>
        <ul class="task-list" id="tasks-list" aria-live="polite"></ul>`;
      el.querySelector('#tasks-new').addEventListener('click', () => openTaskForm());
      el.querySelector('#tasks-search').addEventListener('input', (e) => { viewState.search = e.target.value; this.update(); });
      el.querySelector('#tasks-status').addEventListener('change', (e) => { viewState.status = e.target.value; this.update(); });
      el.querySelector('#tasks-sort').addEventListener('change', (e) => { viewState.sort = e.target.value; this.update(); });
      el.querySelector('#tasks-list').addEventListener('click', handleTaskAction);
      this.update();
    },
    update() {
      if (!this.el) return;
      const list = queryTasks(viewState);
      const all = getState().tasks.filter(matchesFilter);
      const open = all.filter((t) => t.status !== 'done').length;
      const overdue = all.filter((t) => isOverdue(t)).length;
      this.el.querySelector('#tasks-count').textContent =
        `${open} abiertas${overdue ? ` · ${overdue} vencidas` : ''} · ${all.length} en total`;
      this.el.querySelector('#tasks-banner').innerHTML = allDoneBanner();
      const ul = this.el.querySelector('#tasks-list');
      if (!all.length) {
        ul.innerHTML = `<li class="empty">${emptyTasks()}<h3>Aún no hay tareas</h3><p class="muted">Crea tu primera tarea con el botón «+».</p></li>`;
      } else if (!list.length) {
        ul.innerHTML = `<li class="empty">${noResults()}<h3>Sin resultados</h3><p class="muted">Prueba con otra búsqueda o cambia el filtro de estado.</p></li>`;
      } else {
        ul.innerHTML = list.map(taskItemHTML).join('');
      }
    },
    unmount() { this.el = null; },
  };

  O.Tasks = { getTask, dueDateTime, isOverdue, progress, recurrenceLabel, createTask, updateTask, nextOccurrence, setStatus, toggleDone, toggleSubtask, duplicateTask, deleteTask, removeTaskWithConfirm, createTag, renameTag, setTagColor, deleteTag, queryTasks, tasksForToday, taskItemHTML, handleTaskAction, allDoneBanner, TasksView };
})();
