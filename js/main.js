/* =====================================================================
   CALENDARIO DE ADVIENTO 3D — Lógica principal
   ---------------------------------------------------------------------
   Contenido:
     1. Utilidades (almacenamiento seguro, fechas, animaciones)
     2. Construcción de la escena 3D (cielo, luna, suelo, árbol, nieve)
     3. Regalos 3D (texturas de canvas, estados, apertura)
     4. Interacción (Raycaster, ratón y táctil)
     5. Modal del día + mini visor 3D
     6. Interfaz: portada, HUD, sonido, modo prueba
     7. Bucle de render y arranque
   ===================================================================== */
(function () {
'use strict';

/* Three.js y sus complementos los carga index.html desde el CDN y los
   deja en variables globales; el resto de archivos también son scripts
   clásicos, así la página funciona abriendo index.html con doble clic. */
const THREE = window.THREE;
const { OrbitControls, EffectComposer, RenderPass, UnrealBloomPass, OutputPass } = window.ThreeAddons;
const CONFIG = window.CONFIG;
const audio = window.audio;
const { getIllustration, photoPlaceholder, ILLUSTRATION_NAMES } = window.Illustrations;
const { createDayObject, createEnvironment, disposeObject, OBJECT_NAMES } = window.DayObjects;

/* =====================================================================
   1. UTILIDADES
   ===================================================================== */
const $ = (sel) => document.querySelector(sel);
const IS_MOBILE = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 760;
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const TEST_MODE = new URLSearchParams(window.location.search).get('test') === '1';
const PIXEL_RATIO = Math.min(window.devicePixelRatio || 1, 2);

/* localStorage envuelto en try/catch: si no está disponible
   (modo privado, permisos…), la app sigue funcionando sin guardar. */
const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sin almacenamiento */ }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch { /* sin almacenamiento */ }
  },
};
const OPENED_KEY = 'adviento.opened';
const openedDays = new Set((store.get(OPENED_KEY, []) || []).filter((d) => Number.isInteger(d)));
const saveOpened = () => store.set(OPENED_KEY, [...openedDays]);

/* --- Fechas y desbloqueo ------------------------------------------- */
const testState = { unlockAll: true, simDate: null };

function currentDate() {
  return TEST_MODE && testState.simDate ? new Date(testState.simDate) : new Date();
}

/* Regla: en diciembre el día N se abre a partir del N; desde el 25 (y
   durante enero) todo está abierto; el resto del año todo bloqueado. */
function isUnlocked(day) {
  if (TEST_MODE && testState.unlockAll) return true;
  const d = currentDate();
  const month = d.getMonth();
  if (month === 11) return d.getDate() >= day;
  if (month === 0) return true;
  return false;
}

/* Días que faltan hasta el N de diciembre de esta temporada. */
function daysUntil(day) {
  const d = currentDate();
  const today = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const target = new Date(d.getFullYear(), 11, day);
  return Math.max(1, Math.round((target - today) / 86400000));
}

/* --- Sistema mínimo de animaciones (tweens) ------------------------ */
const ease = {
  linear: (t) => t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
};
const tweens = new Set();

/* tween({ duration, delay, easing, update(k, t) }) → Promise */
function tween({ duration = 1, delay = 0, easing = ease.inOutCubic, update }) {
  return new Promise((resolve) => {
    tweens.add({ duration, delay, easing, update, elapsed: 0, resolve });
  });
}
function updateTweens(dt) {
  for (const tw of tweens) {
    if (tw.delay > 0) { tw.delay -= dt; continue; }
    tw.elapsed += dt;
    const t = Math.min(1, tw.elapsed / tw.duration);
    tw.update(tw.easing(t), t);
    if (t >= 1) {
      tweens.delete(tw);
      tw.resolve();
    }
  }
}
const wait = (s) => tween({ duration: s, update: () => {} });

/* Generador aleatorio con semilla (distribución estable de los regalos). */
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* Textura de destello radial (para brillos y partículas). */
function makeGlowTexture(inner = 'rgba(255,255,255,1)', mid = 'rgba(160,230,255,.45)') {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner);
  g.addColorStop(0.25, mid);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* Textura de chispa de 4 puntas. */
function makeSparkTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.2, 'rgba(255,255,255,.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  ctx.beginPath();
  ctx.moveTo(32, 0); ctx.quadraticCurveTo(34, 30, 64, 32); ctx.quadraticCurveTo(34, 34, 32, 64);
  ctx.quadraticCurveTo(30, 34, 0, 32); ctx.quadraticCurveTo(30, 30, 32, 0);
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* =====================================================================
   2. ESCENA 3D
   ===================================================================== */
const canvas = $('#scene');
let renderer, scene, camera, controls, composer, bloomPass;
const clock = new THREE.Clock();
let elapsed = 0;
let sceneActive = true;          // se pausa el render en móvil con el modal abierto
const animated = [];             // funciones update(dt, t) de elementos animados
const sparkTexture = makeSparkTexture();
const glowTexture = makeGlowTexture();

const TREE_TARGET = new THREE.Vector3(0, 2.1, 0);

function cameraHome() {
  // En pantallas verticales alejamos la cámara para que quepa el árbol
  const aspect = window.innerWidth / window.innerHeight;
  const dist = aspect < 0.75 ? 16.5 : aspect < 1.1 ? 12 : 10;
  return { pos: new THREE.Vector3(0, 3.4, dist), target: TREE_TARGET.clone(), dist };
}

function initRenderer() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: !IS_MOBILE, powerPreference: 'high-performance' });
  renderer.setPixelRatio(PIXEL_RATIO);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = !IS_MOBILE;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050b1d);
  scene.fog = new THREE.FogExp2(0x081430, 0.034);

  camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 1200);
  camera.position.set(0, 10, 26); // posición inicial (se anima al entrar)

  controls = new OrbitControls(camera, canvas);
  controls.target.copy(TREE_TARGET);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 6;
  controls.maxDistance = 20;
  controls.minPolarAngle = 0.35;
  controls.maxPolarAngle = 1.48;
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.7;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.45;
  controls.enabled = false; // se activa tras la portada
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };

  // Post-procesado: bloom para que luces, luna y estrella brillen
  composer = new EffectComposer(renderer);
  composer.setPixelRatio(PIXEL_RATIO);
  composer.setSize(window.innerWidth, window.innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  const bloomScale = IS_MOBILE ? 0.5 : 1;
  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth * bloomScale, window.innerHeight * bloomScale), 0.7, 0.5, 0.92,
  );
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());

  // Entorno para reflejos de metal y hielo
  const env = createEnvironment(renderer);
  scene.environment = env.texture;
}

/* --- Cielo con degradado y aurora tenue ---------------------------- */
function buildSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      uniform float uTime;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 horizon = vec3(0.035, 0.065, 0.17);
        vec3 mid     = vec3(0.012, 0.022, 0.07);
        vec3 zenith  = vec3(0.002, 0.004, 0.018);
        vec3 col = mix(horizon, mid, smoothstep(-0.05, 0.25, h));
        col = mix(col, zenith, smoothstep(0.25, 0.95, h));
        // Aurora suave: cortinas cian/lavanda que ondulan muy despacio
        float a = atan(d.z, d.x);
        float band = smoothstep(0.06, 0.2, h) * (1.0 - smoothstep(0.28, 0.6, h));
        float wave = sin(a * 3.0 + uTime * 0.05 + sin(a * 7.0 - uTime * 0.07) * 0.9) * 0.5 + 0.5;
        float curtain = pow(wave, 3.0) * band;
        vec3 aur = mix(vec3(0.15, 0.75, 0.9), vec3(0.55, 0.42, 1.0), sin(a * 2.0 + uTime * 0.03) * 0.5 + 0.5);
        col += aur * curtain * 0.09;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), mat);
  scene.add(sky);
  animated.push((dt, t) => { mat.uniforms.uTime.value = t; });
}

