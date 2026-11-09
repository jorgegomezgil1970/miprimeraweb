/**
 * three/dashboard3d.js — Escena 3D del Inicio.
 * - Tres "islas" (Personal, Trabajo, Estudio) con las tareas pendientes de hoy y
 *   de los próximos 7 días como cubos redondeados (pendiente) o esferas (en curso).
 * - Color = categoría, tamaño = prioridad.
 * - Anillo (torus) de progreso por categoría con el % de tareas completadas.
 * - OrbitControls con límites, hover que eleva el objeto + tooltip HTML,
 *   clic que abre el detalle y animación al completar (encoge y desaparece).
 */
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import {
  THREE, quality, createRenderer, addSoftLights, addShadowGround, createLoop, createTweens,
  disposeObject, pointerNDC, tint,
} from './common.js';
import { CATEGORIES, CATEGORY_IDS, PRIORITIES, esc, relDay } from '../utils.js';

const ISLAND_RADIUS = 3;
const ISLAND_H = 0.5;
const SIZE = { alta: 0.85, media: 0.66, baja: 0.5 };
const SPACING = 6.9;
// Posiciones (x, z) de las islas Personal, Trabajo, Estudio según la disposición
const LAYOUTS = {
  row: [[-SPACING, 0], [0, 0], [SPACING, 0]],
  triangle: [[-4.3, 3.1], [4.3, 3.1], [0, -4.7]],
  column: [[0, -7.4], [0, 0], [0, 7.4]],
};
// Semiancho y semifondo aproximados de cada disposición (con anillo y etiqueta)
const LAYOUT_EXTENT = {
  row: { w: SPACING + ISLAND_RADIUS + 1, d: ISLAND_RADIUS + 2 },
  triangle: { w: 4.3 + ISLAND_RADIUS + 1, d: 4.7 + ISLAND_RADIUS + 2.6 },
  column: { w: ISLAND_RADIUS + 1.2, d: 7.4 + ISLAND_RADIUS + 1.8 },
};

/**
 * Crea la escena del dashboard dentro de `container`.
 * @returns {{ update(tasks, progress, meta), dispose() }}
 */
