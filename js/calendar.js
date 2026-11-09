/**
 * calendar.js — Vista "Calendario": controla el calendario 3D (mensual y semanal),
 * el panel lateral del día y la alternativa 2D si el navegador no admite CSS 3D.
 */
(function () {
  'use strict';
  const O = window.Organiza;

  const { getState, matchesFilter } = O.Store;
  const { esc, todayISO, addDays, startOfWeek, parseLocal, toISODate, fmtDate, fmtLong, has3D, MONTHS, WEEKDAYS_SHORT, WEEKDAYS, CATEGORIES } = O.Utils;
  const { icon, emptyMeetings } = O.Illus;
  const { catBadge, openAddChooser, openMeetingDetail, openTaskDetail, openReminderForm } = O.UI;
  const Tasks = O.lazy('Tasks');
  const { meetingsOn, findOverlaps } = O.Meetings;
  const { remindersOn, getReminder } = O.Reminders;

  const state = { mode: 'month', cursor: todayISO(), selected: todayISO() };

  /** Elementos de un día según el filtro global. */
  function itemsOn(date) {
    const tasks = getState().tasks.filter((t) => t.dueDate === date && matchesFilter(t))
      .sort((a, b) => (a.dueTime || '99').localeCompare(b.dueTime || '99'));
    return { tasks, meetings: meetingsOn(date), reminders: remindersOn(date) };
  }

  /** Convierte los elementos de un día al formato que usa la escena 3D. */
  function dayModel(date, inMonth) {
    const { tasks, meetings, reminders } = itemsOn(date);
    return {
      date, inMonth, isToday: date === todayISO(), weekend: parseLocal(date).getDay() % 6 === 0,
      items: [
        ...meetings.map((m) => ({ kind: 'meeting', id: m.id, category: m.category, title: m.title, start: m.start, end: m.end })),
        ...tasks.map((t) => ({ kind: 'task', id: t.id, category: t.category, title: t.title, start: t.dueTime, done: t.status === 'done' })),
        ...reminders.map((r) => ({ kind: 'reminder', id: r.id, category: r.category, title: r.title, start: r.time, done: r.done })),
      ],
    };
  }

  /** Días de la cuadrícula mensual (6 semanas, empezando en lunes). */
  function monthDays(cursor) {
    const d = parseLocal(cursor);
    const first = toISODate(new Date(d.getFullYear(), d.getMonth(), 1));
    const start = startOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => {
      const date = addDays(start, i);
      return dayModel(date, parseLocal(date).getMonth() === d.getMonth());
    });
  }
  function weekDays(cursor) {
    const start = startOfWeek(cursor);
    return Array.from({ length: 7 }, (_, i) => dayModel(addDays(start, i), true));
  }

  function periodTitle() {
    const d = parseLocal(state.cursor);
    if (state.mode === 'month') return `${MONTHS[d.getMonth()]} de ${d.getFullYear()}`;
    const s = parseLocal(startOfWeek(state.cursor)); const e = parseLocal(addDays(startOfWeek(state.cursor), 6));
    return s.getMonth() === e.getMonth()
      ? `Semana del ${s.getDate()} al ${e.getDate()} de ${MONTHS[e.getMonth()]}`
      : `Semana del ${s.getDate()} de ${MONTHS[s.getMonth()]} al ${e.getDate()} de ${MONTHS[e.getMonth()]}`;
  }
  function periodKey() {
    if (state.mode === 'month') { const d = parseLocal(state.cursor); return `m:${d.getFullYear()}-${d.getMonth()}`; }
    return `w:${startOfWeek(state.cursor)}`;
  }

  const CalendarView = {
    el: null,
    scene: null,
    mount(el) {
      this.el = el;
      el.innerHTML = `
        <header class="view-header">
          <div><h1>Calendario</h1><p class="muted cal-period" id="cal-title" aria-live="polite"></p></div>
          <div class="cal-controls">
            <div class="segmented" role="radiogroup" aria-label="Tipo de vista">
              <button type="button" role="radio" data-mode="month">${icon('grid', 16)} Mes</button>
              <button type="button" role="radio" data-mode="week">${icon('columns', 16)} Semana</button>
            </div>
            <div class="button-row tight">
              <button type="button" class="icon-btn bordered" data-nav="-1" aria-label="Periodo anterior">${icon('left')}</button>
              <button type="button" class="btn btn-ghost btn-sm" data-nav="0">Hoy</button>
              <button type="button" class="icon-btn bordered" data-nav="1" aria-label="Periodo siguiente">${icon('right')}</button>
            </div>
          </div>
        </header>
        <div class="calendar-layout">
          <section class="scene-card" aria-label="Calendario 3D">
            <div class="scene scene-cal" id="cal-scene"><div class="scene-loading">Cargando calendario 3D…</div></div>
            <div class="scene-tooltip" id="cal-tip" role="tooltip" hidden></div>
            <ul class="legend shapes" aria-label="Leyenda de formas">
              <li><span class="shape shape-task"></span>Tarea</li><li><span class="shape shape-meeting"></span>Reunión</li><li><span class="shape shape-reminder"></span>Aviso</li><li class="muted">Arrastra para girar · Ctrl + rueda para zoom</li>
              ${Object.values(CATEGORIES).map((c) => `<li class="cat-${c.id}"><span class="swatch"></span>${c.label}</li>`).join('')}
            </ul>
            </section>
          <aside class="day-panel" id="cal-panel" aria-live="polite" aria-labelledby="cal-day-h"></aside>
        </div>`;

      el.querySelector('.segmented').addEventListener('click', (e) => {
        const b = e.target.closest('[data-mode]'); if (!b || b.dataset.mode === state.mode) return;
        state.mode = b.dataset.mode;
        state.cursor = state.selected;
        this.refresh(0);
      });
      el.querySelector('.cal-controls').addEventListener('click', (e) => {
        const b = e.target.closest('[data-nav]'); if (!b) return;
        const dir = Number(b.dataset.nav);
        if (dir === 0) {
          const oldKey = periodKey(); const oldCursor = state.cursor;
          state.cursor = todayISO(); state.selected = todayISO();
          this.refresh(periodKey() === oldKey ? 0 : (todayISO() < oldCursor ? -1 : 1));
          return;
        }
        if (state.mode === 'month') {
          const d = parseLocal(state.cursor);
          state.cursor = toISODate(new Date(d.getFullYear(), d.getMonth() + dir, 1));
        } else state.cursor = addDays(state.cursor, 7 * dir);
        this.refresh(dir);
      });
      el.querySelector('#cal-panel').addEventListener('click', (e) => this.onPanelClick(e));
      el.querySelector('#cal-panel').addEventListener('change', (e) => {
        const cb = e.target.closest('[data-toggle-task]'); if (cb) Tasks.toggleDone(cb.dataset.toggleTask);
      });
      this.refreshHeader();
      this.renderPanel();
      this.initScene();
    },

    /** Crea el calendario 3D (CSS 3D, sin librerías) o la alternativa 2D. */
    initScene() {
      const host = this.el.querySelector('#cal-scene');
      if (!has3D()) { this.render2D('Tu navegador no admite transformaciones 3D: se muestra la vista 2D.'); return; }
      try {
        host.innerHTML = '';
        this.scene = O.Calendar3D.createCalendarScene(host, {
          tooltip: this.el.querySelector('#cal-tip'),
          onSelectDay: (date) => this.selectDay(date),
          onSelectItem: (item) => this.openItem(item),
        });
        this.showScene(0);
      } catch (err) {
        console.warn('[Organiza] Calendario 3D no disponible, se usa la vista 2D.', err);
        this.scene = null;
        this.render2D('No se pudo crear el calendario 3D: se muestra la vista 2D.');
      }
    },

    showScene(direction) {
      if (!this.scene) return;
      const days = state.mode === 'month' ? monthDays(state.cursor) : weekDays(state.cursor);
      this.scene.show({ mode: state.mode, days, key: periodKey(), direction, selected: state.selected });
    },

    refresh(direction = 0) {
      this.refreshHeader();
      if (this.scene) this.showScene(direction);
      else if (this.is2D) this.render2D();
      this.renderPanel();
    },

    refreshHeader() {
      this.el.querySelector('#cal-title').textContent = periodTitle();
      this.el.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === state.mode)));
    },

    selectDay(date) {
      state.selected = date;
      this.scene?.setSelected(date);
      if (this.is2D) this.render2D();
      this.renderPanel();
      // En móvil, desplazar hasta el panel del día
      if (window.matchMedia('(max-width: 1023px)').matches) this.el.querySelector('#cal-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    openItem({ kind, id }) {
      if (kind === 'task') openTaskDetail(id);
      if (kind === 'meeting') openMeetingDetail(id);
      if (kind === 'reminder') { const r = getReminder(id); if (r) openReminderForm(r); }
    },

    onPanelClick(e) {
      if (e.target.closest('[data-add-day]')) { openAddChooser(state.selected); return; }
      const it = e.target.closest('[data-open-kind]');
      if (it) this.openItem({ kind: it.dataset.openKind, id: it.dataset.openId });
    },

    /** Panel lateral con los elementos del día seleccionado. */
    renderPanel() {
      const date = state.selected;
      const { tasks, meetings, reminders } = itemsOn(date);
      const total = tasks.length + meetings.length + reminders.length;
      this.el.querySelector('#cal-panel').innerHTML = `
        <div class="day-panel-head">
          <div><h2 id="cal-day-h">${fmtLong(date).replace(/^./, (c) => c.toUpperCase())}</h2><p class="muted small">${fmtDate(date)}${date === todayISO() ? ' · Hoy' : ''}</p></div>
          <button type="button" class="btn btn-primary btn-sm" data-add-day>${icon('plus', 16)} Añadir</button>
        </div>
        ${total ? '' : `<div class="empty compact">${emptyMeetings()}<p class="muted">No hay nada este día.</p></div>`}
        ${meetings.length ? `<h3 class="panel-sub">${icon('meeting', 16)} Reuniones</h3><ul class="mini-list">${meetings.map((m) => {
          const ov = findOverlaps(m).length;
          return `<li class="mini-item cat-${m.category}"><span class="time-chip">${m.start}–${m.end}</span>
            <button type="button" class="mini-title" data-open-kind="meeting" data-open-id="${m.id}">${esc(m.title)}</button>
            <span class="mini-meta">${catBadge(m.category, false)}${ov ? `<span class="overdue-badge" title="Se solapa con otra reunión">${icon('warning', 12)} Solape</span>` : ''}</span></li>`;
        }).join('')}</ul>` : ''}
        ${tasks.length ? `<h3 class="panel-sub">${icon('list', 16)} Tareas</h3><ul class="mini-list">${tasks.map((t) => `
          <li class="mini-item ${t.status === 'done' ? 'is-done' : ''} ${Tasks.isOverdue(t) ? 'is-overdue' : ''}">
            <label class="check"><input type="checkbox" data-toggle-task="${t.id}" ${t.status === 'done' ? 'checked' : ''} aria-label="Completar ${esc(t.title)}"><span class="check-box">${icon('check', 12)}</span></label>
            <button type="button" class="mini-title" data-open-kind="task" data-open-id="${t.id}">${esc(t.title)}</button>
            <span class="mini-meta">${catBadge(t.category, false)}<span class="muted small">${t.dueTime || ''}</span></span></li>`).join('')}</ul>` : ''}
        ${reminders.length ? `<h3 class="panel-sub">${icon('bell', 16)} Avisos</h3><ul class="mini-list">${reminders.map((r) => `
          <li class="mini-item ${r.done ? 'is-done' : ''}"><span class="time-chip">${r.time}</span>
            <button type="button" class="mini-title" data-open-kind="reminder" data-open-id="${r.id}">${esc(r.title)}</button>
            <span class="mini-meta">${catBadge(r.category, false)}</span></li>`).join('')}</ul>` : ''}`;
    },

    /** Alternativa 2D: cuadrícula HTML (mes) o columnas (semana). */
    render2D(reason) {
      const host = this.el?.querySelector('#cal-scene');
      if (!host) return;
      if (reason) this.reason2D = reason;
      this.is2D = true;
      host.classList.add('scene-2d');
      const days = state.mode === 'month' ? monthDays(state.cursor) : weekDays(state.cursor);
      const dots = (d) => d.items.slice(0, 6).map((it) => `<span class="kind-dot kind-${it.kind} cat-${it.category}" title="${esc(it.title)}"></span>`).join('');
      host.innerHTML = `<p class="muted small">${esc(this.reason2D || '')}</p>
        ${state.mode === 'month' ? `<div class="cal-2d">
          ${WEEKDAYS_SHORT.map((w) => `<div class="cal-2d-head">${w}</div>`).join('')}
          ${days.map((d) => `<button type="button" class="cal-2d-day ${d.inMonth ? '' : 'out'} ${d.isToday ? 'today' : ''} ${d.date === state.selected ? 'selected' : ''}" data-day="${d.date}"
            aria-label="${fmtLong(d.date)}, ${d.items.length} elementos"><span class="num">${parseLocal(d.date).getDate()}</span><span class="dots">${dots(d)}</span></button>`).join('')}
        </div>` : `<div class="week-2d">${days.map((d, i) => `<button type="button" class="week-2d-col ${d.isToday ? 'today' : ''} ${d.date === state.selected ? 'selected' : ''}" data-day="${d.date}">
            <strong>${WEEKDAYS[i].slice(0, 3)} ${parseLocal(d.date).getDate()}</strong>
            ${d.items.map((it) => `<span class="week-2d-item cat-${it.category} kind-${it.kind}">${it.start ? `${it.start} ` : ''}${esc(it.title)}</span>`).join('')}
          </button>`).join('')}</div>`}`;
      host.onclick = (e) => { const b = e.target.closest('[data-day]'); if (b) this.selectDay(b.dataset.day); };
    },

    update() {
      if (!this.el) return;
      this.refresh(0);
    },

    unmount() {
      this.scene?.dispose();
      this.scene = null;
      this.is2D = false;
      this.el = null;
    },
  };

  O.Calendar = { itemsOn, CalendarView };
})();