/* --- Material de puntos que titilan (estrellas y escarcha) --------- */
function twinkleMaterial(color, sizeScale = 1, attenuate = false) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uPR: { value: PIXEL_RATIO * sizeScale },
    },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute float aPhase;
      uniform float uTime;
      uniform float uPR;
      varying float vTw;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        vTw = 0.45 + 0.55 * pow(0.5 + 0.5 * sin(uTime * (0.8 + aPhase * 2.0) + aPhase * 40.0), 2.0);
        gl_PointSize = aSize * uPR ${attenuate ? '* (14.0 / -mv.z)' : ''};
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vTw;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        float core = smoothstep(0.5, 0.0, d);
        float cross = max(0.0, 1.0 - abs(c.x) * 14.0) * max(0.0, 1.0 - abs(c.y) * 2.2)
                    + max(0.0, 1.0 - abs(c.y) * 14.0) * max(0.0, 1.0 - abs(c.x) * 2.2);
        float a = pow(core, 2.2) + cross * 0.35 * vTw;
        gl_FragColor = vec4(uColor * (0.6 + vTw), a * vTw);
      }`,
  });
}

function buildStars() {
  const count = IS_MOBILE ? 900 : 1800;
  const pos = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const phase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    // Solo en el hemisferio superior
    const u = Math.random() * Math.PI * 2;
    const v = Math.acos(1 - Math.random() * 0.95);
    const r = 420;
    pos[i * 3] = r * Math.sin(v) * Math.cos(u);
    pos[i * 3 + 1] = r * Math.cos(v) + 10;
    pos[i * 3 + 2] = r * Math.sin(v) * Math.sin(u);
    size[i] = Math.random() < 0.06 ? 6 + Math.random() * 4 : 1.5 + Math.random() * 2.6;
    phase[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  const mat = twinkleMaterial(0xdfeaff);
  const stars = new THREE.Points(geo, mat);
  stars.frustumCulled = false;
  scene.add(stars);
  animated.push((dt, t) => { mat.uniforms.uTime.value = t; stars.rotation.y = t * 0.004; });
}

/* --- Luna con halo y luz de luna ----------------------------------- */
let moonLight;
function buildMoon() {
  const dir = new THREE.Vector3(-0.55, 0.42, -0.72).normalize();
  const moonPos = dir.clone().multiplyScalar(260);
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(9, 32, 24),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.7, 2.0), fog: false }),
  );
  moon.position.copy(moonPos);
  scene.add(moon);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture('rgba(220,235,255,.9)', 'rgba(140,170,255,.25)'),
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true,
  }));
  halo.scale.setScalar(120);
  halo.position.copy(moonPos);
  scene.add(halo);

  moonLight = new THREE.DirectionalLight(0xb4caff, 1.15);
  moonLight.position.copy(dir.clone().multiplyScalar(30));
  moonLight.target.position.set(0, 0, 0);
  if (!IS_MOBILE) {
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.set(2048, 2048);
    const s = moonLight.shadow.camera;
    s.left = -10; s.right = 10; s.top = 10; s.bottom = -10; s.near = 5; s.far = 70;
    moonLight.shadow.bias = -0.0005;
    moonLight.shadow.normalBias = 0.02;
  }
  scene.add(moonLight, moonLight.target);

  scene.add(new THREE.HemisphereLight(0x5674c4, 0x0b1430, 0.45));
}

/* --- Suelo nevado con relieve, montículos y escarcha brillante ----- */
function buildGround() {
  const geo = new THREE.PlaneGeometry(220, 220, 160, 160);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const r = Math.hypot(x, z);
    const k = THREE.MathUtils.smoothstep(r, 7, 22);
    const h = Math.sin(x * 0.27) * Math.cos(z * 0.21) * 0.45 + Math.sin(x * 0.07 + 1.3) * Math.cos(z * 0.06) * 1.6;
    p.setY(i, h * k + Math.sin(x * 1.7 + z * 1.3) * 0.025);
  }
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: 0xa9bde6, roughness: 0.95, metalness: 0, envMapIntensity: 0.25,
  }));
  ground.receiveShadow = true;
  scene.add(ground);

  // Montículo de nieve bajo el árbol
  const mound = new THREE.Mesh(new THREE.SphereGeometry(2.2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xb8c9ec, roughness: 0.9 }));
  mound.scale.set(1, 0.16, 1);
  mound.receiveShadow = true;
  scene.add(mound);

  // Escarcha que centellea sobre la nieve
  const count = IS_MOBILE ? 500 : 1300;
  const pos = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const phase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 2.5 + Math.pow(Math.random(), 0.7) * 26;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const k = THREE.MathUtils.smoothstep(r, 7, 22);
    const h = Math.sin(x * 0.27) * Math.cos(z * 0.21) * 0.45 + Math.sin(x * 0.07 + 1.3) * Math.cos(z * 0.06) * 1.6;
    pos[i * 3] = x; pos[i * 3 + 1] = h * k + 0.04; pos[i * 3 + 2] = z;
    size[i] = 1.2 + Math.random() * 2.2;
    phase[i] = Math.random();
  }
  const g2 = new THREE.BufferGeometry();
  g2.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g2.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g2.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  const mat = twinkleMaterial(0xd8f4ff, 1, true);
  const glitter = new THREE.Points(g2, mat);
  scene.add(glitter);
  animated.push((dt, t) => { mat.uniforms.uTime.value = t; });
}

/* Cono "de pino" con borde dentado y colores de escarcha por vértice. */
function pineLayerGeometry(radius, height, segments, darkColor, frostColor, jag = 0.18) {
  const geo = new THREE.ConeGeometry(radius, height, segments, 2, false);
  const p = geo.attributes.position;
  const colors = new Float32Array(p.count * 3);
  const dark = new THREE.Color(darkColor);
  const frost = new THREE.Color(frostColor);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const r = Math.hypot(x, z);
    const isRim = Math.abs(y + height / 2) < 1e-4 && r > 1e-3;
    if (isRim) {
      const a = Math.atan2(z, x);
      const idx = Math.round(((a + Math.PI) / (Math.PI * 2)) * segments);
      const tip = idx % 2 === 0;
      const k = tip ? 1 : 1 - jag;
      x *= k; z *= k;
      if (tip) y -= height * 0.1;
      p.setXYZ(i, x, y, z);
    }
    // Más escarcha cuanto más abajo/afuera
    const t = THREE.MathUtils.clamp((height / 2 - y) / height, 0, 1);
    c.copy(dark).lerp(frost, isRim ? 1 : Math.pow(t, 2.5) * 0.45);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

/* --- Bosque lejano (siluetas de pinos con escarcha) ---------------- */
function buildForest() {
  const geo = pineLayerGeometry(1, 2, 9, 0x0a1a33, 0x6f88b8, 0.25);
  geo.translate(0, 1, 0);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
  const count = IS_MOBILE ? 50 : 90;
  const forest = new THREE.InstancedMesh(geo, mat, count * 2);
  const d = new THREE.Object3D();
  const rand = seeded(7);
  let n = 0;
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2;
    const r = 20 + rand() * 38;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const s = 1.5 + rand() * 2.4;
    const k = THREE.MathUtils.smoothstep(r, 7, 22);
    const y = (Math.sin(x * 0.27) * Math.cos(z * 0.21) * 0.45 + Math.sin(x * 0.07 + 1.3) * Math.cos(z * 0.06) * 1.6) * k;
    // Dos capas por pino
    for (const [dy, sc] of [[0, 1], [s * 1.1, 0.72]]) {
      d.position.set(x, y + dy - 0.3, z);
      d.scale.set(s * sc, s * 1.25 * sc, s * sc);
      d.rotation.y = rand() * Math.PI;
      d.updateMatrix();
      forest.setMatrixAt(n++, d.matrix);
    }
  }
  scene.add(forest);
}

/* --- Árbol principal ------------------------------------------------ */
const treeLayers = [];   // { yb, yt, r }
function treeSurfaceRadius(y) {
  let best = 0;
  for (const L of treeLayers) {
    if (y >= L.yb && y <= L.yt) best = Math.max(best, (L.r * (L.yt - y)) / (L.yt - L.yb));
  }
  return best;
}

function buildTree() {
  const tree = new THREE.Group();
  scene.add(tree);

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 1.4, 14),
    new THREE.MeshStandardMaterial({ color: 0x3a3350, roughness: 0.9 }));
  trunk.position.y = 0.7;
  trunk.castShadow = true;
  tree.add(trunk);

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.62, metalness: 0.08, flatShading: true, envMapIntensity: 0.6,
  });
  const layers = 7;
  for (let i = 0; i < layers; i++) {
    const k = i / (layers - 1);
    const r = THREE.MathUtils.lerp(2.55, 0.62, k);
    const h = THREE.MathUtils.lerp(1.7, 1.15, k);
    const yb = 1.05 + i * 0.68;
    const geo = pineLayerGeometry(r, h, 30, 0x0b2a4a, 0xb4d4f4, 0.2);
    const m = new THREE.Mesh(geo, mat);
    m.position.y = yb + h / 2;
    m.rotation.y = i * 0.37;
    m.castShadow = true;
    m.receiveShadow = true;
    tree.add(m);
    treeLayers.push({ yb, yt: yb + h, r, i });
  }
  const topY = treeLayers[treeLayers.length - 1].yt;

  // Guirnalda plateada en espiral
  const pts = [];
  const turns = 4.2;
  for (let i = 0; i <= 220; i++) {
    const t = i / 220;
    const y = 1.25 + t * (topY - 1.6);
    const a = t * turns * Math.PI * 2;
    const r = treeSurfaceRadius(y) * 0.92 + 0.06;
    pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
  }
  const garland = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 600, 0.028, 6),
    new THREE.MeshStandardMaterial({ color: 0xe8eeff, metalness: 1, roughness: 0.18, emissive: 0x3a4a7a, emissiveIntensity: 0.4 }),
  );
  tree.add(garland);

  // Adornos: bolas metálicas en las puntas de las ramas
  const ornColors = [0xe6ecf8, 0x9fd3ff, 0xc7b8ff, 0x3f6fc4, 0x7fe8ff];
  const ornGeo = new THREE.SphereGeometry(0.13, 20, 14);
  const ornMat = new THREE.MeshStandardMaterial({ metalness: 0.95, roughness: 0.12, envMapIntensity: 1.4 });
  const ornPositions = [];
  treeLayers.forEach((L, li) => {
    const n = Math.round(4 + L.r * 3);
    for (let j = 0; j < n; j++) {
      const a = (j / n) * Math.PI * 2 + li * 0.9;
      const y = L.yb + 0.02;
      const r = L.r * 0.86;
      ornPositions.push(new THREE.Vector3(Math.cos(a) * r, y - 0.08, Math.sin(a) * r));
    }
  });
  const orns = new THREE.InstancedMesh(ornGeo, ornMat, ornPositions.length);
  const d = new THREE.Object3D();
  ornPositions.forEach((p, i) => {
    d.position.copy(p);
    d.scale.setScalar(0.8 + ((i * 37) % 10) / 20);
    d.updateMatrix();
    orns.setMatrixAt(i, d.matrix);
    orns.setColorAt(i, new THREE.Color(ornColors[i % ornColors.length]));
  });
  orns.castShadow = true;
  tree.add(orns);

  // Lucecitas parpadeantes (InstancedMesh + colores animados)
  const lightCount = IS_MOBILE ? 90 : 150;
  const lightColors = [new THREE.Color(0x7fe8ff), new THREE.Color(0xc7b8ff), new THREE.Color(0xffffff), new THREE.Color(0xa8c8ff)];
  const lights = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshBasicMaterial(), lightCount);
  const lightData = [];
  for (let i = 0; i < lightCount; i++) {
    const t = i / lightCount;
    const y = 1.2 + t * (topY - 1.4);
    const a = t * 9.5 * Math.PI * 2 + Math.sin(i) * 0.3;
    const r = treeSurfaceRadius(y) * 0.97 + 0.03;
    d.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    d.scale.setScalar(1);
    d.updateMatrix();
    lights.setMatrixAt(i, d.matrix);
    lightData.push({ color: lightColors[i % lightColors.length], phase: Math.random() * Math.PI * 2, speed: 1 + Math.random() * 2.5 });
    lights.setColorAt(i, lightData[i].color);
  }
  tree.add(lights);
  const tmp = new THREE.Color();
  animated.push((dt, t) => {
    for (let i = 0; i < lightCount; i++) {
      const L = lightData[i];
      const k = 0.35 + Math.pow(0.5 + 0.5 * Math.sin(t * L.speed + L.phase), 2) * 2.6;
      tmp.copy(L.color).multiplyScalar(k);
      lights.setColorAt(i, tmp);
    }
    lights.instanceColor.needsUpdate = true;
  });

  // Luces que iluminan los regalos (frías, cian y lavanda)
  const l1 = new THREE.PointLight(0x7fe8ff, 9, 12, 1.8);
  l1.position.set(3, 2.2, 3);
  const l2 = new THREE.PointLight(0xc7b8ff, 8, 12, 1.8);
  l2.position.set(-3, 1.8, -2.5);
  const l3 = new THREE.PointLight(0xa8d4ff, 6, 10, 1.8);
  l3.position.set(-2.5, 2.4, 3.2);
  tree.add(l1, l2, l3);
  animated.push((dt, t) => {
    l1.intensity = 8 + Math.sin(t * 1.3) * 2;
    l2.intensity = 7 + Math.sin(t * 1.1 + 2) * 2;
  });

  // Estrella en la punta, con halo y luz propia
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 0.48 : 0.2;
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  shape.closePath();
  const starGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 3 });
  starGeo.center();
  const star = new THREE.Mesh(starGeo, new THREE.MeshStandardMaterial({
    color: 0xfff6dc, emissive: 0xfff0c8, emissiveIntensity: 1.6, metalness: 0.6, roughness: 0.25,
  }));
  star.position.y = topY + 0.38;
  tree.add(star);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture, color: 0xfff2d0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  }));
  halo.scale.setScalar(3.2);
  halo.position.copy(star.position);
  tree.add(halo);
  const starLight = new THREE.PointLight(0xfff0d0, 6, 9, 1.8);
  starLight.position.copy(star.position);
  tree.add(starLight);
  animated.push((dt, t) => {
    star.rotation.y = t * 0.6;
    const s = 2.2 + Math.sin(t * 2) * 0.25;
    halo.scale.setScalar(s);
    starLight.intensity = 5 + Math.sin(t * 2) * 1.5;
  });
}

/* --- Nieve que cae (partículas animadas en la GPU) ----------------- */
function buildSnow() {
  const count = IS_MOBILE ? 1400 : 4200;
  const area = 46;
  const height = 24;
  const pos = new Float32Array(count * 3);
  const speed = new Float32Array(count);
  const phase = new Float32Array(count);
  const scale = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * area;
    pos[i * 3 + 1] = Math.random() * height;
    pos[i * 3 + 2] = (Math.random() - 0.5) * area;
    speed[i] = 0.5 + Math.random() * 0.9;
    phase[i] = Math.random() * Math.PI * 2;
    scale[i] = 0.5 + Math.random() * 1.1;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  geo.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uHeight: { value: height },
      uPR: { value: PIXEL_RATIO },
    },
    vertexShader: /* glsl */ `
      attribute float aSpeed;
      attribute float aPhase;
      attribute float aScale;
      uniform float uTime;
      uniform float uHeight;
      uniform float uPR;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        p.y = mod(p.y - uTime * aSpeed, uHeight) - 0.5;
        p.x += sin(uTime * 0.6 + aPhase) * 0.35 + sin(uTime * 0.21 + aPhase * 2.0) * 0.6;
        p.z += cos(uTime * 0.5 + aPhase * 1.3) * 0.35;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float depth = -mv.z;
        gl_PointSize = clamp(aScale * uPR * (34.0 / depth), 1.0, 26.0);
        vAlpha = smoothstep(-0.5, 0.6, p.y) * (1.0 - smoothstep(uHeight - 4.0, uHeight - 0.5, p.y));
        vAlpha *= exp(-depth * 0.018);
      }`,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.1, d) * vAlpha * 0.9;
        gl_FragColor = vec4(vec3(0.93, 0.97, 1.0) * 1.15, a);
      }`,
  });
  const snow = new THREE.Points(geo, mat);
  snow.frustumCulled = false;
  scene.add(snow);
  animated.push((dt, t) => { mat.uniforms.uTime.value = t; });
}

