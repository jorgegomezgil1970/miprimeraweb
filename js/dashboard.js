/**
 * dashboard.js — Vista "Inicio": escena 3D (o alternativa 2D) + tarjetas HTML de resumen.
 * La escena 3D está hecha con HTML + CSS 3D (js/3d/dashboard3d.js); si el navegador
 * no admite transformaciones 3D, se muestra una versión 2D sin romper la app.
 */
(function () {
  'use strict';
  const O = window.Organiza;

  const { getState, matchesFilter } = O.Store;
  const { CATEGORIES, CATEGORY_IDS, esc, todayISO, addDays, relDay, fmtLong, has3D, PRIORITIES } = O.Utils;
  const { icon, emptyMeetings, emptyReminders } = O.Illus;
  const { catBadge, openTaskDetail, openMeetingDetail } = O.UI;
  const Tasks = O.lazy('Tasks');
  const { upcomingMeetings } = O.Meetings;
  const { pendingCount, upcoming: upcomingAlerts } = O.Reminders;

  /** Tareas pendientes de hoy y de los próximos 7 días (incluye vencidas de días anteriores). */
  function dashboardTasks() {
    const today = todayISO();
    const limit = addDays(today, 7);
    return getState().tasks.filter(matchesFilter)
      .filter((t) => t.status !== 'done' && t.dueDate && t.dueDate <= limit)
      .sort((a, b) => (a.dueDate + (a.dueTime || '99')).localeCompare(b.dueDate + (b.dueTime || '99')));
  }

  /** % de tareas completadas por categoría (sobre las que tienen fecha en la ventana o no tienen fecha). */
  function categoryProgress() {
    const out = {};
    for (const c of CATEGORY_IDS) {
      const list = getState().tasks.filter((t) => t.category === c);
      const done = list.filter((t) => t.status === 'done').length;
      out[c] = { total: list.length, done, pct: list.length ? done / list.length : 0 };
    }
    return out;
  }

  function greeting() {
    const h = new Date().getHours();
    if (h < 6) return 'Buenas noches';
    if (h < 13) return 'Buenos días';
    if (h < 21) return 'Buenas tardes';
    return 'Buenas noches';
  }

  const DashboardView = {
    el: null,
    scene: null,
    mount(el) {
      this.el = el;
      el.innerHTML = `
        <header class="view-header">
          <div><h1>${greeting()}</h1><p class="muted">Hoy es ${fmtLong(todayISO())}.</p></div>
        </header>
        <div id="dash-banner"></div>
        <div class="dashboard">
          <section class="scene-card" aria-labelledby="dash-scene-h">
            <div class="scene-head">
              <h2 id="dash-scene-h">Tu semana en 3D</h2>
              <ul class="legend" aria-label="Leyenda">
                ${CATEGORY_IDS.map((c) => `<li class="cat-${c}"><span class="swatch"></span>${CATEGORIES[c].label}</li>`).join('')}
                <li class="muted">Tamaño = prioridad · ● en curso · arrastra para girar</li>
              </ul>
            </div>
            <div class="scene" id="dash-scene" role="img" aria-label="Escena 3D con las tareas pendientes de los próximos 7 días agrupadas por categoría">
              <div class="scene-loading">Cargando escena 3D…</div>
            </div>
            <div class="scene-tooltip" id="dash-tip" role="tooltip" hidden></div>
            <div id="dash-progress" class="cat-progress"></div>
          </section>
          <div class="summary">
            <section class="card" aria-labelledby="dash-today-h">
              <div class="card-head"><h2 id="dash-today-h">${icon('list', 18)} Tareas de hoy</h2><a href="#/tareas" class="link">Ver todas</a></div>
              <ul class="mini-list" id="dash-today"></ul>
            </section>
            <section class="card" aria-labelledby="dash-meet-h">
              <div class="card-head"><h2 id="dash-meet-h">${icon('meeting', 18)} Próximas reuniones</h2><a href="#/calendario" class="link">Calendario</a></div>
              <ul class="mini-list" id="dash-meet"></ul>
            </section>
            <section class="card" aria-labelledby="dash-alert-h">
              <div class="card-head"><h2 id="dash-alert-h">${icon('bell', 18)} Avisos</h2><a href="#/avisos" class="link">Abrir panel</a></div>
              <div id="dash-alerts"></div>
            </section>
          </div>
        </div>`;

      el.querySelector('#dash-today').addEventListener('click', Tasks.handleTaskAction);
      el.querySelector('#dash-meet').addEventListener('click', (e) => {
        const b = e.target.closest('[data-meeting]'); if (b) openMeetingDetail(b.dataset.meeting);
      });
      this.updateCards();
      this.initScene();
    },

    /** Crea la escena 3D (CSS 3D, sin librerías) o la alternativa 2D si el navegador no la admite. */
    initScene() {
      const host = this.el.querySelector('#dash-scene');
      if (!has3D()) { this.render2D('Tu navegador no admite transformaciones 3D: se muestra la vista 2D.'); return; }
      try {
        host.innerHTML = '';
        this.scene = O.Dashboard3D.createDashboardScene(host, {
          tooltip: this.el.querySelector('#dash-tip'),
          onSelect: (id) => openTaskDetail(id),
        });
        this.scene.update(dashboardTasks(), categoryProgress());
      } catch (err) {
        console.warn('[Organiza] No se pudo iniciar el 3D, se usa la vista 2D.', err);
        this.scene = null;
        this.render2D('No se pudo crear la escena 3D: se muestra la vista 2D.');
      }
    },

    /** Alternativa 2D: tres columnas por categoría con las tareas como pastillas. */
    render2D(reason) {
      const host = this.el?.querySelector('#dash-scene');
      if (!host) return;
      host.classList.add('scene-2d');
      host.setAttribute('role', 'region');
      const tasks = dashboardTasks();
      const prog = categoryProgress();
      host.innerHTML = `<p class="muted small">${esc(reason)}</p><div class="islands-2d">
        ${CATEGORY_IDS.filter((c) => matchesFilter({ category: c })).map((c) => `<div class="island-2d cat-${c}">
          <h3>${icon(c, 16)} ${CATEGORIES[c].label} <span class="muted small">${Math.round(prog[c].pct * 100)}% hecho</span></h3>
          <div class="progress"><span style="width:${prog[c].pct * 100}%"></span></div>
          <ul>${tasks.filter((t) => t.category === c).map((t) => `<li><button type="button" class="pill prio-${t.priority}" data-task="${t.id}" style="--s:${PRIORITIES[t.priority].weight}">
            ${esc(t.title)}<span class="muted tiny">${relDay(t.dueDate)}</span></button></li>`).join('') || '<li class="muted small">Sin tareas</li>'}</ul>
        </div>`).join('')}</div>`;
      host.onclick = (e) => { const b = e.target.closest('[data-task]'); if (b) openTaskDetail(b.dataset.task); };
      this.scene2d = true;
    },

    updateCards() {
      const el = this.el;
      if (!el) return;
      el.querySelector('#dash-banner').innerHTML = Tasks.allDoneBanner();

      // Tareas de hoy (incluye vencidas)
      const today = todayISO();
      const todays = getState().tasks.filter(matchesFilter)
        .filter((t) => t.dueDate === today || (Tasks.isOverdue(t) && t.dueDate < today))
        .sort((a, b) => (a.status === 'done') - (b.status === 'done') || (a.dueTime || '99').localeCompare(b.dueTime || '99'));
      el.querySelector('#dash-today').innerHTML = todays.length ? todays.slice(0, 7).map((t) => `
        <li class="mini-item ${t.status === 'done' ? 'is-done' : ''} ${Tasks.isOverdue(t) ? 'is-overdue' : ''}" data-id="${t.id}">
          <label class="check"><input type="checkbox" data-action="toggle" ${t.status === 'done' ? 'checked' : ''} aria-label="Completar ${esc(t.title)}"><span class="check-box">${icon('check', 12)}</span></label>
          <button type="button" class="mini-title" data-action="open">${esc(t.title)}</button>
          <span class="mini-meta">${catBadge(t.category, false)}<span class="${Tasks.isOverdue(t) ? 'overdue' : 'muted'} small">${t.dueDate < today ? relDay(t.dueDate) : t.dueTime || '—'}</span></span>
        </li>`).join('') + (todays.length > 7 ? `<li class="muted small">y ${todays.length - 7} más…</li>` : '')
        : '<li class="empty compact"><p class="muted">No tienes tareas para hoy.</p></li>';

      // Próximas reuniones
      const meetings = upcomingMeetings(4);
      el.querySelector('#dash-meet').innerHTML = meetings.length ? meetings.map((m) => `
        <li class="mini-item cat-${m.category}">
          <span class="time-chip">${m.start}</span>
          <button type="button" class="mini-title" data-meeting="${m.id}">${esc(m.title)}</button>
          <span class="mini-meta">${catBadge(m.category, false)}<span class="muted small">${relDay(m.date)}</span></span>
        </li>`).join('')
        : `<li class="empty compact">${emptyMeetings()}<p class="muted">Sin reuniones próximas.</p></li>`;

      // Avisos
      const n = pendingCount();
      const next = upcomingAlerts(2).slice(0, 3);
      el.querySelector('#dash-alerts').innerHTML = `
        <p class="big-number ${n ? 'warn' : ''}"><strong>${n}</strong> <span>${n === 1 ? 'aviso pendiente' : 'avisos pendientes'}</span></p>
        ${next.length ? `<ul class="mini-list">${next.map((a) => `<li class="mini-item"><span class="time-chip">${String(a.triggerAt.getHours()).padStart(2, '0')}:${String(a.triggerAt.getMinutes()).padStart(2, '0')}</span><span class="mini-title static">${esc(a.title)}</span><span class="mini-meta">${catBadge(a.category, false)}<span class="muted small">${relDay(`${a.triggerAt.getFullYear()}-${String(a.triggerAt.getMonth() + 1).padStart(2, '0')}-${String(a.triggerAt.getDate()).padStart(2, '0')}`)}</span></span></li>`).join('')}</ul>`
          : (n ? '' : `<div class="empty compact">${emptyReminders()}<p class="muted">Nada a la vista en las próximas 48 h.</p></div>`)}`;

      // Progreso por categoría (texto accesible bajo la escena)
      const prog = categoryProgress();
      el.querySelector('#dash-progress').innerHTML = CATEGORY_IDS.map((c) => `
        <div class="cat-prog cat-${c}"><span>${icon(c, 14)} ${CATEGORIES[c].label}</span>
          <div class="progress" role="progressbar" aria-label="Progreso ${CATEGORIES[c].label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(prog[c].pct * 100)}"><span style="width:${prog[c].pct * 100}%"></span></div>
          <span class="small muted">${prog[c].done}/${prog[c].total}</span></div>`).join('');
    },

    update(meta = {}) {
      if (!this.el) return;
      this.updateCards();
      if (this.scene) this.scene.update(dashboardTasks(), categoryProgress(), meta);
      else if (this.scene2d) this.render2D(this.el.querySelector('#dash-scene .muted')?.textContent || '');
    },

    unmount() {
      this.scene?.dispose();
      this.scene = null;
      this.scene2d = false;
      this.el = null;
    },
  };

  O.Dashboard = { dashboardTasks, categoryProgress, DashboardView };
})();
