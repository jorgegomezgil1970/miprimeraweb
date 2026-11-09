/**
 * three/calendar3d.js — Calendario 3D.
 * - Vista mensual: cuadrícula de losetas 3D (una por día) con perspectiva; el día de
 *   hoy destacado y elevado; números de día con CSS2DRenderer.
 * - Indicadores 3D apilados por elemento (color = categoría; forma: cubo = tarea,
 *   cilindro = reunión, cono = aviso).
 * - Transición animada al cambiar de periodo (las losetas giran y se desplazan).
 * - Vista semanal: columnas por día con bloques horarios cuya altura (y fondo)
 *   representan la duración de las reuniones.
 * - Selección por raycasting: clic en un día => panel lateral.
 */
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import {
  THREE, quality, createRenderer, addSoftLights, addShadowGround, createLoop, createTweens,
  disposeObject, pointerNDC, tint,
} from './common.js';
import {
  CATEGORIES, WEEKDAYS_SHORT, WEEKDAYS, esc, parseLocal, timeToMin, fmtLong,
} from '../utils.js';

// Medidas de la vista mensual
const TW = 1.7; const TD = 1.32; const TH = 0.22; const GAP = 0.2;
// Medidas de la vista semanal
const CW = 1.7; const CGAP = 0.28; const H0 = 7; const H1 = 23; const HZ = 0.55; // unidades por hora
const KIND_LABEL = { task: 'Tarea', meeting: 'Reunión', reminder: 'Aviso' };

