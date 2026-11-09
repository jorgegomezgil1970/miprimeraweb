/**
 * app.js — Arranque de Organiza y enrutado por vistas (hash: #/inicio, #/tareas…).
 * Conecta la navegación, el filtro global de categoría, el botón flotante "+",
 * el contador de avisos y el recorrido de bienvenida.
 */
(function () {
  'use strict';
  const O = window.Organiza;

  const { load, subscribe, getState, update, isPersistent } = O.Store;
  const { CATEGORIES, fmtLong, todayISO } = O.Utils;
  const { icon, welcome, onboardingStep } = O.Illus;
  const { toast, openModal, openNew } = O.UI;
  const { TasksView } = O.Tasks;
  const { KanbanView } = O.Kanban;
  const { RemindersView, startEngine, pendingCount, unlockAudio } = O.Reminders;
  const { SettingsView, loadSample } = O.Settings;
  const { DashboardView } = O.Dashboard;
  const { CalendarView } = O.Calendar;

  const ROUTES = {
    inicio:     { view: DashboardView, label: 'Inicio',     icon: 'home' },
    tareas:     { view: TasksView,     label: 'Tareas',     icon: 'list' },
    kanban:     { view: KanbanView,    label: 'Kanban',     icon: 'kanban' },
    calendario: { view: CalendarView,  label: 'Calendario', icon: 'calendar' },
    avisos:     { view: RemindersView, label: 'Avisos',     icon: 'bell' },
    ajustes:    { view: SettingsView,  label: 'Ajustes',    icon: 'settings' },
  };

  let current = null;       // ruta actual
  let firstRoute = true;

  /* ------------------------------------------------------------------ */
  /* Navegación                                                          */
  /* ------------------------------------------------------------------ */
  function renderNav() {
    const html = Object.entries(ROUTES).map(([key, r]) => `
      <li><a href="#/${key}" class="nav-link" data-route="${key}">
        ${icon(r.icon, 22)}<span class="nav-label">${r.label}</span>
        ${key === 'avisos' ? '<span class="badge" data-alert-badge hidden></span>' : ''}
      </a></li>`).join('');
    document.getElementById('nav-list').innerHTML = html;
  }

  function routeFromHash() {
    const key = (location.hash.replace(/^#\/?/, '') || 'inicio').split('?')[0];
    return ROUTES[key] ? key : 'inicio';
  }

  function navigate() {
    const key = routeFromHash();
    if (key === current) return;
    const main = document.getElementById('view');
    if (current) ROUTES[current].view.unmount?.();
    current = key;
    main.innerHTML = '';
    main.className = `view view-${key}`;
    main.dataset.view = key;
    ROUTES[key].view.mount(main);
    document.querySelectorAll('.nav-link').forEach((a) => {
      if (a.dataset.route === key) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    document.title = `${ROUTES[key].label} · Organiza`;
    // Accesibilidad: llevar el foco al título de la nueva vista (excepto en la primera carga)
    if (!firstRoute) {
      const h1 = main.querySelector('h1');
      if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
      window.scrollTo({ top: 0 });
    }
    firstRoute = false;
  }

  /* ------------------------------------------------------------------ */
  /* Filtro global de categoría                                          */
  /* ------------------------------------------------------------------ */
  function renderFilter() {
    const f = getState().settings.filter;
    const opts = [['all', 'Todas', 'all'], ...Object.values(CATEGORIES).map((c) => [c.id, c.label, c.id])];
    const host = document.getElementById('filter');
    host.innerHTML = opts.map(([id, label, ic]) => `
      <button type="button" role="radio" class="filter-btn ${id !== 'all' ? `cat-${id}` : ''}" data-filter="${id}"
        aria-checked="${f === id}" tabindex="${f === id ? 0 : -1}">${icon(ic, 16)}<span>${label}</span></button>`).join('');
  }
  function wireFilter() {
    const host = document.getElementById('filter');
    const set = (id) => update((s) => { s.settings.filter = id; }, { type: 'filter' });
    host.addEventListener('click', (e) => { const b = e.target.closest('[data-filter]'); if (b) set(b.dataset.filter); });
    // Navegación con flechas dentro del grupo de radios
    host.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      const btns = [...host.querySelectorAll('[data-filter]')];
      const i = btns.indexOf(document.activeElement);
      const next = btns[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length];
      e.preventDefault();
      set(next.dataset.filter);
      requestAnimationFrame(() => host.querySelector(`[data-filter="${next.dataset.filter}"]`)?.focus());
    });
  }

  /* ------------------------------------------------------------------ */
  /* Botón flotante "+"                                                  */
  /* ------------------------------------------------------------------ */
  function wireFab() {
    const fab = document.getElementById('fab');
    const menu = document.getElementById('fab-menu');
    fab.innerHTML = icon('plus', 28);
    menu.innerHTML = [['task', 'Tarea', 'list'], ['meeting', 'Reunión', 'meeting'], ['reminder', 'Aviso', 'bell']]
      .map(([k, l, ic]) => `<li role="none"><button type="button" role="menuitem" data-new="${k}">${icon(ic, 18)}<span>${l}</span></button></li>`).join('');
    const open = (v) => {
      fab.setAttribute('aria-expanded', String(v));
      menu.hidden = !v;
      fab.classList.toggle('open', v);
      if (v) menu.querySelector('button')?.focus();
    };
    fab.addEventListener('click', () => open(menu.hidden));
    menu.addEventListener('click', (e) => {
      const b = e.target.closest('[data-new]'); if (!b) return;
      open(false);
      openNew(b.dataset.new);
    });
    menu.addEventListener('keydown', (e) => {
      const items = [...menu.querySelectorAll('button')];
      const i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
      if (e.key === 'Escape') { open(false); fab.focus(); }
    });
    document.addEventListener('click', (e) => {
      if (!menu.hidden && !e.target.closest('#fab, #fab-menu')) open(false);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Contador de avisos                                                  */
  /* ------------------------------------------------------------------ */
  function refreshBadge() {
    const n = pendingCount();
    document.querySelectorAll('[data-alert-badge]').forEach((b) => {
      b.hidden = n === 0;
      b.textContent = n > 99 ? '99+' : String(n);
      b.setAttribute('aria-label', `${n} avisos pendientes`);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Bienvenida / onboarding en 3 pasos                                  */
  /* ------------------------------------------------------------------ */
  function showOnboarding() {
    const steps = [
      { ill: welcome(), title: 'Bienvenido a Organiza', text: 'Tu gestor personal de tareas, reuniones y avisos, organizado en tres ámbitos: Personal, Trabajo y Estudio.' },
      { ill: onboardingStep(1), title: '1 · Añade lo que tengas en mente', text: 'Usa el botón «+» para crear tareas, reuniones o avisos. Cada elemento tiene una categoría con su color.' },
      { ill: onboardingStep(2), title: '2 · Visualiza tu semana', text: 'El Inicio en 3D agrupa tus tareas en islas por categoría; el Kanban y el Calendario 3D te ayudan a planificar.' },
      { ill: onboardingStep(3), title: '3 · No se te pasará nada', text: 'Configura avisos con antelación: sonarán dentro de la app y verás los que se perdieron al volver.' },
    ];
    let i = 0;
    const finish = (withSample) => {
      update((s) => { s.settings.onboarded = true; }, { type: 'settings' });
      if (withSample) loadSample({ ask: false });
    };
    openModal({
      title: 'Primeros pasos',
      size: 'md',
      className: 'onboarding',
      body: '<div class="onb" aria-live="polite"></div>',
      footer: `<div class="onb-dots" aria-hidden="true"></div>
        <button type="button" class="btn btn-ghost" data-onb="prev">Atrás</button>
        <button type="button" class="btn btn-primary" data-onb="next">Siguiente</button>`,
      onMount: (dlg, close) => {
        const draw = () => {
          const s = steps[i];
          dlg.querySelector('.onb').innerHTML = `${s.ill}<h3>${s.title}</h3><p class="muted">${s.text}</p>
            ${i === steps.length - 1 ? `<div class="button-row center">
              <button type="button" class="btn btn-ghost" data-end="empty">Empezar vacío</button>
              <button type="button" class="btn btn-primary" data-end="sample">${icon('sparkle', 16)} Cargar ejemplo</button></div>` : ''}`;
          dlg.querySelector('.onb-dots').innerHTML = steps.map((_, k) => `<span class="${k === i ? 'on' : ''}"></span>`).join('');
          dlg.querySelector('[data-onb=prev]').disabled = i === 0;
          dlg.querySelector('[data-onb=next]').hidden = i === steps.length - 1;
        };
        requestAnimationFrame(() => dlg.querySelector('[data-onb=next]').focus());
        dlg.addEventListener('click', (e) => {
          const nav = e.target.closest('[data-onb]');
          if (nav) { i = Math.max(0, Math.min(steps.length - 1, i + (nav.dataset.onb === 'next' ? 1 : -1))); draw(); dlg.querySelector('[data-onb=next]:not([hidden])')?.focus() || dlg.querySelector('[data-end=sample]')?.focus(); }
          const end = e.target.closest('[data-end]');
          if (end) { finish(end.dataset.end === 'sample'); close(); }
        });
        draw();
      },
      onClose: () => { if (!getState().settings.onboarded) update((s) => { s.settings.onboarded = true; }, { type: 'settings' }); },
    });
  }

  /* ------------------------------------------------------------------ */
  /* Arranque                                                            */
  /* ------------------------------------------------------------------ */
  function boot() {
    load();
    renderNav();
    renderFilter();
    wireFilter();
    wireFab();
    document.getElementById('today-label').textContent = fmtLong(todayISO());

    subscribe((state, meta) => {
      if (meta.type === 'filter' || meta.type === 'replace') renderFilter();
      if (current) ROUTES[current].view.update?.(meta);
      refreshBadge();
    });

    window.addEventListener('hashchange', navigate);
    window.addEventListener('organiza:onboarding', showOnboarding);
    navigate();
    refreshBadge();
    unlockAudio();
    startEngine();

    if (!isPersistent()) {
      document.getElementById('persist-flag').hidden = false;
      toast({ type: 'warning', title: 'Sin guardado', message: 'No se puede usar el almacenamiento local. La app funciona en memoria: exporta una copia para no perder datos.', duration: 9000 });
    }
    if (!getState().settings.onboarded) setTimeout(showOnboarding, 300);

    // Cambio de día con la app abierta: refrescar la vista
    let day = todayISO();
    setInterval(() => {
      if (todayISO() !== day) { day = todayISO(); document.getElementById('today-label').textContent = fmtLong(day); ROUTES[current]?.view.update?.({ type: 'day' }); }
    }, 60_000);

    window.__organizaBooted = true;
  }

  boot();
})();
