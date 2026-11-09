/**
 * 3d/calendar3d.js — Calendario 3D hecho con HTML + CSS 3D (sin librerías).
 * - Vista mensual: losetas 3D (una por día, cada una es un <button>) con perspectiva;
 *   el día de hoy destacado y elevado.
 * - Indicadores 3D apilados: cubo = tarea, esfera = reunión, cono = aviso (color = categoría).
 * - Transición al cambiar de periodo: las losetas giran sobre sí mismas y el tablero se desplaza.
 * - Vista semanal: columnas por día con bloques cuya ALTURA representa la duración de la reunión.
 * - Teclado: flechas para moverse entre días (tabindex itinerante), Intro para abrir.
 */
(function () {
  'use strict';
  const O = window.Organiza;
  const { CATEGORIES, WEEKDAYS_SHORT, WEEKDAYS, esc, parseLocal, timeToMin, fmtLong } = O.Utils;

  // Medidas en unidades (se multiplican por --u píxeles)
  const TW = 1.7; const TD = 1.32; const TH = 0.22; const GAP = 0.2;         // mes
  const CW = 1.7; const CGAP = 0.28; const H0 = 7; const H1 = 23; const HZ = 0.55; // semana
  const KIND_LABEL = { task: 'Tarea', meeting: 'Reunión', reminder: 'Aviso' };

  function createCalendarScene(container, { tooltip, onSelectDay, onSelectItem }) {
    const q = O.Scene3D.quality();
    container.innerHTML = `
      <div class="s3d cal3d ${q.mobile ? 's3d-lite' : ''} ${q.reducedMotion ? 's3d-still' : ''}">
        <div class="s3d-camera"><div class="s3d-world"></div></div>
      </div>`;
    const scene = container.querySelector('.s3d');
    const world = scene.querySelector('.s3d-world');
    const orbit = O.Scene3D.attachOrbit(scene, {
      rx: [20, 62], rz: [-30, 30], zoom: [0.6, 1.7], initial: { rx: 46, rz: 0, zoom: 1 },
    });

    let u = 30;
    let board = null;
    let current = { key: '', mode: '', days: [] };
    let selected = '';

    const px = (v) => `${(v * u).toFixed(1)}px`;
    const itemAttrs = (it) => `data-kind="${it.kind}" data-id="${it.id}" data-title="${esc(it.title)}" data-cat="${it.category}" data-time="${it.start || ''}${it.end ? `–${it.end}` : ''}"`;
    const dayLabel = (d) => `${fmtLong(d.date)}: ${d.items.length ? `${d.items.length} ${d.items.length === 1 ? 'elemento' : 'elementos'}` : 'sin elementos'}${d.isToday ? ' (hoy)' : ''}`;

    /** Indicador 3D de un elemento. */
    function indicator(it, z, x, y) {
      // Los elementos hechos se muestran con el color aclarado
      const color = it.done ? `color-mix(in srgb, ${CATEGORIES[it.category].color} 40%, white)` : CATEGORIES[it.category].color;
      const s = Math.round(0.2 * u);
      const pos = `transform: translate3d(${x}px, ${y}px, ${z}px)`;
      const done = it.done ? 'is-done' : '';
      if (it.kind === 'task') return `<span class="ind ${done}" style="${pos}" ${itemAttrs(it)}>${O.Scene3D.box(s, s, s, { color })}</span>`;
      return `<span class="ind ${done}" style="${pos}" ${itemAttrs(it)}><span class="sprite billboard ${it.kind === 'meeting' ? 'sp-meeting' : 'sp-reminder'}" style="--s:${Math.round(0.24 * u)}px;--c:${color}"></span></span>`;
    }

    /** Pilas de indicadores sobre una loseta mensual. */
    function piles(day) {
      const groups = { meeting: [], task: [], reminder: [] };
      day.items.forEach((it) => groups[it.kind].push(it));
      const offX = { meeting: -0.45, task: 0, reminder: 0.45 };
      let html = ''; let shown = 0;
      for (const kind of Object.keys(groups)) {
        groups[kind].slice(0, q.maxPerPile).forEach((it, i) => {
          shown++;
          html += indicator(it, Math.round(i * 0.23 * u), Math.round((TW / 2 + offX[kind]) * u), Math.round((TD * 0.62) * u));
        });
      }
      const more = day.items.length - shown;
      return html + (more > 0 ? `<span class="day-more">+${more}</span>` : '');
    }

    /* ---------- Vista mensual ---------- */
    function buildMonth(days) {
      const el = document.createElement('div');
      el.className = 'cal-board month';
      el.setAttribute('role', 'grid');
      el.setAttribute('aria-label', 'Días del mes');
      let html = WEEKDAYS_SHORT.map((w, c) => `<span class="weekday-label" style="transform: translate3d(${px((c - 3) * (TW + GAP))}, ${px(-2.5 * (TD + GAP) - TD / 2 - 0.25)}, 0) rotateZ(calc(-1 * var(--rz))) rotateX(calc(-1 * var(--rx))) translate(-50%, -50%)" aria-hidden="true">${w}</span>`).join('');
      days.forEach((day, i) => {
        const r = Math.floor(i / 7); const c = i % 7;
        const color = day.isToday ? '#dbe8f8' : day.inMonth ? (day.weekend ? '#f9fafc' : '#ffffff') : '#eef1f5';
        html += `<div class="cell ${day.isToday ? 'today' : ''} ${day.inMonth ? '' : 'out'}" style="transform: translate3d(${px((c - 3) * (TW + GAP))}, ${px((r - 2.5) * (TD + GAP))}, 0); --c:${c}; --r:${r}">
          <div class="flip">
            <button type="button" class="tile" data-day="${day.date}" tabindex="-1" aria-label="${esc(dayLabel(day))}">
              <span class="lift">${O.Scene3D.box(Math.round(TW * u), Math.round(TD * u), Math.round(TH * u), {
                color, topContent: `<span class="day-num">${parseLocal(day.date).getDate()}</span>${piles(day)}`,
              })}</span>
            </button>
          </div>
        </div>`;
      });
      el.innerHTML = html;
      return el;
    }

    /* ---------- Vista semanal ---------- */
    const depth = (H1 - H0) * HZ;
    const yOf = (time) => {
      const h = time ? timeToMin(time) / 60 : H0 - 0.6;
      return -depth / 2 + (Math.max(H0 - 0.6, Math.min(H1, h)) - H0) * HZ;
    };
    function buildWeek(days) {
      const el = document.createElement('div');
      el.className = 'cal-board week';
      const shift = 0.5;
      const totalW = 7 * (CW + CGAP);
      let html = '';
      // Líneas y etiquetas de horas
      for (let h = H0 + 1; h < H1; h += 2) {
        const t = `${String(h).padStart(2, '0')}:00`;
        html += `<span class="hour-line" style="width:${px(totalW)}; transform: translate3d(${px(-totalW / 2 + shift)}, ${px(yOf(t))}, ${px(0.17)})"></span>
          <span class="hour-label" style="transform: translate3d(${px(-totalW / 2 + shift - 0.55)}, ${px(yOf(t))}, ${px(0.17)}) rotateZ(calc(-1 * var(--rz))) rotateX(calc(-1 * var(--rx))) translate(-100%, -50%)" aria-hidden="true">${t}</span>`;
      }
      days.forEach((day, c) => {
        const x = (c - 3) * (CW + CGAP) + shift;
        const color = day.isToday ? '#dbe8f8' : day.weekend ? '#f9fafc' : '#ffffff';
        // Reuniones repartidas en carriles si se solapan
        const meetings = day.items.filter((it) => it.kind === 'meeting').sort((a, b) => a.start.localeCompare(b.start));
        const lanes = [];
        meetings.forEach((m) => {
          let lane = lanes.findIndex((end) => end <= m.start);
          if (lane === -1) { lane = lanes.length; lanes.push(m.end); } else lanes[lane] = m.end;
          m.lane = lane;
        });
        const nl = Math.max(1, lanes.length);
        const blocks = meetings.map((m) => {
          const durH = Math.max(0.25, (timeToMin(m.end) - timeToMin(m.start)) / 60);
          const h = 0.18 + durH * 0.42;               // ALTURA = duración
          const d = Math.max(0.14, durH * HZ - 0.06);   // fondo = duración en el eje horario
          const w = (CW - 0.3) / nl - 0.04;
          const bx = -(CW - 0.3) / 2 + w / 2 + m.lane * (w + 0.04) + 0.02;
          return `<button type="button" class="block" style="transform: translate3d(${px(bx)}, ${px(yOf(m.start) + d / 2 + 0.03)}, ${px(0.16)})" ${itemAttrs(m)}
            aria-label="Reunión ${esc(m.title)}, ${m.start}–${m.end}">${O.Scene3D.box(Math.round(w * u), Math.round(d * u), Math.round(h * u), { color: CATEGORIES[m.category].color })}</button>`;
        }).join('');
        const markers = day.items.filter((it) => it.kind !== 'meeting').slice(0, q.mobile ? 6 : 12)
          .map((it, i) => indicator(it, Math.round(0.17 * u), Math.round((CW / 2 - 0.22 - (it.start ? 0 : (i % 4) * 0.26)) * u), Math.round(yOf(it.start) * u))).join('');
        html += `<div class="cell col ${day.isToday ? 'today' : ''}" style="transform: translate3d(${px(x)}, 0, 0); --c:${c}; --r:0">
          <div class="flip">
            <button type="button" class="tile" data-day="${day.date}" tabindex="-1" aria-label="${esc(dayLabel(day))}">
              <span class="lift">${O.Scene3D.box(Math.round(CW * u), Math.round((depth + 0.4) * u), Math.round(0.16 * u), { color })}</span>
            </button>
            ${blocks}${markers}
            <span class="weekday-label big ${day.isToday ? 'today' : ''}" data-day-label="${day.date}" style="transform: translate3d(0, ${px(-depth / 2 - 0.75)}, ${px(0.2)}) rotateZ(calc(-1 * var(--rz))) rotateX(calc(-1 * var(--rx))) translate(-50%, -100%)" aria-hidden="true">${WEEKDAYS[c].slice(0, 3)} <strong>${parseLocal(day.date).getDate()}</strong></span>
          </div>
        </div>`;
      });
      el.innerHTML = html;
      return el;
    }

    /* ---------- Mostrar periodo con transición ---------- */
    function show({ mode, days, key, direction = 0, selected: sel }) {
      if (sel) selected = sel;
      const same = key === current.key && mode === current.mode;
      const modeChanged = mode !== current.mode;
      current = { key, mode, days };
      const next = mode === 'month' ? buildMonth(days) : buildWeek(days);
      const old = board;
      board = next;
      world.appendChild(next);
      if (old) {
        if (same || q.reducedMotion) old.remove();
        else {
          old.classList.add(modeChanged || !direction ? 'leave-fade' : direction > 0 ? 'leave-next' : 'leave-prev');
          old.setAttribute('aria-hidden', 'true');
          old.querySelectorAll('button').forEach((b) => { b.tabIndex = -1; });
          setTimeout(() => old.remove(), 650);
        }
      }
      if (!same && !q.reducedMotion) next.classList.add(modeChanged || !direction ? 'enter-fade' : direction > 0 ? 'enter-next' : 'enter-prev');
      applySelection();
    }

    function applySelection() {
      if (!board) return;
      let any = false;
      board.querySelectorAll('.tile').forEach((t) => {
        const on = t.dataset.day === selected;
        any = any || on;
        t.closest('.cell').classList.toggle('selected', on);
        t.tabIndex = on ? 0 : -1;
        t.setAttribute('aria-pressed', String(on));
      });
      board.querySelectorAll('[data-day-label]').forEach((l) => l.classList.toggle('selected', l.dataset.dayLabel === selected));
      if (!any) { const first = board.querySelector('.tile'); if (first) first.tabIndex = 0; }
    }

    /* ---------- Interacción ---------- */
    const tipFor = (el) => {
      const ind = el.closest('[data-kind]');
      if (ind) {
        return `<strong>${ind.dataset.title}</strong><span>${KIND_LABEL[ind.dataset.kind]} · ${CATEGORIES[ind.dataset.cat].label}${ind.dataset.time ? ` · ${ind.dataset.time}` : ''}</span>`;
      }
      const tile = el.closest('.tile');
      if (!tile) return null;
      const d = current.days.find((x) => x.date === tile.dataset.day);
      const n = d?.items.length || 0;
      return `<strong>${fmtLong(tile.dataset.day)}</strong><span>${n ? `${n} ${n === 1 ? 'elemento' : 'elementos'}` : 'Sin elementos'} · clic para ver</span>`;
    };
    const onOver = (e) => {
      if (scene.classList.contains('orbiting')) return;
      const target = e.target.closest('[data-kind], .tile');
      if (!target) return;
      const html = tipFor(target);
      O.Scene3D.placeTooltip(tooltip, html ? (target.matches('.tile') ? target.querySelector('.f-top') : target) : null, html);
    };
    const onOut = (e) => { if (e.target.closest('[data-kind], .tile')) O.Scene3D.placeTooltip(tooltip, null); };
    const onClick = (e) => {
      const block = e.target.closest('.block');
      const tile = e.target.closest('.tile');
      const cell = e.target.closest('.cell');
      if (!cell) return;
      const date = tile?.dataset.day || cell.querySelector('.tile')?.dataset.day;
      O.Scene3D.placeTooltip(tooltip, null);
      selected = date;
      applySelection();
      onSelectDay?.(date);
      // En la vista semanal, el clic en un bloque abre también la reunión
      if (block) onSelectItem?.({ kind: block.dataset.kind, id: block.dataset.id });
    };
    // Flechas para moverse entre días (tabindex itinerante)
    const onKey = (e) => {
      const tile = e.target.closest('.tile');
      if (!tile || !board) return;
      const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: current.mode === 'month' ? 7 : 0, ArrowUp: current.mode === 'month' ? -7 : 0 }[e.key];
      if (!step) return;
      e.preventDefault();
      const tiles = [...board.querySelectorAll('.tile')];
      const next = tiles[tiles.indexOf(tile) + step];
      if (next) { tiles.forEach((t) => { t.tabIndex = -1; }); next.tabIndex = 0; next.focus(); }
    };
    world.addEventListener('pointerover', onOver);
    world.addEventListener('pointerout', onOut);
    world.addEventListener('focusin', onOver);
    world.addEventListener('focusout', onOut);
    world.addEventListener('click', onClick);
    world.addEventListener('keydown', onKey);

    /* ---------- Tamaño ---------- */
    /** Píxeles por unidad para que la vista quepa en el contenedor. */
    function computeU(mode) {
      const w = container.clientWidth; const h = container.clientHeight;
      if (!w || !h) return 0;
      const week = mode === 'week';
      const W = week ? 7 * (CW + CGAP) + 3.2 : 7 * (TW + GAP) + 0.3; // + margen para las horas
      const D = week ? depth + 1.8 : 6 * (TD + GAP) + 1;
      return Math.max(12, Math.min(64, Math.min(w / (W * 1.06), h / (D * 0.82))));
    }
    const setU = (nu) => { u = nu; scene.style.setProperty('--u', `${u}px`); };
    /** Al cambiar de tamaño: reconstruir el tablero a la nueva escala, sin animación. */
    function fit() {
      const nu = computeU(current.mode || 'month');
      if (!nu || Math.abs(nu - u) < 0.5) return;
      setU(nu);
      if (!current.mode) return;
      const nb = current.mode === 'month' ? buildMonth(current.days) : buildWeek(current.days);
      board?.remove();
      board = nb;
      world.appendChild(nb);
      applySelection();
    }
    const ro = new ResizeObserver(fit);
    ro.observe(container);

    const api = {
      show(opts) {
        if (opts.mode !== current.mode) { const nu = computeU(opts.mode); if (nu) setU(nu); }
        show(opts);
      },
      setSelected(date) { selected = date; applySelection(); },
      dispose() {
        ro.disconnect();
        orbit.dispose();
        world.removeEventListener('pointerover', onOver);
        world.removeEventListener('pointerout', onOut);
        world.removeEventListener('focusin', onOver);
        world.removeEventListener('focusout', onOut);
        world.removeEventListener('click', onClick);
        world.removeEventListener('keydown', onKey);
        container.innerHTML = '';
        if (tooltip) tooltip.hidden = true;
      },
    };
    return api;
  }

  O.Calendar3D = { createCalendarScene };
})();