export function createCalendarScene(container, { tooltip, onSelectDay, onSelectItem }) {
  const q = quality();
  const renderer = createRenderer(container, q);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf6f8fb);

  const labels = new CSS2DRenderer();
  labels.setSize(container.clientWidth, container.clientHeight);
  labels.domElement.className = 'css2d-layer';
  container.appendChild(labels.domElement);

  const camera = new THREE.PerspectiveCamera(36, container.clientWidth / Math.max(1, container.clientHeight), 0.1, 200);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableDamping = !q.reducedMotion;
  controls.minDistance = 8;
  controls.maxDistance = 34;
  controls.minPolarAngle = 0.15;
  controls.maxPolarAngle = 1.05;
  controls.minAzimuthAngle = -0.55;
  controls.maxAzimuthAngle = 0.55;

  addSoftLights(scene, q, { size: 12 });
  addShadowGround(scene);
  const tweens = createTweens();
  const dur = (s) => (q.reducedMotion ? 0.001 : s);

  /* ---------- Recursos compartidos ---------- */
  const shared = {
    tile: new RoundedBoxGeometry(TW, TH, TD, q.segments, 0.08),
    task: new RoundedBoxGeometry(0.2, 0.2, 0.2, 1, 0.04),
    meeting: new THREE.CylinderGeometry(0.115, 0.115, 0.16, q.mobile ? 12 : 20),
    reminder: new THREE.ConeGeometry(0.13, 0.24, q.mobile ? 10 : 16),
    column: new RoundedBoxGeometry(CW, 0.16, (H1 - H0) * HZ + 0.4, q.segments, 0.06),
  };
  const catMats = {};
  const catMat = (cat, done) => {
    const key = `${cat}:${done}`;
    if (!catMats[key]) {
      catMats[key] = new THREE.MeshStandardMaterial({
        color: done ? tint(CATEGORIES[cat].color, 0.6) : new THREE.Color(CATEGORIES[cat].color), roughness: 0.5,
      });
    }
    return catMats[key];
  };

  let board = null;        // grupo actual
  let currentKey = '';
  let currentMode = '';
  let selected = '';
  const pickables = [];    // mallas con userData.date

  /* ---------- Construcción: indicadores de un día (vista mensual) ---------- */
  function buildIndicators(day) {
    const g = new THREE.Group();
    g.name = 'indicators';
    const piles = { task: [], meeting: [], reminder: [] };
    day.items.forEach((it) => piles[it.kind].push(it));
    const max = q.mobile ? 3 : 5;
    const offsets = { meeting: -0.45, task: 0, reminder: 0.45 };
    for (const kind of Object.keys(piles)) {
      piles[kind].slice(0, max).forEach((it, i) => {
        const m = new THREE.Mesh(shared[kind], catMat(it.category, it.done));
        const h = kind === 'meeting' ? 0.16 : kind === 'task' ? 0.2 : 0.24;
        m.position.set(offsets[kind], TH / 2 + h / 2 + i * (h + 0.03), 0.22);
        m.castShadow = true;
        m.userData = { date: day.date, item: it };
        pickables.push(m);
        g.add(m);
      });
    }
    return g;
  }

  /* ---------- Vista mensual ---------- */
  function buildMonth(days) {
    const group = new THREE.Group();
    group.userData.units = [];
    days.forEach((day, i) => {
      const r = Math.floor(i / 7); const c = i % 7;
      const unit = new THREE.Group();
      unit.position.set((c - 3) * (TW + GAP), 0, (r - 2.5) * (TD + GAP));
      const base = day.isToday ? 0xdbe8f8 : day.inMonth ? (day.weekend ? 0xf9fafc : 0xffffff) : 0xeef1f5;
      const mat = new THREE.MeshStandardMaterial({ color: base, roughness: 0.85, transparent: !day.inMonth, opacity: day.inMonth ? 1 : 0.75 });
      const tile = new THREE.Mesh(shared.tile, mat);
      tile.position.y = TH / 2;
      tile.castShadow = true;
      tile.receiveShadow = true;
      tile.userData = { date: day.date, day, tile: true };
      pickables.push(tile);
      unit.add(tile);
      unit.userData = { date: day.date, tile, baseY: day.isToday ? 0.32 : 0, lift: 0, day, col: c, row: r };
      unit.position.y = unit.userData.baseY;

      const ind = buildIndicators(day);
      ind.position.y = TH / 2;
      unit.add(ind);

      // Número del día (etiqueta HTML)
      const el = document.createElement('div');
      el.className = `day-num ${day.isToday ? 'today' : ''} ${day.inMonth ? '' : 'out'}`;
      el.textContent = parseLocal(day.date).getDate();
      const lbl = new CSS2DObject(el);
      lbl.position.set(-TW / 2 + 0.28, TH + 0.02, -TD / 2 + 0.26);
      unit.add(lbl);
      unit.userData.label = el;
      const more = day.items.length - countShown(day);
      if (more > 0) {
        const m = document.createElement('div');
        m.className = 'day-more'; m.textContent = `+${more}`;
        const o = new CSS2DObject(m); o.position.set(TW / 2 - 0.25, TH + 0.02, -TD / 2 + 0.26); unit.add(o);
      }
      group.add(unit);
      group.userData.units.push(unit);
    });
    // Cabecera L M X J V S D
    WEEKDAYS_SHORT.forEach((w, c) => {
      const el = document.createElement('div');
      el.className = 'weekday-label';
      el.textContent = w;
      const o = new CSS2DObject(el);
      o.position.set((c - 3) * (TW + GAP), 0.05, -2.5 * (TD + GAP) - TD / 2 - 0.45);
      group.add(o);
    });
    return group;
  }
  const countShown = (day) => {
    const max = q.mobile ? 3 : 5;
    const k = { task: 0, meeting: 0, reminder: 0 };
    day.items.forEach((it) => { k[it.kind]++; });
    return Math.min(k.task, max) + Math.min(k.meeting, max) + Math.min(k.reminder, max);
  };

  /* ---------- Vista semanal ---------- */
  const zOf = (time) => {
    const h = time ? timeToMin(time) / 60 : H0 - 0.6;
    return -((H1 - H0) * HZ) / 2 + (Math.max(H0 - 0.6, Math.min(H1, h)) - H0) * HZ;
  };
  function buildWeek(days) {
    const group = new THREE.Group();
    group.userData.units = [];
    const depth = (H1 - H0) * HZ;
    days.forEach((day, c) => {
      const unit = new THREE.Group();
      unit.position.set((c - 3) * (CW + CGAP), 0, 0);
      const mat = new THREE.MeshStandardMaterial({ color: day.isToday ? 0xdbe8f8 : day.weekend ? 0xf9fafc : 0xffffff, roughness: 0.85 });
      const col = new THREE.Mesh(shared.column, mat);
      col.position.set(0, 0.08, 0);
      col.receiveShadow = true;
      col.castShadow = true;
      col.userData = { date: day.date, day, tile: true };
      pickables.push(col);
      unit.add(col);
      unit.userData = { date: day.date, tile: col, baseY: day.isToday ? 0.15 : 0, lift: 0, day, col: c, row: 0 };
      unit.position.y = unit.userData.baseY;

      // Reuniones: carriles para las que se solapan
      const meetings = day.items.filter((it) => it.kind === 'meeting').sort((a, b) => a.start.localeCompare(b.start));
      const lanes = [];
      meetings.forEach((m) => {
        let lane = lanes.findIndex((end) => end <= m.start);
        if (lane === -1) { lane = lanes.length; lanes.push(m.end); } else lanes[lane] = m.end;
        m.lane = lane;
      });
      const nl = Math.max(1, lanes.length);
      meetings.forEach((m) => {
        const durH = Math.max(0.25, (timeToMin(m.end) - timeToMin(m.start)) / 60);
        const h = 0.18 + durH * 0.42;               // altura = duración
        const d = Math.max(0.12, durH * HZ - 0.06);   // fondo = duración en el eje horario
        const w = (CW - 0.3) / nl - 0.04;
        const geo = new RoundedBoxGeometry(w, h, d, 2, Math.min(0.06, w / 4, d / 4));
        const block = new THREE.Mesh(geo, catMat(m.category, false));
        block.position.set(-((CW - 0.3) / 2) + w / 2 + m.lane * (w + 0.04) + 0.02, 0.16 + h / 2, zOf(m.start) + d / 2 + 0.03);
        block.castShadow = true;
        block.userData = { date: day.date, item: m, ownGeometry: true };
        pickables.push(block);
        unit.add(block);
      });
      // Tareas y avisos: marcadores pequeños a su hora en el borde derecho
      day.items.filter((it) => it.kind !== 'meeting').slice(0, q.mobile ? 6 : 12).forEach((it, i) => {
        const m = new THREE.Mesh(shared[it.kind], catMat(it.category, it.done));
        m.position.set(CW / 2 - 0.2, 0.16 + 0.13, zOf(it.start) + (it.start ? 0 : i * 0.05));
        if (!it.start) m.position.x -= (i % 4) * 0.26;
        m.castShadow = true;
        m.userData = { date: day.date, item: it };
        pickables.push(m);
        unit.add(m);
      });
      const el = document.createElement('div');
      el.className = `weekday-label big ${day.isToday ? 'today' : ''}`;
      el.innerHTML = `${WEEKDAYS[c].slice(0, 3)} <strong>${parseLocal(day.date).getDate()}</strong>`;
      const o = new CSS2DObject(el);
      o.position.set(0, 0.2, -depth / 2 - 0.75);
      unit.add(o);
      unit.userData.label = el;
      group.add(unit);
      group.userData.units.push(unit);
    });
    // Líneas y etiquetas de horas
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xe1e6ee });
    const totalW = 7 * (CW + CGAP);
    for (let h = H0 + 1; h < H1; h += 2) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(totalW, 0.025), lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(0, 0.17, zOf(`${h}:00`));
      group.add(line);
      const el = document.createElement('div');
      el.className = 'hour-label';
      el.textContent = `${String(h).padStart(2, '0')}:00`;
      const o = new CSS2DObject(el);
      o.position.set(-totalW / 2 - 0.35, 0.17, zOf(`${h}:00`));
      group.add(o);
    }
    return group;
  }

  /* ---------- Mostrar periodo (con transición) ---------- */
  function setLabelsOpacity(group, k) {
    group.traverse((o) => { if (o.isCSS2DObject) o.element.style.opacity = String(k); });
  }

  function removeBoard(old, direction) {
    if (!old) return;
    // Quitar sus mallas de la lista de selección
    old.traverse((o) => { const i = pickables.indexOf(o); if (i >= 0) pickables.splice(i, 1); });
    const units = old.userData.units || [];
    const done = () => disposeBoard(old);
    if (q.reducedMotion) { done(); return; }
    const dx = direction * -3.5;
    tweens.add({
      duration: 0.45,
      onUpdate: (k) => {
        units.forEach((u) => {
          const stagger = Math.min(1, Math.max(0, k * 1.6 - (direction >= 0 ? u.userData.col : 6 - u.userData.col) * 0.08));
          u.rotation.x = stagger * (Math.PI / 2) * (direction === 0 ? 0 : 1);
          u.scale.setScalar(Math.max(0.001, 1 - stagger * 0.9));
        });
        old.position.x = dx * k;
        setLabelsOpacity(old, 1 - k);
      },
      onDone: done,
    });
  }
  function disposeBoard(group) {
    group.traverse((o) => {
      if (o.isMesh) {
        if (o.userData.ownGeometry || o.geometry.type === 'PlaneGeometry') o.geometry.dispose();
        // Materiales propios de losetas/columnas/líneas (los de categoría son compartidos)
        if (!Object.values(catMats).includes(o.material)) o.material.dispose();
      }
      if (o.isCSS2DObject) o.element.remove();
    });
    scene.remove(group);
  }

  function enterBoard(group, direction) {
    const units = group.userData.units;
    if (q.reducedMotion) return;
    const dx = direction * 3.5;
    group.position.x = dx;
    units.forEach((u) => { u.rotation.x = direction === 0 ? 0 : -Math.PI / 2; u.scale.setScalar(0.001); });
    setLabelsOpacity(group, 0);
    tweens.add({
      duration: 0.6,
      delay: direction === 0 ? 0 : 0.12,
      onUpdate: (k) => {
        group.position.x = dx * (1 - k);
        units.forEach((u) => {
          const s = Math.min(1, Math.max(0, k * 1.6 - (direction >= 0 ? u.userData.col : 6 - u.userData.col) * 0.08 - u.userData.row * 0.03));
          u.rotation.x = direction === 0 ? 0 : -Math.PI / 2 * (1 - s);
          u.scale.setScalar(Math.max(0.001, s));
        });
        setLabelsOpacity(group, k);
      },
      onDone: () => units.forEach((u) => { u.rotation.x = 0; u.scale.setScalar(1); }),
    });
  }

  function show({ mode, days, key, direction = 0, selected: sel }) {
    selected = sel || selected;
    hovered = null;
    if (key === currentKey && mode === currentMode && board) {
      // Mismo periodo: solo refrescar datos sin transición
      const old = board;
      old.traverse((o) => { const i = pickables.indexOf(o); if (i >= 0) pickables.splice(i, 1); });
      disposeBoard(old);
      board = mode === 'month' ? buildMonth(days) : buildWeek(days);
      scene.add(board);
      applySelection();
      return;
    }
    const modeChanged = mode !== currentMode;
    removeBoard(board, modeChanged ? 0 : direction);
    board = mode === 'month' ? buildMonth(days) : buildWeek(days);
    scene.add(board);
    enterBoard(board, modeChanged ? 0 : direction);
    currentKey = key;
    currentMode = mode;
    applySelection();
    if (modeChanged) fit();
  }

  function applySelection() {
    if (!board) return;
    board.userData.units.forEach((u) => {
      const isSel = u.userData.date === selected;
      u.userData.selected = isSel;
      const mat = u.userData.tile.material;
      mat.emissive = new THREE.Color(isSel ? 0x6b9bd1 : 0x000000);
      mat.emissiveIntensity = isSel ? 0.22 : 0;
      u.userData.label?.classList.toggle('selected', isSel);
    });
  }

  /* ---------- Interacción ---------- */
  const raycaster = new THREE.Raycaster();
  let hovered = null;  // unidad (día) bajo el puntero
  let downAt = null;
  const el = renderer.domElement;
  const pick = (ev) => {
    raycaster.setFromCamera(pointerNDC(ev, el), camera);
    return raycaster.intersectObjects(pickables, false)[0]?.object || null;
  };
  const unitOf = (obj) => { let o = obj; while (o && !o.userData?.tile?.isMesh) o = o.parent; return o; };
  const tip = (obj, ev) => {
    if (!tooltip) return;
    if (!obj) { tooltip.hidden = true; return; }
    const it = obj.userData.item;
    if (it) {
      tooltip.innerHTML = `<strong>${esc(it.title)}</strong><span>${KIND_LABEL[it.kind]} · ${CATEGORIES[it.category].label}${it.start ? ` · ${it.start}${it.end ? `–${it.end}` : ''}` : ''}</span>`;
    } else {
      const n = obj.userData.day?.items.length || 0;
      tooltip.innerHTML = `<strong>${fmtLong(obj.userData.date)}</strong><span>${n ? `${n} ${n === 1 ? 'elemento' : 'elementos'}` : 'Sin elementos'} · clic para ver</span>`;
    }
    tooltip.hidden = false;
    const parent = tooltip.offsetParent?.getBoundingClientRect() || container.getBoundingClientRect();
    let x = ev.clientX - parent.left + 14; const y = ev.clientY - parent.top + 14;
    x = Math.min(x, parent.width - tooltip.offsetWidth - 8);
    tooltip.style.transform = `translate(${Math.max(4, x)}px, ${y}px)`;
  };
  const onMove = (ev) => {
    const obj = pick(ev);
    hovered = obj ? unitOf(obj) : null;
    el.style.cursor = obj ? 'pointer' : 'grab';
    tip(obj, ev);
  };
  const onLeave = () => { hovered = null; tip(null); };
  const onDown = (ev) => { downAt = { x: ev.clientX, y: ev.clientY }; };
  const onUp = (ev) => {
    if (!downAt) return;
    const moved = Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y);
    downAt = null;
    if (moved > 6) return;
    const obj = pick(ev);
    if (!obj) return;
    tip(null);
    selected = obj.userData.date;
    applySelection();
    onSelectDay?.(obj.userData.date);
    // En la vista semanal, el clic sobre un bloque abre también el elemento
    if (currentMode === 'week' && obj.userData.item) onSelectItem?.(obj.userData.item);
  };
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerleave', onLeave);
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointerup', onUp);

  /* ---------- Cámara y tamaño ---------- */
  function fit() {
    const w = container.clientWidth; const h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    labels.setSize(w, h);
    camera.aspect = w / h;
    // Distancia según el campo de visión para que quepa toda la cuadrícula
    const week = currentMode === 'week';
    const halfW = week ? 3.5 * (CW + CGAP) + 1.1 : 3.5 * (TW + GAP) + 0.3;
    const halfD = week ? ((H1 - H0) * HZ) / 2 + 1.1 : 3 * (TD + GAP) + 0.7;
    const vfov = THREE.MathUtils.degToRad(camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
    const dist = Math.max(10, halfW / Math.tan(hfov / 2), (halfD * 0.9) / Math.tan(vfov / 2)) * 1.08;
    controls.maxDistance = Math.max(34, dist * 1.4);
    controls.target.set(week ? -0.3 : 0, 0, week ? 0.2 : 0.3);
    camera.position.set(controls.target.x, dist * 0.82, controls.target.z + dist * 0.57);
    camera.updateProjectionMatrix();
    controls.update();
  }
  const ro = new ResizeObserver(fit);
  ro.observe(container);
  fit();

  /* ---------- Bucle ---------- */
  const loop = createLoop((dt) => {
    tweens.step(dt);
    if (board) {
      const k = q.reducedMotion ? 1 : Math.min(1, dt * 10);
      for (const u of board.userData.units) {
        const target = u.userData.baseY + (u === hovered ? 0.14 : 0) + (u.userData.selected ? 0.1 : 0);
        u.position.y += (target - u.position.y) * k;
      }
    }
    controls.update();
    renderer.render(scene, camera);
    labels.render(scene, camera);
  });

  return {
    show,
    setSelected(date) { selected = date; applySelection(); },
    dispose() {
      loop.dispose();
      ro.disconnect();
      controls.dispose();
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
      tweens.clear();
      scene.children.filter((c) => c.userData?.units).forEach(disposeBoard);
      Object.values(shared).forEach((g) => g.dispose());
      Object.values(catMats).forEach((m) => m.dispose());
      disposeObject(scene);
      renderer.dispose();
      renderer.forceContextLoss?.();
      renderer.domElement.remove();
      labels.domElement.remove();
      if (tooltip) tooltip.hidden = true;
    },
  };
}