/* =====================================================================
   3. REGALOS 3D
   ===================================================================== */
const gifts = [];          // objetos de regalo (ver createGift)
const pickables = [];      // mallas que detecta el Raycaster

const GIFT_PALETTE = [
  { base: '#1f3a7a', ribbon: '#e3e9f5' },
  { base: '#9fd3ff', ribbon: '#2a4c9a' },
  { base: '#b9a8ff', ribbon: '#ffffff' },
  { base: '#eef3ff', ribbon: '#4cc8e8' },
  { base: '#2f7a9a', ribbon: '#d9cdff' },
  { base: '#c9d3e6', ribbon: '#3f6fc4' },
  { base: '#5b4fb0', ribbon: '#bfe6ff' },
  { base: '#5ec9e6', ribbon: '#f7fbff' },
  { base: '#2a2f6e', ribbon: '#c7b8ff' },
];

/* Dibuja la cara de un regalo: color base, motivo de copos, cintas
   verticales y una medalla con el número bien legible. */
function drawGiftFace(ctx, W, H, { base, ribbon, number, repeats = 1, medal = true, seed = 1 }) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
  // Motivo sutil de puntitos/copos
  const rand = seeded(seed * 97 + 13);
  ctx.fillStyle = 'rgba(255,255,255,.16)';
  for (let i = 0; i < (W * H) / 900; i++) {
    const x = rand() * W, y = rand() * H, r = 1.5 + rand() * 3;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const segW = W / repeats;
  for (let k = 0; k < repeats; k++) {
    const cx = segW * (k + 0.5);
    // Cinta vertical con brillo
    const rw = Math.min(segW, H) * 0.16;
    ctx.fillStyle = ribbon;
    ctx.fillRect(cx - rw / 2, 0, rw, H);
    ctx.fillStyle = 'rgba(255,255,255,.25)';
    ctx.fillRect(cx - rw / 2 + rw * 0.15, 0, rw * 0.15, H);
    if (!medal) continue;
    // Medalla con número
    const rad = Math.min(segW, H) * 0.3;
    const cy = H / 2;
    ctx.fillStyle = 'rgba(8,16,40,.35)';
    ctx.beginPath();
    ctx.arc(cx + rad * 0.06, cy + rad * 0.08, rad * 1.04, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f7fbff';
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = rad * 0.12;
    ctx.strokeStyle = ribbon === '#ffffff' || ribbon === '#f7fbff' ? '#8f7fd6' : ribbon;
    ctx.stroke();
    ctx.lineWidth = rad * 0.035;
    ctx.strokeStyle = '#9fb3d9';
    ctx.beginPath();
    ctx.arc(cx, cy, rad * 0.8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#13224a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${Math.round(rad * (number >= 10 ? 1.0 : 1.2))}px Quicksand, "Trebuchet MS", sans-serif`;
    ctx.fillText(String(number), cx, cy + rad * 0.06);
  }
}

function canvasTex(W, H, draw) {
  const c = document.createElement('canvas');
  c.width = Math.round(W);
  c.height = Math.max(32, Math.round(H));
  draw(c.getContext('2d'), c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return t;
}

/* Textura de la tapa vista desde arriba (cruz de cintas + número). */
function lidTopTexture(pal, number, round) {
  return canvasTex(256, 256, (ctx, W, H) => {
    ctx.fillStyle = pal.base;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = pal.ribbon;
    const rw = W * 0.14;
    ctx.fillRect(W / 2 - rw / 2, 0, rw, H);
    if (!round) ctx.fillRect(0, H / 2 - rw / 2, W, rw);
    else ctx.fillRect(0, H / 2 - rw / 2, W, rw);
    ctx.fillStyle = 'rgba(255,255,255,.22)';
    ctx.fillRect(W / 2 - rw / 2 + rw * 0.15, 0, rw * 0.15, H);
    // Número pequeño en una esquina para verlo desde arriba
    ctx.fillStyle = '#f7fbff';
    ctx.beginPath();
    ctx.arc(W * 0.25, H * 0.25, W * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#13224a';
    ctx.font = `700 ${W * 0.13}px Quicksand, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(number), W * 0.25, H * 0.26);
  });
}

/* Material de regalo con mapa emisivo (para el brillo al pasar el ratón). */
function giftMaterial(map, extra = {}) {
  return new THREE.MeshStandardMaterial({
    map, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: 0,
    roughness: 0.5, metalness: 0.08, envMapIntensity: 0.6, ...extra,
  });
}

/* Lazo 3D: dos bucles, nudo y dos colas. */
function buildBow(color, size) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.35, transparent: true });
  const parts = [];
  for (const s of [-1, 1]) {
    const loop = new THREE.Mesh(new THREE.TorusGeometry(size * 0.32, size * 0.09, 10, 26), mat);
    loop.position.set(s * size * 0.3, size * 0.16, 0);
    loop.scale.set(1, 0.62, 0.8);
    loop.rotation.set(0, s * 0.35, s * 0.55);
    loop.userData.dir = new THREE.Vector3(s, 0.6, 0);
    g.add(loop);
    parts.push(loop);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(size * 0.16, size * 0.02, size * 0.55), mat);
    tail.position.set(s * size * 0.12, size * 0.02, size * 0.25);
    tail.rotation.y = s * 0.5;
    tail.userData.dir = new THREE.Vector3(s * 0.5, 0.2, 1);
    g.add(tail);
    parts.push(tail);
  }
  const knot = new THREE.Mesh(new THREE.SphereGeometry(size * 0.13, 14, 10), mat);
  knot.position.y = size * 0.1;
  knot.scale.set(1, 0.8, 1);
  knot.userData.dir = new THREE.Vector3(0, 1, 0);
  g.add(knot);
  parts.push(knot);
  g.userData.parts = parts;
  g.userData.mat = mat;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/* Sprite de candado escarchado (compartido por todos los regalos bloqueados). */
const lockMaterial = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 70, 0, 64, 70, 64);
  g.addColorStop(0, 'rgba(160,220,255,.55)');
  g.addColorStop(1, 'rgba(160,220,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#dfe9f8';
  ctx.beginPath();
  ctx.arc(64, 54, 20, Math.PI, 0);
  ctx.lineTo(84, 66);
  ctx.moveTo(44, 54);
  ctx.lineTo(44, 66);
  ctx.stroke();
  const body = ctx.createLinearGradient(0, 62, 0, 104);
  body.addColorStop(0, '#f4f8ff');
  body.addColorStop(1, '#9fb3d9');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(34, 62, 60, 44, 9) : ctx.rect(34, 62, 60, 44);
  ctx.fill();
  ctx.fillStyle = '#1d2f5e';
  ctx.beginPath();
  ctx.arc(64, 80, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(61, 82, 6, 12);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0.9 });
})();

const LOCKED_TINT = new THREE.Color(0x6d7b9c);
const WHITE = new THREE.Color(0xffffff);

/* Crea un regalo para el día "day". */
function createGift(day, position, rand) {
  const pal = GIFT_PALETTE[(day * 5) % GIFT_PALETTE.length];
  const kindRoll = (day * 7) % 10;
  const kind = kindRoll < 2 ? 'round' : kindRoll < 4 ? 'tall' : kindRoll < 6 ? 'flat' : 'box';
  let w, h;
  if (kind === 'tall') { w = 0.55 + rand() * 0.12; h = 0.85 + rand() * 0.2; }
  else if (kind === 'flat') { w = 0.85 + rand() * 0.12; h = 0.42 + rand() * 0.1; }
  else if (kind === 'round') { w = 0.68 + rand() * 0.14; h = 0.6 + rand() * 0.2; }
  else { w = 0.66 + rand() * 0.2; h = 0.6 + rand() * 0.2; }
  const lidH = Math.max(0.12, h * 0.2);
  const baseH = h - lidH * 0.6;

  const group = new THREE.Group();
  group.position.copy(position);
  group.rotation.y = rand() * Math.PI * 2;
  group.scale.setScalar(1.15);
  const body = new THREE.Group();
  group.add(body);

  const invisible = new THREE.MeshBasicMaterial({ visible: false });
  const innerMat = new THREE.MeshStandardMaterial({ color: 0x0e1838, roughness: 0.9, side: THREE.BackSide });
  let base, inner, lid, sideMat, lidSideMat, lidTopMat;

  if (kind === 'round') {
    const r = w / 2;
    const circ = 2 * Math.PI * r;
    const sideTex = canvasTex(768, (768 * baseH) / circ, (ctx, W, H) =>
      drawGiftFace(ctx, W, H, { ...pal, number: day, repeats: 3, seed: day }));
    sideMat = giftMaterial(sideTex);
    base = new THREE.Mesh(new THREE.CylinderGeometry(r, r, baseH, 40), [sideMat, invisible, giftMaterial(null, { color: pal.base })]);
    inner = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.95, r * 0.95, baseH * 0.98, 32, 1, true), innerMat);
    const lidSideTex = canvasTex(768, (768 * lidH) / (circ * 1.06), (ctx, W, H) =>
      drawGiftFace(ctx, W, H, { base: pal.base, ribbon: pal.ribbon, number: day, repeats: 3, medal: false, seed: day + 50 }));
    lidSideMat = giftMaterial(lidSideTex);
    lidTopMat = giftMaterial(lidTopTexture(pal, day, true));
    lid = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.06, r * 1.06, lidH, 40), [lidSideMat, lidTopMat, lidSideMat]);
  } else {
    const sideTex = canvasTex(256, (256 * baseH) / w, (ctx, W, H) =>
      drawGiftFace(ctx, W, H, { ...pal, number: day, seed: day }));
    sideMat = giftMaterial(sideTex);
    const bottom = giftMaterial(null, { color: pal.base });
    base = new THREE.Mesh(new THREE.BoxGeometry(w, baseH, w), [sideMat, sideMat, invisible, bottom, sideMat, sideMat]);
    inner = new THREE.Mesh(new THREE.BoxGeometry(w * 0.95, baseH * 0.98, w * 0.95),
      [innerMat, innerMat, invisible, innerMat, innerMat, innerMat]);
    const lidSideTex = canvasTex(256, (256 * lidH) / (w * 1.06), (ctx, W, H) =>
      drawGiftFace(ctx, W, H, { base: pal.base, ribbon: pal.ribbon, number: day, medal: false, seed: day + 50 }));
    lidSideMat = giftMaterial(lidSideTex);
    lidTopMat = giftMaterial(lidTopTexture(pal, day, false));
    lid = new THREE.Mesh(new THREE.BoxGeometry(w * 1.06, lidH, w * 1.06),
      [lidSideMat, lidSideMat, lidTopMat, lidSideMat, lidSideMat, lidSideMat]);
  }
  base.position.y = baseH / 2;
  inner.position.y = baseH / 2 + 0.005;
  base.castShadow = true;
  base.receiveShadow = true;
  body.add(base, inner);

  const lidPivot = new THREE.Group();
  lidPivot.position.y = baseH - lidH * 0.4;
  lid.position.y = lidH / 2;
  lid.castShadow = true;
  lidPivot.add(lid);
  const bowObj = buildBow(pal.ribbon, w * 0.55);
  bowObj.position.y = lidH;
  lidPivot.add(bowObj);
  body.add(lidPivot);

  // Brillo interior (visible cuando está abierto)
  const innerGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture, color: 0x6fb8e0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0,
  }));
  innerGlow.scale.setScalar(w * 1.25);
  innerGlow.position.y = baseH * 0.9;
  body.add(innerGlow);

  // Candado flotante (visible cuando está bloqueado)
  const lock = new THREE.Sprite(lockMaterial);
  lock.scale.setScalar(0.36);
  lock.position.y = baseH + lidH + w * 0.3 + 0.32;
  body.add(lock);

  scene.add(group);

  const gift = {
    day, kind, w, h, baseH, lidH, group, body, base, lid, lidPivot, bow: bowObj, innerGlow, lock,
    materials: [sideMat, lidSideMat, lidTopMat],
    state: 'locked',      // 'locked' | 'unlocked' | 'opened'
    hover: 0,              // 0-1 suavizado
    hoverTarget: 0,
    busy: false,
    closedLid: { y: lidPivot.position.y },
    phase: rand() * Math.PI * 2,
  };
  for (const m of [base, lid, ...bowObj.children]) {
    m.userData.gift = gift;
    pickables.push(m);
  }
  gifts.push(gift);
  return gift;
}

/* Pose del regalo abierto: la tapa apoyada de canto a un lado. */
function openedLidPose(g) {
  const half = g.kind === 'round' ? (g.w / 2) * 1.06 : (g.w * 1.06) / 2;
  return {
    pos: new THREE.Vector3(g.w / 2 + 0.03, half, 0.05),
    rot: new THREE.Euler(0.12, 0.25, -Math.PI / 2 + 0.06),
  };
}

function setGiftOpenedInstant(g) {
  const pose = openedLidPose(g);
  g.lidPivot.position.copy(pose.pos);
  g.lidPivot.rotation.copy(pose.rot);
  g.bow.visible = false;
  g.innerGlow.material.opacity = 0.3;
}

function setGiftClosedInstant(g) {
  g.lidPivot.position.set(0, g.closedLid.y, 0);
  g.lidPivot.rotation.set(0, 0, 0);
  g.bow.visible = true;
  g.bow.scale.setScalar(1);
  g.bow.userData.parts.forEach((p) => {
    if (p.userData.home) { p.position.copy(p.userData.home); p.scale.copy(p.userData.homeScale); }
  });
  g.bow.userData.mat.opacity = 1;
  g.innerGlow.material.opacity = 0;
}

/* Aplica el aspecto según el estado (bloqueado, disponible, abierto). */
function refreshGiftStates() {
  for (const g of gifts) {
    if (g.busy) continue;
    const prev = g.state;
    g.state = openedDays.has(g.day) ? 'opened' : isUnlocked(g.day) ? 'unlocked' : 'locked';
    const locked = g.state === 'locked';
    g.materials.forEach((m) => m.color.copy(locked ? LOCKED_TINT : WHITE));
    g.bow.userData.mat.color.set(locked ? 0x8090b0 : g.bow.userData.mat.userData.orig || g.bow.userData.mat.color);
    g.lock.visible = locked;
    if (g.state === 'opened' && prev !== 'opened') setGiftOpenedInstant(g);
    if (g.state !== 'opened' && prev === 'opened') setGiftClosedInstant(g);
  }
  updateHud();
}

function buildGifts() {
  const rand = seeded(2024);
  // Orden de días mezclado para que buscar el regalo sea parte de la magia
  const days = Array.from({ length: 24 }, (_, i) => i + 1);
  for (let i = days.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [days[i], days[j]] = [days[j], days[i]];
  }
  const rings = [
    { n: 10, r: 2.75, jitter: 0.18, offset: 0.2 },
    { n: 14, r: 4.3, jitter: 0.3, offset: 0.0 },
  ];
  let k = 0;
  for (const ring of rings) {
    for (let i = 0; i < ring.n; i++) {
      const a = (i / ring.n) * Math.PI * 2 + ring.offset + (rand() - 0.5) * 0.12;
      const r = ring.r + (rand() - 0.5) * ring.jitter;
      createGift(days[k++], new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r), rand);
    }
  }
  // Guarda la pose original de las piezas del lazo y su color
  for (const g of gifts) {
    g.bow.userData.mat.userData.orig = g.bow.userData.mat.color.clone();
    g.bow.userData.parts.forEach((p) => {
      p.userData.home = p.position.clone();
      p.userData.homeScale = p.scale.clone();
    });
  }
  refreshGiftStates();

  // Animación continua: elevación/brillo al pasar el ratón, candados y brillos interiores
  animated.push((dt, t) => {
    for (const g of gifts) {
      const target = g.state === 'locked' ? 0 : g.hoverTarget;
      g.hover += (target - g.hover) * Math.min(1, dt * 9);
      if (!g.busy) g.body.position.y = g.hover * 0.16;
      const glowK = g.hover * 0.32;
      g.materials.forEach((m) => { m.emissiveIntensity = glowK; });
      if (g.lock.visible) g.lock.position.y = g.baseH + g.lidH + g.w * 0.3 + 0.32 + Math.sin(t * 1.6 + g.phase) * 0.05;
      if (g.state === 'opened' && !g.busy) g.innerGlow.material.opacity = 0.3 + Math.sin(t * 2 + g.phase) * 0.1;
    }
  });
}

/* --- Partículas de destellos al abrir -------------------------------- */
function burstAt(worldPos) {
  const count = IS_MOBILE ? 90 : 180;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const vel = [];
  const palette = [new THREE.Color(0x9fefff), new THREE.Color(0xd4c8ff), new THREE.Color(0xffffff), new THREE.Color(0xfff0c8)];
  for (let i = 0; i < count; i++) {
    pos[i * 3] = worldPos.x; pos[i * 3 + 1] = worldPos.y; pos[i * 3 + 2] = worldPos.z;
    const a = Math.random() * Math.PI * 2;
    const up = 1.5 + Math.random() * 3.2;
    const out = 0.4 + Math.random() * 1.6;
    vel.push(new THREE.Vector3(Math.cos(a) * out, up, Math.sin(a) * out));
    const c = palette[i % palette.length];
    col[i * 3] = c.r * 2; col[i * 3 + 1] = c.g * 2; col[i * 3 + 2] = c.b * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.16, map: sparkTexture, vertexColors: true, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, sizeAttenuation: true,
  });
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);

  const flash = new THREE.PointLight(0xbfefff, 0, 8, 1.6);
  flash.position.copy(worldPos);
  scene.add(flash);

  const life = 2.0;
  let lastT = 0;
  tween({
    duration: life,
    easing: ease.linear,
    update: (k, t) => {
      const dt = (t - lastT) * life;
      lastT = t;
      for (let i = 0; i < count; i++) {
        const v = vel[i];
        v.y -= 2.6 * dt;
        v.multiplyScalar(0.985);
        pos[i * 3] += v.x * dt;
        pos[i * 3 + 1] += v.y * dt;
        pos[i * 3 + 2] += v.z * dt;
      }
      geo.attributes.position.needsUpdate = true;
      mat.opacity = 1 - Math.pow(t, 2);
      mat.size = 0.16 * (1 - t * 0.5);
      flash.intensity = 14 * Math.max(0, 1 - t * 2.2);
    },
  }).then(() => {
    scene.remove(pts, flash);
    geo.dispose();
    mat.dispose();
    flash.dispose();
  });
}

/* --- Movimiento de cámara para enfocar un regalo -------------------- */
let autoRotateTimer = null;
function pauseAutoRotate(resumeAfter = 6) {
  controls.autoRotate = false;
  clearTimeout(autoRotateTimer);
  if (resumeAfter > 0) {
    autoRotateTimer = setTimeout(() => { if (!modalOpen) controls.autoRotate = true; }, resumeAfter * 1000);
  }
}

function moveCamera(toPos, toTarget, duration = 1.4) {
  const fromPos = camera.position.clone();
  const fromTarget = controls.target.clone();
  const d = REDUCED_MOTION ? 0.01 : duration;
  return tween({
    duration: d,
    easing: ease.inOutCubic,
    update: (k) => {
      camera.position.lerpVectors(fromPos, toPos, k);
      controls.target.lerpVectors(fromTarget, toTarget, k);
    },
  });
}

function focusGift(g, duration = 1.3) {
  const p = g.group.position;
  const dir = new THREE.Vector3(p.x, 0, p.z).normalize();
  if (dir.lengthSq() === 0) dir.set(0, 0, 1);
  const aspect = window.innerWidth / window.innerHeight;
  const dist = aspect < 0.75 ? 5.6 : 4.4;
  const camPos = p.clone().add(dir.multiplyScalar(dist)).add(new THREE.Vector3(0, 2.1, 0));
  const target = p.clone().add(new THREE.Vector3(0, 0.55, 0));
  return moveCamera(camPos, target, duration);
}

/* --- Apertura del regalo --------------------------------------------- */
async function openGift(g) {
  if (g.busy) return;
  g.busy = true;
  pauseAutoRotate(0);
  audio.playOpen();
  const focus = focusGift(g, 1.1);

  // 1) Anticipación: el regalo se encoge y vibra un instante
  await tween({
    duration: 0.38,
    easing: ease.linear,
    update: (k, t) => {
      const s = 1 - Math.sin(t * Math.PI) * 0.08;
      g.body.scale.set(1 + (1 - s) * 0.6, s, 1 + (1 - s) * 0.6);
      g.body.rotation.z = Math.sin(t * Math.PI * 8) * 0.03 * (1 - t);
    },
  });
  g.body.scale.set(1, 1, 1);
  g.body.rotation.z = 0;

  // 2) La tapa salta, el lazo se deshace y salen destellos
  const top = new THREE.Vector3(0, g.baseH + g.lidH, 0);
  g.body.localToWorld(top);
  burstAt(top);

  const startPos = g.lidPivot.position.clone();
  const startRot = g.lidPivot.rotation.clone();
  const pose = openedLidPose(g);
  const parts = g.bow.userData.parts;
  const bowMat = g.bow.userData.mat;
  tween({
    duration: 1.1,
    easing: ease.outCubic,
    update: (k, t) => {
      for (const p of parts) {
        const dir = p.userData.dir;
        p.position.copy(p.userData.home).addScaledVector(dir, k * 0.6);
        p.scale.copy(p.userData.homeScale).multiplyScalar(1 - k * 0.9);
        p.rotation.x += 0.08 * dir.x;
      }
      bowMat.opacity = 1 - k;
    },
  }).then(() => { g.bow.visible = false; });

  await tween({
    duration: 1.25,
    easing: ease.linear,
    update: (k, t) => {
      const e = ease.inOutSine(t);
      g.lidPivot.position.lerpVectors(startPos, pose.pos, e);
      g.lidPivot.position.y += Math.sin(Math.PI * Math.min(1, t * 1.05)) * 1.3;
      g.lidPivot.rotation.set(
        THREE.MathUtils.lerp(startRot.x, pose.rot.x, e),
        THREE.MathUtils.lerp(startRot.y, pose.rot.y, e) + Math.sin(t * Math.PI) * 1.2,
        THREE.MathUtils.lerp(startRot.z, pose.rot.z, e),
      );
      g.innerGlow.material.opacity = Math.min(1, t * 2) * 0.5;
    },
  });
  g.lidPivot.position.copy(pose.pos);
  g.lidPivot.rotation.copy(pose.rot);
  await focus;

  openedDays.add(g.day);
  saveOpened();
  g.busy = false;
  g.state = 'opened';
  refreshGiftStates();
  openModal(g.day);
}

/* --- Regalo bloqueado: temblor + mensaje amable --------------------- */
function shakeGift(g) {
  audio.playLocked();
  const n = daysUntil(g.day);
  showToast(n === 1 ? '¡Aún no! Falta 1 día ❄' : `¡Aún no! Faltan ${n} días ❄`);
  if (g.busy) return;
  g.busy = true;
  tween({
    duration: 0.55,
    easing: ease.linear,
    update: (k, t) => {
      const amp = (1 - t) * 0.14;
      g.body.rotation.z = Math.sin(t * Math.PI * 7) * amp;
      g.body.rotation.x = Math.sin(t * Math.PI * 5) * amp * 0.4;
      g.lock.scale.setScalar(0.36 * (1 + Math.sin(t * Math.PI) * 0.35));
    },
  }).then(() => {
    g.body.rotation.set(0, 0, 0);
    g.lock.scale.setScalar(0.36);
    g.busy = false;
  });
}

/* =====================================================================
   4. INTERACCIÓN (Raycaster)
   ===================================================================== */
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let hovered = null;
let downInfo = null;
let interactive = false;   // true tras pulsar "Entrar"

function pickGift(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(pickables, false).find((h) => h.object.visible !== false);
  return hit ? hit.object.userData.gift : null;
}

function setHovered(g) {
  if (hovered === g) return;
  if (hovered) hovered.hoverTarget = 0;
  hovered = g;
  if (g) {
    g.hoverTarget = 1;
    if (g.state !== 'locked') audio.playHover();
  }
  canvas.style.cursor = g ? (g.state === 'locked' ? 'not-allowed' : 'pointer') : 'grab';
}

function onPointerMove(e) {
  if (!interactive || modalOpen || e.pointerType !== 'mouse') return;
  setHovered(pickGift(e.clientX, e.clientY));
}

function onPointerDown(e) {
  if (!interactive || modalOpen) return;
  downInfo = { x: e.clientX, y: e.clientY, time: performance.now() };
  pauseAutoRotate(6);
}

function onPointerUp(e) {
  if (!interactive || modalOpen || !downInfo) return;
  const moved = Math.hypot(e.clientX - downInfo.x, e.clientY - downInfo.y);
  const quick = performance.now() - downInfo.time < 600;
  downInfo = null;
  if (moved > 8 || !quick) return; // fue un arrastre de cámara, no un toque
  const g = pickGift(e.clientX, e.clientY);
  if (!g) return;
  if (e.pointerType !== 'mouse') {
    // En táctil: breve brillo/elevación antes de actuar
    g.hoverTarget = 1;
    setTimeout(() => { if (hovered !== g) g.hoverTarget = 0; }, 450);
    if (g.state !== 'locked') audio.playHover();
  }
  activateGift(g);
}

function activateGift(g) {
  if (g.busy) return;
  if (g.state === 'locked') shakeGift(g);
  else if (g.state === 'opened') {
    audio.playClick();
    pauseAutoRotate(0);
    focusGift(g, 0.9).then(() => openModal(g.day));
  } else openGift(g);
}

/* =====================================================================
   5. MODAL DEL DÍA + MINI VISOR 3D
   ===================================================================== */
const modal = $('#modal');
let modalOpen = false;
let miniViewer = null;
let lastFocus = null;

function dayData(day) {
  return CONFIG.days.find((d) => Number(d.day) === day) || { day, title: `Día ${day}`, message: '', photo: '' };
}

function openModal(day) {
  const data = dayData(day);
  modalOpen = true;
  lastFocus = document.activeElement;
  setHovered(null);

  $('#modalDay').textContent = `Día ${day}`;
  $('#modalTitle').textContent = data.title || `Día ${day}`;
  $('#modalMessage').textContent = data.message || '';

  // Ilustración SVG del día
  $('#modalIllustration').innerHTML = getIllustration(day);
  $('#illusCaption').textContent = ILLUSTRATION_NAMES[day] || '';
  $('#objCaption').textContent = OBJECT_NAMES[day] || '';

  // Foto: primero el marcador; si la imagen carga, se sustituye
  const slot = $('#photoSlot');
  slot.innerHTML = photoPlaceholder(day, data.photo || '');
  slot.classList.add('is-placeholder');
  if (data.photo) {
    const img = new Image();
    img.alt = `Foto del día ${day}`;
    img.decoding = 'async';
    img.onload = () => {
      if (!modalOpen || $('#modalDay').textContent !== `Día ${day}`) return;
      slot.innerHTML = '';
      slot.appendChild(img);
      slot.classList.remove('is-placeholder');
    };
    img.onerror = () => { /* se queda el marcador bonito */ };
    img.src = data.photo;
  }

  modal.hidden = false;
  requestAnimationFrame(() => modal.classList.add('open'));
  $('#modalCloseX').focus({ preventScroll: true });
  $('.modal-card').scrollTop = 0;

  // Mini visor 3D (canvas nuevo cada vez; se libera al cerrar)
  const holder = $('#objHolder');
  holder.innerHTML = '';
  const c = document.createElement('canvas');
  c.className = 'obj-canvas';
  c.setAttribute('aria-label', `Objeto 3D: ${OBJECT_NAMES[day] || ''}`);
  holder.appendChild(c);
  try {
    miniViewer = createMiniViewer(c, day);
  } catch (err) {
    console.warn('No se pudo crear el visor 3D del día', err);
    holder.innerHTML = '<p class="obj-fallback">✦</p>';
  }

  if (IS_MOBILE) setTimeout(() => { if (modalOpen) sceneActive = false; }, 450);
}

function closeModal() {
  if (!modalOpen) return;
  modalOpen = false;
  sceneActive = true;
  audio.playClick();
  modal.classList.remove('open');
  setTimeout(() => {
    if (!modalOpen) {
      modal.hidden = true;
      $('#modalIllustration').innerHTML = '';
    }
  }, 420);
  if (miniViewer) {
    miniViewer.dispose();
    miniViewer = null;
  }
  $('#objHolder').innerHTML = '';
  const home = cameraHome();
  // Vuelve suavemente a la vista general
  const curDir = camera.position.clone().sub(controls.target).setY(0).normalize();
  const back = home.target.clone().add(curDir.multiplyScalar(home.dist)).setY(home.pos.y);
  moveCamera(back, home.target, 1.6).then(() => pauseAutoRotate(3));
  if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
}

/* Visor 3D del objeto del día dentro del modal. */
function createMiniViewer(cnv, day) {
  const r = new THREE.WebGLRenderer({ canvas: cnv, antialias: true, alpha: true, powerPreference: 'low-power' });
  r.setPixelRatio(PIXEL_RATIO);
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.15;
  const sc = new THREE.Scene();
  const envRT = createEnvironment(r);
  sc.environment = envRT.texture;
  const cam = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
  cam.position.set(0, 0.5, 5.4);
  cam.lookAt(0, 0, 0);

  sc.add(new THREE.HemisphereLight(0xcfe0ff, 0x1a2450, 1.2));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(2, 3, 4);
  const rim1 = new THREE.PointLight(0x7fe8ff, 14, 10, 1.6);
  rim1.position.set(-3, 1, -1.5);
  const rim2 = new THREE.PointLight(0xc7b8ff, 12, 10, 1.6);
  rim2.position.set(3, -1, -1.5);
  sc.add(key, rim1, rim2);

  const obj = createDayObject(day);
  const spinner = new THREE.Group();
  spinner.add(obj);
  sc.add(spinner);

  // Destellos que orbitan alrededor
  const N = 40;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2;
    const rr = 1.35 + Math.random() * 0.5;
    pos[i * 3] = Math.cos(a) * rr;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 2;
    pos[i * 3 + 2] = Math.sin(a) * rr;
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const sm = new THREE.PointsMaterial({ size: 0.12, map: sparkTexture, color: 0xcfefff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const sparkles = new THREE.Points(sg, sm);
  sc.add(sparkles);

  // Ajuste de tamaño al contenedor
  const resize = () => {
    const w = cnv.clientWidth || 200;
    const h = cnv.clientHeight || 200;
    r.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(cnv);
  resize();

  // Arrastrar para girar el objeto
  let drag = null;
  let velocity = 0.6;
  const onDown = (e) => { drag = { x: e.clientX }; cnv.setPointerCapture(e.pointerId); };
  const onMove = (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    drag.x = e.clientX;
    spinner.rotation.y += dx * 0.012;
    velocity = dx * 0.6;
  };
  const onUp = () => { drag = null; };
  cnv.addEventListener('pointerdown', onDown);
  cnv.addEventListener('pointermove', onMove);
  cnv.addEventListener('pointerup', onUp);
  cnv.addEventListener('pointercancel', onUp);

  const c2 = new THREE.Clock();
  let t = 0;
  let raf = 0;
  // Animación de entrada: el objeto aparece creciendo
  obj.scale.setScalar(0.01);
  const loop = () => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(c2.getDelta(), 0.05);
    t += dt;
    const grow = Math.min(1, t / 0.8);
    obj.scale.setScalar(ease.outBack(grow));
    if (!drag) {
      velocity += (0.6 - velocity) * Math.min(1, dt * 2);
      spinner.rotation.y += velocity * dt;
    }
    spinner.position.y = Math.sin(t * 1.4) * 0.08;
    spinner.rotation.x = Math.sin(t * 0.7) * 0.08;
    sparkles.rotation.y = -t * 0.25;
    sm.opacity = 0.6 + Math.sin(t * 3) * 0.3;
    if (obj.userData.update) obj.userData.update(t);
    r.render(sc, cam);
  };
  loop();

  return {
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      cnv.removeEventListener('pointerdown', onDown);
      cnv.removeEventListener('pointermove', onMove);
      cnv.removeEventListener('pointerup', onUp);
      cnv.removeEventListener('pointercancel', onUp);
      disposeObject(sc);
      envRT.dispose();
      r.dispose();
      r.forceContextLoss();
    },
  };
}

/* =====================================================================
   6. INTERFAZ: portada, HUD, sonido, toasts y modo prueba
   ===================================================================== */
let toastTimer = null;
function showToast(text, ms = 2600) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

function todayGift() {
  const d = currentDate();
  if (d.getMonth() === 11 && d.getDate() <= 24) return gifts.find((g) => g.day === d.getDate()) || null;
  return null;
}

function updateHud() {
  $('#hudCount').textContent = `${openedDays.size} de 24 abiertos`;
  const btn = $('#hudToday');
  const d = currentDate();
  let text;
  let canFocus = false;
  if (TEST_MODE && testState.unlockAll) {
    text = 'Modo prueba · todo desbloqueado';
  } else if (d.getMonth() === 11 && d.getDate() <= 24) {
    const g = todayGift();
    text = openedDays.has(d.getDate()) ? `Hoy: regalo ${d.getDate()} ✓` : `Hoy puedes abrir el regalo ${d.getDate()} ✦`;
    canFocus = !!g;
  } else if ((d.getMonth() === 11 && d.getDate() >= 25) || d.getMonth() === 0) {
    text = '¡Feliz Navidad! Todos los regalos están abiertos';
  } else {
    const n = daysUntil(1);
    text = n === 1 ? 'Falta 1 día para el primer regalo' : `Faltan ${n} días para el primer regalo`;
  }
  btn.textContent = text;
  btn.disabled = !canFocus;
}

function setupHud() {
  $('#hudName').textContent = CONFIG.recipientName;
  $('#hudToday').addEventListener('click', () => {
    const g = todayGift();
    if (!g || modalOpen) return;
    audio.playClick();
    pauseAutoRotate(8);
    focusGift(g, 1.4).then(() => {
      g.hoverTarget = 1;
      setTimeout(() => { if (hovered !== g) g.hoverTarget = 0; }, 1600);
    });
  });
}

function setupSound() {
  const btn = $('#soundBtn');
  const render = () => {
    btn.classList.toggle('muted', audio.muted);
    btn.setAttribute('aria-pressed', String(!audio.muted));
    btn.setAttribute('aria-label', audio.muted ? 'Activar sonido' : 'Silenciar sonido');
    btn.title = audio.muted ? 'Activar sonido' : 'Silenciar sonido';
  };
  btn.addEventListener('click', () => {
    audio.init();
    audio.toggleMute();
    if (!audio.musicOn) audio.startMusic();
    render();
  });
  render();
}

function setupModal() {
  modal.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOpen) closeModal();
    // Mantener el foco dentro del modal
    if (e.key === 'Tab' && modalOpen) {
      const f = [...modal.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])')].filter((el) => !el.disabled);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
}

function setupTestPanel() {
  if (!TEST_MODE) return;
  const panel = $('#testPanel');
  panel.hidden = false;
  if (IS_MOBILE) panel.classList.add('collapsed');
  const unlockAll = $('#tUnlockAll');
  const date = $('#tDate');
  const d = new Date();
  date.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  $('#testToggle').addEventListener('click', () => panel.classList.toggle('collapsed'));
  unlockAll.addEventListener('change', () => {
    testState.unlockAll = unlockAll.checked;
    refreshGiftStates();
  });
  const applyDate = () => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.value);
    testState.simDate = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12).getTime() : null;
    testState.unlockAll = false;
    unlockAll.checked = false;
    refreshGiftStates();
    showToast(`Fecha simulada: ${date.value}`);
  };
  date.addEventListener('change', applyDate);
  $('#tDecFirst').addEventListener('click', () => {
    date.value = `${new Date().getFullYear()}-12-01`;
    applyDate();
  });
  $('#tReset').addEventListener('click', () => {
    openedDays.clear();
    store.remove(OPENED_KEY);
    for (const g of gifts) {
      g.state = 'locked';
      setGiftClosedInstant(g);
    }
    refreshGiftStates();
    showToast('Progreso reiniciado');
  });
}

/* --- Portada y entrada a la escena -------------------------------- */
function setupCover() {
  $('#coverName').textContent = CONFIG.recipientName;
  $('#coverDedication').textContent = CONFIG.dedication;
  const sig = $('#coverSignature');
  if (CONFIG.signature) sig.textContent = CONFIG.signature;
  else sig.remove();
  document.title = `Calendario de Adviento · ${CONFIG.recipientName}`;

  $('#enterBtn').addEventListener('click', async () => {
    // El audio se crea dentro del gesto del usuario (política de autoplay)
    audio.init();
    audio.startMusic();
    $('#cover').classList.add('leaving');
    $('#soundBtn').hidden = false;
    setTimeout(() => {
      $('#cover').hidden = true;
      $('#hud').classList.add('show');
    }, 1300);
    const home = cameraHome();
    await moveCamera(home.pos, home.target, 3.4);
    controls.enabled = true;
    controls.autoRotate = true;
    interactive = true;
    canvas.style.cursor = 'grab';
    showToast(IS_MOBILE ? 'Toca un regalo para abrirlo ✦' : 'Haz clic en un regalo para abrirlo ✦', 4200);
  });
}

/* =====================================================================
   7. BUCLE DE RENDER Y ARRANQUE
   ===================================================================== */
function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  const s = IS_MOBILE ? 0.5 : 1;
  bloomPass.resolution.set(w * s, h * s);
  controls.maxDistance = w / h < 0.75 ? 24 : 20;
}

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  updateTweens(dt);
  if (!sceneActive) return;
  controls.update(dt);
  for (const fn of animated) fn(dt, elapsed);
  composer.render(dt);
}

function setLoading(text) {
  const el = $('#loaderText');
  if (el) el.textContent = text;
}

function fail(message) {
  $('#loader').classList.add('error');
  setLoading(message);
}

/* Espera a que las fuentes estén listas (con límite de tiempo) para
   que los números de los regalos se dibujen con la tipografía buena. */
function fontsReady() {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  const loads = Promise.all([
    document.fonts.load('700 64px Quicksand'),
    document.fonts.load('400 64px "Great Vibes"'),
  ]).catch(() => {});
  return Promise.race([loads, new Promise((r) => setTimeout(r, 3000))]);
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

async function start() {
  window.__adventStarted = true;
  try {
    setLoading('Preparando la nieve…');
    await fontsReady();
    initRenderer();
    await nextFrame();
    setLoading('Encendiendo las estrellas…');
    buildSky();
    buildStars();
    buildMoon();
    await nextFrame();
    setLoading('Plantando el árbol…');
    buildGround();
    buildForest();
    buildTree();
    await nextFrame();
    setLoading('Envolviendo los regalos…');
    buildGifts();
    buildSnow();
    setupHud();
    setupSound();
    setupModal();
    setupTestPanel();
    setupCover();
    updateHud();

    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', () => setHovered(null));
    controls.addEventListener('start', () => pauseAutoRotate(0));
    controls.addEventListener('end', () => pauseAutoRotate(6));
    window.addEventListener('resize', onResize);

    // Precompila los shaders para evitar tirones al empezar
    renderer.compile(scene, camera);
    loop();
    await nextFrame();
    await nextFrame();
    window.__adventReady = true;
    $('#loader').classList.add('done');
    $('#cover').hidden = false;
    requestAnimationFrame(() => $('#cover').classList.add('show'));
    setTimeout(() => { $('#loader').hidden = true; }, 900);
  } catch (err) {
    console.error(err);
    fail('No se pudo iniciar la escena 3D. Prueba con un navegador actualizado (con WebGL activado).');
  }
}

/* Comprobación básica de WebGL antes de empezar */
(function boot() {
  try {
    const test = document.createElement('canvas');
    const ok = !!(window.WebGLRenderingContext && (test.getContext('webgl2') || test.getContext('webgl')));
    if (!ok) {
      window.__adventStarted = true;
      fail('Tu navegador no admite WebGL, necesario para ver la escena 3D.');
      return;
    }
  } catch {
    /* seguimos intentándolo */
  }
  start();
})();
})();
