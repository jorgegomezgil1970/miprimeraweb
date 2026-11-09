/**
 * 3d/dashboard3d.js — Escena 3D del Inicio hecha con HTML + CSS 3D (sin librerías).
 * - Tres "islas" (Personal, Trabajo, Estudio) con las tareas pendientes de hoy y de los
 *   próximos 7 días: cubos (pendiente) o esferas (en curso). Color = categoría, tamaño = prioridad.
 * - Anillo de progreso por categoría (conic-gradient) con el % de tareas completadas.
 * - Órbita limitada (arrastrar), hover/foco que eleva el objeto + tooltip, clic que abre
 *   el detalle y animación al completar (sube, gira, encoge y desaparece).
 * - Cada objeto es un <button>: la escena es navegable con teclado y lector de pantalla.
 */
(function () {
  'use strict';
  const O = window.Organiza;
  const { CATEGORIES, CATEGORY_IDS, PRIORITIES, esc, relDay } = O.Utils;

  const R = 3;                                     // radio de la isla (unidades)
  const SIZE = { alta: 0.85, media: 0.66, baja: 0.5 };
  const SPACING = 6.9;
  const LAYOUTS = {
    row: [[-SPACING, 0], [0, 0], [SPACING, 0]],
    triangle: [[-4.3, 2.4], [4.3, 2.4], [0, -3.6]],
    column: [[0, -6.9], [0, 0], [0, 6.9]],
  };
  // Semiancho / semifondo de cada disposición (para calcular la escala)
  const EXTENT = {
    row: { w: SPACING + R + 0.9, d: R + 1.8 },
    triangle: { w: 4.3 + R + 0.9, d: 3.6 + R + 2 },
    column: { w: R + 0.9, d: 6.9 + R + 2 },
  };

  function createDashboardScene(container, { tooltip, onSelect }) {
    const q = O.Scene3D.quality();
    container.innerHTML = `
      <div class="s3d dash3d ${q.mobile ? 's3d-lite' : ''} ${q.reducedMotion ? 's3d-still' : ''}">
        <div class="s3d-camera"><div class="s3d-world" aria-label="Islas de categorías"></div></div>
      </div>`;
    const scene = container.querySelector('.s3d');
    const world = scene.querySelector('.s3d-world');
    const orbit = O.Scene3D.attachOrbit(scene, {
      rx: [25, 68], rz: [-40, 40], zoom: [0.6, 1.6], initial: { rx: 52, rz: -8, zoom: 1 },
    });

    let u = 30;              // píxeles por unidad (se recalcula al cambiar el tamaño)
    let layout = '';
    let last = null;
    const objects = new Map(); // taskId -> elemento

    /* ---------- Islas ---------- */
    const islands = {};
    CATEGORY_IDS.forEach((cat) => {
      const el = document.createElement('div');
      el.className = `island cat-${cat}`;
      el.innerHTML = `
        <div class="island-shadow"></div>
        <div class="island-layer l1"></div><div class="island-layer l2"></div><div class="island-layer l3"></div>
        <div class="island-ring" style="--pct:0"></div>
        <div class="island-top"></div>
        <div class="island-objects"></div>
        <div class="island-label"></div>`;
      world.appendChild(el);
      islands[cat] = { el, objects: el.querySelector('.island-objects'), label: el.querySelector('.island-label'), ring: el.querySelector('.island-ring') };
    });

    /** Posición de la n-ésima tarea en su isla (espiral de ángulo áureo), en unidades. */
    const slot = (n, total) => {
      if (total === 1) return [0, 0];
      const r = Math.min(R - 0.55, 0.62 * Math.sqrt(n + 0.6));
      const a = n * 2.399963 + 0.6;
      return [Math.cos(a) * r, Math.sin(a) * r];
    };

    /** HTML del objeto 3D de una tarea. */
    function objectInner(t) {
      const s = Math.round(SIZE[t.priority] * u);
      const color = CATEGORIES[t.category].color;
      const shape = t.status === 'doing'
        ? `<div class="sphere" style="--s:${s}px;--c:${color}"></div>`
        : O.Scene3D.box(s, s, s, { cls: 'cube', color });
      return `<span class="obj-shadow" style="--s:${s}px"></span><span class="lift"><span class="bob" style="animation-delay:${(-Math.random() * 3).toFixed(2)}s">${shape}</span></span>`;
    }

    function update(tasks, progress, meta = {}) {
      last = { tasks, progress };
      const byCat = { personal: [], trabajo: [], estudio: [] };
      const now = new Date();
      tasks.forEach((t) => {
        const due = new Date(`${t.dueDate}T${t.dueTime || '23:59'}`);
        byCat[t.category]?.push({ ...t, overdue: due < now });
      });
      const keep = new Set();
      for (const cat of CATEGORY_IDS) {
        const list = byCat[cat].slice(0, q.maxObjectsPerIsland);
        list.forEach((t, n) => {
          keep.add(t.id);
          let el = objects.get(t.id);
          const sig = `${t.status}|${t.priority}|${t.category}|${u}`;
          if (!el) {
            el = document.createElement('button');
            el.type = 'button';
            el.className = 'obj spawn';
            el.dataset.id = t.id;
            el.addEventListener('animationend', () => el.classList.remove('spawn'), { once: true });
            objects.set(t.id, el);
          }
          if (el.dataset.sig !== sig) { el.innerHTML = objectInner(t); el.dataset.sig = sig; }
          if (el.parentElement !== islands[cat].objects) islands[cat].objects.appendChild(el);
          el.classList.toggle('overdue', t.overdue);
          el._task = t;
          el.setAttribute('aria-label', `${t.title}. ${CATEGORIES[t.category].label}, prioridad ${PRIORITIES[t.priority].label.toLowerCase()}, ${relDay(t.dueDate)}${t.dueTime ? ` ${t.dueTime}` : ''}${t.overdue ? ', vencida' : ''}`);
          const [x, y] = slot(n, list.length);
          el.style.transform = `translate3d(${(x * u).toFixed(1)}px, ${(y * u).toFixed(1)}px, 0)`;
        });
        // Etiqueta y anillo de progreso
        const pr = progress[cat];
        const count = byCat[cat].length;
        islands[cat].label.innerHTML = `<strong>${CATEGORIES[cat].label}</strong> <span>${Math.round(pr.pct * 100)} %</span>
          <small>${count} ${count === 1 ? 'tarea' : 'tareas'} en 7 días${count > q.maxObjectsPerIsland ? ` (se muestran ${q.maxObjectsPerIsland})` : ''}</small>`;
        islands[cat].ring.style.setProperty('--pct', pr.pct.toFixed(3));
      }
      // Objetos que ya no deben mostrarse: animación de salida
      for (const [id, el] of [...objects]) {
        if (keep.has(id)) continue;
        objects.delete(id);
        const completed = meta.type === 'task-complete' && meta.id === id;
        el.classList.remove('spawn');
        el.classList.add(completed ? 'vanish' : 'fade');
        el.disabled = true;
        setTimeout(() => el.remove(), q.reducedMotion ? 0 : (completed ? 850 : 300));
      }
    }

    /* ---------- Interacción ---------- */
    const tipHTML = (t) => `<strong>${esc(t.title)}</strong><span>${CATEGORIES[t.category].label} · ${PRIORITIES[t.priority].label} · ${relDay(t.dueDate)}${t.dueTime ? ` ${t.dueTime}` : ''}${t.overdue ? ' · vencida' : ''}</span>`;
    const onOver = (e) => {
      const el = e.target.closest('.obj');
      if (el && el._task && !scene.classList.contains('orbiting')) O.Scene3D.placeTooltip(tooltip, el, tipHTML(el._task));
    };
    const onOut = (e) => { if (e.target.closest('.obj')) O.Scene3D.placeTooltip(tooltip, null); };
    const onClick = (e) => {
      const el = e.target.closest('.obj');
      if (!el) return;
      O.Scene3D.placeTooltip(tooltip, null);
      onSelect?.(el.dataset.id);
    };
    world.addEventListener('pointerover', onOver);
    world.addEventListener('pointerout', onOut);
    world.addEventListener('focusin', onOver);
    world.addEventListener('focusout', onOut);
    world.addEventListener('click', onClick);

    /* ---------- Tamaño y disposición ---------- */
    function fit() {
      const w = container.clientWidth; const h = container.clientHeight;
      if (!w || !h) return;
      const aspect = w / h;
      const next = aspect >= 1.25 ? 'row' : aspect >= 0.85 ? 'triangle' : 'column';
      const ext = EXTENT[next];
      // El fondo se ve escorzado por la inclinación (≈ cos 52°)
      const nu = Math.max(14, Math.min(60, Math.min(w / (2 * ext.w * 1.08), h / (2 * ext.d * 0.68))));
      if (next === layout && Math.abs(nu - u) < 0.5) return;
      layout = next; u = nu;
      scene.style.setProperty('--u', `${u}px`);
      CATEGORY_IDS.forEach((cat, i) => {
        const [x, y] = LAYOUTS[layout][i];
        islands[cat].el.style.transform = `translate3d(${(x * u).toFixed(1)}px, ${(y * u).toFixed(1)}px, 0)`;
      });
      if (last) update(last.tasks, last.progress, {});
    }
    const ro = new ResizeObserver(fit);
    ro.observe(container);
    fit();

    return {
      update,
      dispose() {
        ro.disconnect();
        orbit.dispose();
        world.removeEventListener('pointerover', onOver);
        world.removeEventListener('pointerout', onOut);
        world.removeEventListener('focusin', onOver);
        world.removeEventListener('focusout', onOut);
        world.removeEventListener('click', onClick);
        objects.clear();
        container.innerHTML = '';
        if (tooltip) tooltip.hidden = true;
      },
    };
  }

  O.Dashboard3D = { createDashboardScene };
})();
