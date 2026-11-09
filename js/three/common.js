/**
 * three/common.js — Utilidades compartidas por las escenas 3D:
 * creación del renderer, bucle de animación con pausa, interpolaciones (tweens)
 * y liberación de memoria (dispose).
 */
import * as THREE from 'three';
import { prefersReducedMotion, isMobile } from '../utils.js';

export { THREE };

/** Calidad según dispositivo: menos objetos y sombras más baratas en móvil. */
export function quality() {
  const mobile = isMobile();
  return {
    mobile,
    reducedMotion: prefersReducedMotion(),
    pixelRatio: Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2),
    shadows: true,
    shadowSize: mobile ? 512 : 1024,
    maxObjectsPerIsland: mobile ? 8 : 18,
    segments: mobile ? 2 : 4,
  };
}

/** Crea un renderer WebGL configurado (lanza si WebGL falla). */
export function createRenderer(container, q) {
  const renderer = new THREE.WebGLRenderer({ antialias: !q.mobile, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(q.pixelRatio);
  renderer.setSize(container.clientWidth || 300, container.clientHeight || 300);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = q.shadows;
  renderer.shadowMap.type = q.mobile ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.style.display = 'block';
  container.appendChild(renderer.domElement);
  return renderer;
}

/** Luces suaves y luminosas compartidas. */
export function addSoftLights(scene, q, { size = 14 } = {}) {
  const hemi = new THREE.HemisphereLight(0xffffff, 0xdfe6ef, 1.6);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 1.4);
  dir.position.set(6, 14, 8);
  dir.castShadow = q.shadows;
  dir.shadow.mapSize.set(q.shadowSize, q.shadowSize);
  dir.shadow.camera.left = -size; dir.shadow.camera.right = size;
  dir.shadow.camera.top = size; dir.shadow.camera.bottom = -size;
  dir.shadow.camera.near = 1; dir.shadow.camera.far = 40;
  dir.shadow.radius = 4;
  dir.shadow.bias = -0.0005;
  scene.add(dir);
  return { hemi, dir };
}

/** Suelo invisible que solo recibe sombras suaves. */
export function addShadowGround(scene, size = 60) {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.ShadowMaterial({ opacity: 0.08 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  ground.receiveShadow = true;
  scene.add(ground);
  return ground;
}

/**
 * Bucle de animación con requestAnimationFrame que se pausa cuando la pestaña
 * no está visible. `tick(dt, t)` se llama en cada fotograma.
 */
export function createLoop(tick) {
  let raf = 0; let last = performance.now(); let running = false;
  const frame = (now) => {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    tick(dt, now / 1000);
    raf = requestAnimationFrame(frame);
  };
  const start = () => { if (running || document.hidden) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); };
  const stop = () => { running = false; cancelAnimationFrame(raf); };
  const onVis = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', onVis);
  start();
  return {
    start, stop,
    dispose() { stop(); document.removeEventListener('visibilitychange', onVis); },
  };
}

/** Gestor de interpolaciones sencillas. */
export function createTweens() {
  const list = new Set();
  const ease = (t) => 1 - (1 - t) ** 3; // easeOutCubic
  return {
    /** Anima de 0 a 1 en `duration` s, con retraso opcional. */
    add({ duration = 0.4, delay = 0, onUpdate, onDone }) {
      const tw = { t: -delay, duration, onUpdate, onDone };
      list.add(tw);
      return tw;
    },
    step(dt) {
      for (const tw of list) {
        tw.t += dt;
        if (tw.t < 0) continue;
        const k = Math.min(1, tw.t / tw.duration);
        tw.onUpdate?.(ease(k), k);
        if (k >= 1) { list.delete(tw); tw.onDone?.(); }
      }
    },
    get size() { return list.size; },
    clear() { list.clear(); },
  };
}

/** Libera geometrías, materiales y texturas de un objeto y sus hijos. */
export function disposeObject(obj) {
  obj.traverse?.((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => { Object.values(m).forEach((v) => { if (v?.isTexture) v.dispose(); }); m.dispose(); });
    }
    if (o.isCSS2DObject) o.element?.remove();
  });
  obj.parent?.remove(obj);
}

/** Convierte coordenadas del puntero a NDC para raycasting. */
export function pointerNDC(event, el) {
  const r = el.getBoundingClientRect();
  return new THREE.Vector2(((event.clientX - r.left) / r.width) * 2 - 1, -((event.clientY - r.top) / r.height) * 2 + 1);
}

/** Aclara un color hex hacia el blanco (0..1). */
export function tint(hex, amount = 0.5) {
  return new THREE.Color(hex).lerp(new THREE.Color(0xffffff), amount);
}