export function createDashboardScene(container, { tooltip, onSelect }) {
  const q = quality();
  const renderer = createRenderer(container, q);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf6f8fb);
  scene.fog = new THREE.Fog(0xf6f8fb, 30, 60);

  // Etiquetas HTML (CSS2DRenderer) superpuestas al canvas
  const labels = new CSS2DRenderer();
  labels.setSize(container.clientWidth, container.clientHeight);
  labels.domElement.className = 'css2d-layer';
  container.appendChild(labels.domElement);

  const camera = new THREE.PerspectiveCamera(38, container.clientWidth / Math.max(1, container.clientHeight), 0.1, 200);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableDamping = !q.reducedMotion;
  controls.dampingFactor = 0.08;
  controls.minDistance = 9;
  controls.maxDistance = 34;
  controls.minPolarAngle = 0.35;
  controls.maxPolarAngle = 1.25;
  controls.minAzimuthAngle = -1.1;
  controls.maxAzimuthAngle = 1.1;
  controls.target.set(0, 0.6, 0);

  addSoftLights(scene, q, { size: 14 });
  addShadowGround(scene);

  const tweens = createTweens();
  const dur = (s) => (q.reducedMotion ? 0.001 : s);

  /* ---------- Recursos compartidos (se liberan en dispose) ---------- */
  const geoCache = new Map();
  const getGeo = (shape, prio) => {
    const key = `${shape}:${prio}`;
    if (!geoCache.has(key)) {
      const s = SIZE[prio] || SIZE.media;
      geoCache.set(key, shape === 'sphere'
        ? new THREE.SphereGeometry(s * 0.58, q.mobile ? 16 : 28, q.mobile ? 12 : 20)
        : new RoundedBoxGeometry(s, s, s, q.segments, s * 0.2));
    }
    return geoCache.get(key);
  };
  const matCache = new Map();
  const getMat = (cat, overdue) => {
    const key = `${cat}:${overdue}`;
    if (!matCache.has(key)) {
      matCache.set(key, new THREE.MeshStandardMaterial({
        color: new THREE.Color(CATEGORIES[cat].color),
        roughness: 0.55, metalness: 0.02,
        emissive: overdue ? new THREE.Color(0xec7f6d) : new THREE.Color(0x000000),
        emissiveIntensity: overdue ? 0.35 : 0,
      }));
    }
    return matCache.get(key);
  };

  /* ---------- Islas, anillos de progreso y etiquetas ---------- */
  const islands = {};
  CATEGORY_IDS.forEach((cat, i) => {
    const group = new THREE.Group();
    group.position.x = (i - 1) * SPACING;
    const color = CATEGORIES[cat].color;
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS + 0.18, ISLAND_H, q.mobile ? 40 : 72),
      new THREE.MeshStandardMaterial({ color: tint(color, 0.72), roughness: 0.9 }),
    );
    base.position.y = ISLAND_H / 2;
    base.receiveShadow = true;
    base.castShadow = true;
    group.add(base);

    // Anillo de fondo + arco de progreso (en el plano horizontal)
    const ringGroup = new THREE.Group();
    ringGroup.rotation.x = -Math.PI / 2;
    ringGroup.position.y = 0.12;
    const bg = new THREE.Mesh(new THREE.TorusGeometry(ISLAND_RADIUS + 0.55, 0.07, 8, 96), new THREE.MeshStandardMaterial({ color: 0xe3e8ef, roughness: 0.8 }));
    ringGroup.add(bg);
    const arcMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.4 });
    const arc = new THREE.Mesh(new THREE.TorusGeometry(ISLAND_RADIUS + 0.55, 0.13, 10, 96, 0.0001), arcMat);
    arc.castShadow = true;
    ringGroup.add(arc);
    group.add(ringGroup);

    const labelEl = document.createElement('div');
    labelEl.className = `island-label cat-${cat}`;
    const label = new CSS2DObject(labelEl);
    label.position.set(0, -0.2, ISLAND_RADIUS + 1.3);
    group.add(label);

    scene.add(group);
    islands[cat] = { group, arc, pct: 0, labelEl };
  });

  /** Redibuja el arco de progreso con el porcentaje dado. */
  const setArc = (cat, pct) => {
    const isl = islands[cat];
    const old = isl.arc.geometry;
    isl.arc.geometry = new THREE.TorusGeometry(ISLAND_RADIUS + 0.55, 0.13, 10, Math.max(8, Math.round(96 * pct)), Math.max(0.0001, Math.PI * 2 * pct));
    old.dispose();
    isl.arc.visible = pct > 0.001;
  };

  /* ---------- Objetos de tareas ---------- */
  const meshes = new Map(); // taskId -> mesh
  const taskGroup = new THREE.Group();
  scene.add(taskGroup);

  /** Posición de la n-ésima tarea en su isla (espiral de ángulo áureo). */
  const slot = (cat, n, total) => {
    const isl = islands[cat].group.position;
    if (total === 1) return new THREE.Vector3(isl.x, 0, 0);
    const r = Math.min(ISLAND_RADIUS - 0.55, 0.62 * Math.sqrt(n + 0.6));
    const a = n * 2.399963 + 0.6;
    return new THREE.Vector3(isl.x + Math.cos(a) * r, 0, Math.sin(a) * r);
  };

  function spawn(task) {
    const shape = task.status === 'doing' ? 'sphere' : 'box';
    const mesh = new THREE.Mesh(getGeo(shape, task.priority), getMat(task.category, task.overdue));
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.userData = { taskId: task.id, shape, key: '', phase: Math.random() * Math.PI * 2, lift: 0, hover: 0, removing: false };
    mesh.scale.setScalar(0.001);
    taskGroup.add(mesh);
    tweens.add({ duration: dur(0.5), delay: q.reducedMotion ? 0 : Math.random() * 0.25, onUpdate: (k) => { if (!mesh.userData.removing) mesh.scale.setScalar(Math.max(0.001, k)); } });
    meshes.set(task.id, mesh);
    return mesh;
  }

  /** Animación de completar: el objeto sube, gira, encoge y desaparece. */
  function vanish(mesh, completed) {
    if (mesh.userData.removing) return;
    mesh.userData.removing = true;
    meshes.delete(mesh.userData.taskId);
    const y0 = mesh.position.y; const s0 = mesh.scale.x; const r0 = mesh.rotation.y;
    tweens.add({
      duration: dur(completed ? 0.8 : 0.35),
      onUpdate: (k) => {
        mesh.scale.setScalar(Math.max(0.001, s0 * (1 - k)));
        if (completed) { mesh.position.y = y0 + k * 1.2; mesh.rotation.y = r0 + k * Math.PI * 1.5; }
      },
      onDone: () => taskGroup.remove(mesh), // geometría y material compartidos: se liberan al final
    });
  }

  let currentLayout = 'row';
  let last = null;
  function update(tasks, progress, meta = {}) {
    last = { tasks, progress };
    const byCat = { personal: [], trabajo: [], estudio: [] };
    const overdueNow = new Date();
    tasks.forEach((t) => {
      const due = new Date(`${t.dueDate}T${t.dueTime || '23:59'}`);
      byCat[t.category]?.push({ ...t, overdue: due < overdueNow });
    });
    const keep = new Set();
    for (const cat of CATEGORY_IDS) {
      const list = byCat[cat].slice(0, q.maxObjectsPerIsland);
      list.forEach((t, n) => {
        keep.add(t.id);
        let mesh = meshes.get(t.id);
        const shape = t.status === 'doing' ? 'sphere' : 'box';
        const isNew = !mesh;
        if (isNew) mesh = spawn(t);
        // Actualizar forma/material si cambió estado, prioridad o categoría
        mesh.geometry = getGeo(shape, t.priority);
        mesh.material = getMat(t.category, t.overdue);
        mesh.userData.shape = shape;
        mesh.userData.task = t;
        const p = slot(cat, n, list.length);
        const half = shape === 'sphere' ? (SIZE[t.priority] * 0.58) : SIZE[t.priority] / 2;
        mesh.userData.target = new THREE.Vector3(p.x, ISLAND_H + half + 0.02, p.z);
        if (isNew) mesh.position.copy(mesh.userData.target);
      });
      // Etiqueta y progreso
      const pr = progress[cat];
      islands[cat].labelEl.innerHTML = `<strong>${CATEGORIES[cat].label}</strong> <span>${Math.round(pr.pct * 100)} %</span>
        <small>${byCat[cat].length} ${byCat[cat].length === 1 ? 'tarea' : 'tareas'} en 7 días${byCat[cat].length > q.maxObjectsPerIsland ? ` (se muestran ${q.maxObjectsPerIsland})` : ''}</small>`;
      const from = islands[cat].pct; const to = pr.pct;
      if (Math.abs(from - to) > 0.001) {
        islands[cat].pct = to;
        if (q.reducedMotion) setArc(cat, to);
        else tweens.add({ duration: 0.7, onUpdate: (k) => setArc(cat, from + (to - from) * k) });
      }
    }
    for (const [id, mesh] of [...meshes]) {
      if (!keep.has(id)) vanish(mesh, meta.type === 'task-complete' && meta.id === id);
    }
  }

  /* ---------- Interacción: hover + clic ---------- */
  const raycaster = new THREE.Raycaster();
  let hovered = null;
  let pointer = null;
  let downAt = null;
  const el = renderer.domElement;

  const pick = () => {
    if (!pointer) return null;
    raycaster.setFromCamera(pointer.ndc, camera);
    const hits = raycaster.intersectObjects([...meshes.values()], false);
    return hits[0]?.object || null;
  };
  const showTip = (mesh, ev) => {
    if (!tooltip) return;
    if (!mesh) { tooltip.hidden = true; return; }
    const t = mesh.userData.task;
    tooltip.innerHTML = `<strong>${esc(t.title)}</strong><span>${CATEGORIES[t.category].label} · ${PRIORITIES[t.priority].label} · ${relDay(t.dueDate)}${t.dueTime ? ` ${t.dueTime}` : ''}${t.overdue ? ' · vencida' : ''}</span>`;
    tooltip.hidden = false;
    const host = container.getBoundingClientRect();
    const parent = tooltip.offsetParent?.getBoundingClientRect() || host;
    let x = ev.clientX - parent.left + 14; const y = ev.clientY - parent.top + 14;
    x = Math.min(x, parent.width - tooltip.offsetWidth - 8);
    tooltip.style.transform = `translate(${Math.max(4, x)}px, ${y}px)`;
  };
  const onMove = (ev) => {
    pointer = { ndc: pointerNDC(ev, el), ev };
    const hit = pick();
    if (hit !== hovered) hovered = hit;
    el.style.cursor = hovered ? 'pointer' : 'grab';
    showTip(hovered, ev);
  };
  const onLeave = () => { pointer = null; hovered = null; showTip(null); };
  const onDown = (ev) => { downAt = { x: ev.clientX, y: ev.clientY }; };
  const onUp = (ev) => {
    if (!downAt) return;
    const moved = Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y);
    downAt = null;
    if (moved > 6) return;
    pointer = { ndc: pointerNDC(ev, el), ev };
    const hit = pick();
    if (hit) { showTip(null); onSelect?.(hit.userData.taskId); }
  };
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerleave', onLeave);
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointerup', onUp);

  /* ---------- Tamaño y cámara ---------- */
  const fit = () => {
    const w = container.clientWidth; const h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    labels.setSize(w, h);
    camera.aspect = w / h;
    // Disposición de las islas según la forma del contenedor:
    // fila (horizontal), triángulo (casi cuadrado) o columna (móvil vertical).
    const layout = camera.aspect >= 1.25 ? 'row' : camera.aspect >= 0.85 ? 'triangle' : 'column';
    if (layout !== currentLayout) {
      currentLayout = layout;
      const pos = LAYOUTS[layout];
      CATEGORY_IDS.forEach((cat, i) => islands[cat].group.position.set(pos[i][0], 0, pos[i][1]));
      if (last) update(last.tasks, last.progress, {});
    }
    // Distancia calculada con el campo de visión para que quepan las tres islas
    const ext = LAYOUT_EXTENT[layout];
    const vfov = THREE.MathUtils.degToRad(camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
    const dist = Math.max(13, ext.w / Math.tan(hfov / 2), (ext.d * 0.8) / Math.tan(vfov / 2)) * 1.12;
    controls.maxDistance = Math.max(34, dist * 1.4);
    // En disposiciones compactas, vista más cenital para que no se tapen las islas
    if (layout === 'row') camera.position.set(0, dist * 0.7, dist * 0.71);
    else camera.position.set(0, dist * 0.84, dist * 0.54);
    camera.updateProjectionMatrix();
    controls.update();
  };
  const ro = new ResizeObserver(fit);
  ro.observe(container);
  fit();

  /* ---------- Bucle ---------- */
  const loop = createLoop((dt, t) => {
    tweens.step(dt);
    for (const mesh of meshes.values()) {
      const ud = mesh.userData;
      if (!ud.target) continue;
      const isHover = mesh === hovered;
      ud.hover += ((isHover ? 1 : 0) - ud.hover) * (q.reducedMotion ? 1 : Math.min(1, dt * 12));
      const bob = q.reducedMotion ? 0 : Math.sin(t * 1.3 + ud.phase) * 0.05;
      const k = q.reducedMotion ? 1 : Math.min(1, dt * 6);
      mesh.position.x += (ud.target.x - mesh.position.x) * k;
      mesh.position.z += (ud.target.z - mesh.position.z) * k;
      mesh.position.y = ud.target.y + bob + ud.hover * 0.6;
      if (!ud.removing && mesh.scale.x >= 0.999) mesh.scale.setScalar(1 + ud.hover * 0.12);
      if (!q.reducedMotion && ud.shape === 'box') mesh.rotation.y += dt * 0.15;
    }
    controls.update();
    renderer.render(scene, camera);
    labels.render(scene, camera);
  });

  return {
    update,
    dispose() {
      loop.dispose();
      ro.disconnect();
      controls.dispose();
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
      tweens.clear();
      // Las mallas de tareas comparten geometría/material: liberar las cachés
      taskGroup.clear();
      geoCache.forEach((g) => g.dispose());
      matCache.forEach((m) => m.dispose());
      disposeObject(scene);
      renderer.dispose();
      renderer.forceContextLoss?.();
      renderer.domElement.remove();
      labels.domElement.remove();
      if (tooltip) tooltip.hidden = true;
    },
  };
}
