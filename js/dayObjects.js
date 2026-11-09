/* =====================================================================
   OBJETOS 3D DE CADA DÍA (para el mini visor del modal)
   ---------------------------------------------------------------------
   createDayObject(day) devuelve un THREE.Group con un objeto exclusivo
   del día, construido solo con geometrías de Three.js (sin modelos).
   Si el objeto tiene animación propia (llama de vela, nieve dentro de
   la bola…), la expone en group.userData.update(tiempo).

   createEnvironment(renderer) genera un mapa de entorno nocturno
   procedural para que los metales y cristales tengan reflejos fríos.
   ===================================================================== */
(function () {
'use strict';
const THREE = window.THREE;

/* ---------- Paleta y materiales reutilizables ---------------------- */
const COL = {
  ice: 0xcfe9ff,
  cyan: 0x7fe8ff,
  lavender: 0xc7b8ff,
  deepLav: 0x8f7fd6,
  silver: 0xe3e9f5,
  navy: 0x1d2f5e,
  blue: 0x3f6fc4,
  snow: 0xf7fbff,
  warm: 0xffd99a,
  rose: 0xff9fc2,
  teal: 0x2f6b8a,
};

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.2, ...o });
const metal = (color, o = {}) => std(color, { metalness: 0.9, roughness: 0.22, ...o });
const glow = (color, intensity = 2.2) =>
  new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.5 });
const snowMat = () => std(COL.snow, { roughness: 0.85, metalness: 0, emissive: 0x1a2a4a, emissiveIntensity: 0.25 });

const mesh = (geo, mat, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
};

/* Textura de canvas a partir de una función de dibujo. */
function canvasTexture(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  t.anisotropy = 4;
  return t;
}

/* Forma de estrella 2D. */
function starShape(outer = 1, inner = 0.45, points = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = Math.PI / 2 + (i * Math.PI) / points;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

/* Lazo: dos bucles (toros aplastados) y un nudo central. */
function bow(color, size = 1) {
  const g = new THREE.Group();
  const m = std(color, { roughness: 0.35, metalness: 0.3 });
  for (const s of [-1, 1]) {
    const loop = mesh(new THREE.TorusGeometry(0.16 * size, 0.045 * size, 10, 24), m, s * 0.15 * size, 0.06 * size, 0);
    loop.scale.set(1, 0.6, 0.9);
    loop.rotation.set(0, s * 0.4, s * 0.5);
    g.add(loop);
  }
  g.add(mesh(new THREE.SphereGeometry(0.07 * size, 12, 10), m, 0, 0.04 * size, 0));
  return g;
}

/* Ajusta un objeto para que quepa en un cubo de tamaño "target"
   y quede centrado. Devuelve un grupo envoltorio. */
function fit(inner, target = 2.1) {
  const box = new THREE.Box3().setFromObject(inner);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const s = target / Math.max(size.x, size.y, size.z);
  inner.position.sub(center);
  const scaler = new THREE.Group();
  scaler.scale.setScalar(s);
  scaler.add(inner);
  const outer = new THREE.Group();
  outer.add(scaler);
  outer.userData.update = inner.userData.update;
  return outer;
}

/* Llama animada (con luz puntual). */
function flame(scale = 1) {
  const g = new THREE.Group();
  const f = mesh(new THREE.SphereGeometry(0.08 * scale, 16, 12), glow(COL.warm, 3));
  f.scale.set(1, 2.2, 1);
  const core = mesh(new THREE.SphereGeometry(0.04 * scale, 12, 10), glow(0xffffff, 4), 0, -0.04 * scale, 0);
  core.scale.set(1, 1.8, 1);
  const light = new THREE.PointLight(COL.warm, 1.6, 3, 2);
  g.add(f, core, light);
  g.userData.update = (t) => {
    const k = 1 + Math.sin(t * 17) * 0.06 + Math.sin(t * 29) * 0.04;
    f.scale.set(1 / k, 2.2 * k, 1 / k);
    light.intensity = 1.4 + Math.sin(t * 23) * 0.3;
  };
  return g;
}

/* ---------- Los 24 objetos ---------------------------------------- */
const BUILDERS = {
  /* 1 · Copo de nieve */
  1() {
    const g = new THREE.Group();
    const m = metal(COL.ice, { roughness: 0.15, metalness: 0.6, emissive: 0x2f7fb0, emissiveIntensity: 0.35 });
    for (let i = 0; i < 6; i++) {
      const arm = new THREE.Group();
      arm.rotation.z = (i * Math.PI) / 3;
      arm.add(mesh(new THREE.BoxGeometry(0.09, 1, 0.07), m, 0, 0.5, 0));
      for (const [y, len] of [[0.42, 0.34], [0.7, 0.22]]) {
        for (const s of [-1, 1]) {
          const b = mesh(new THREE.BoxGeometry(0.06, len, 0.05), m,
            s * Math.sin(Math.PI / 4) * len * 0.5, y + Math.cos(Math.PI / 4) * len * 0.5, 0);
          b.rotation.z = -s * (Math.PI / 4);
          arm.add(b);
        }
      }
      arm.add(mesh(new THREE.OctahedronGeometry(0.08), m, 0, 1.02, 0));
      g.add(arm);
    }
    const hub = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.1, 6), m);
    hub.rotation.x = Math.PI / 2;
    g.add(hub);
    return g;
  },

  /* 2 · Muñeco de nieve */
  2() {
    const g = new THREE.Group();
    const s = snowMat();
    g.add(mesh(new THREE.SphereGeometry(0.5, 32, 24), s, 0, 0, 0));
    g.add(mesh(new THREE.SphereGeometry(0.36, 32, 24), s, 0, 0.7, 0));
    g.add(mesh(new THREE.SphereGeometry(0.26, 32, 24), s, 0, 1.22, 0));
    const dark = std(0x1a2240, { roughness: 0.3 });
    for (const x of [-0.09, 0.09]) g.add(mesh(new THREE.SphereGeometry(0.03, 10, 8), dark, x, 1.28, 0.23));
    for (const y of [0.62, 0.78, 0.2]) g.add(mesh(new THREE.SphereGeometry(0.04, 10, 8), dark, 0, y, y > 0.5 ? 0.35 : 0.49));
    const nose = mesh(new THREE.ConeGeometry(0.045, 0.24, 12), std(0xff9d5c), 0, 1.2, 0.36);
    nose.rotation.x = Math.PI / 2;
    g.add(nose);
    const hatMat = std(COL.navy, { roughness: 0.5 });
    g.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 28), hatMat, 0, 1.43, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.18, 0.19, 0.3, 28), hatMat, 0, 1.6, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.192, 0.192, 0.06, 28), std(COL.cyan), 0, 1.5, 0));
    const scarf = mesh(new THREE.TorusGeometry(0.25, 0.06, 12, 32), std(COL.cyan, { roughness: 0.8 }), 0, 1.0, 0);
    scarf.rotation.x = Math.PI / 2;
    g.add(scarf);
    const tail = mesh(new THREE.BoxGeometry(0.1, 0.32, 0.04), std(COL.cyan, { roughness: 0.8 }), 0.14, 0.85, 0.22);
    tail.rotation.z = 0.2;
    g.add(tail);
    const stick = std(0x7a6a8f, { roughness: 0.9 });
    for (const sx of [-1, 1]) {
      const arm = mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.6, 6), stick, sx * 0.55, 0.85, 0);
      arm.rotation.z = sx * -1.0;
      g.add(arm);
    }
    return g;
  },

  /* 3 · Bola de Navidad */
  3() {
    const g = new THREE.Group();
    const tex = canvasTexture(512, 256, (ctx, w, h) => {
      const grd = ctx.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, '#2a4c9a');
      grd.addColorStop(1, '#16285a');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#e8f4ff';
      ctx.lineWidth = 8;
      for (const y of [h * 0.38, h * 0.62]) {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 16) ctx.lineTo(x, y + (x / 16) % 2 * 10 - 5);
        ctx.stroke();
      }
      ctx.fillStyle = '#c7b8ff';
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.arc(32 + i * 64, h * 0.5, 9, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    g.add(mesh(new THREE.SphereGeometry(0.8, 48, 32), std(0xffffff, { map: tex, metalness: 0.55, roughness: 0.18 })));
    g.add(mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.18, 24), metal(COL.silver), 0, 0.84, 0));
    g.add(mesh(new THREE.TorusGeometry(0.08, 0.02, 8, 20), metal(COL.silver), 0, 1.0, 0));
    return g;
  },

  /* 4 · Estrella */
  4() {
    const geo = new THREE.ExtrudeGeometry(starShape(1, 0.45), {
      depth: 0.22, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 4,
    });
    geo.center();
    const m = metal(0xf4f8ff, { emissive: 0xa8d8ff, emissiveIntensity: 0.4, roughness: 0.18 });
    const g = new THREE.Group();
    g.add(mesh(geo, m));
    return g;
  },

  /* 5 · Trineo */
  5() {
    const g = new THREE.Group();
    const shape = new THREE.Shape();
    shape.moveTo(-0.9, 0);
    shape.lineTo(0.7, 0);
    shape.quadraticCurveTo(1.0, 0, 1.0, 0.35);
    shape.quadraticCurveTo(1.0, 0.62, 0.84, 0.6);
    shape.lineTo(0.78, 0.42);
    shape.lineTo(-0.6, 0.32);
    shape.lineTo(-0.78, 0.72);
    shape.lineTo(-0.96, 0.7);
    shape.closePath();
    const body = new THREE.ExtrudeGeometry(shape, { depth: 0.7, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 3 });
    body.translate(0, 0, -0.35);
    g.add(mesh(body, std(COL.blue, { metalness: 0.4, roughness: 0.3 }), 0, 0, 0));
    const silver = metal(COL.silver);
    for (const z of [-0.32, 0.32]) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-1.1, -0.28, z), new THREE.Vector3(0.6, -0.28, z),
        new THREE.Vector3(1.15, -0.2, z), new THREE.Vector3(1.25, 0.05, z), new THREE.Vector3(1.1, 0.12, z),
      ]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.04, 10), silver));
      for (const x of [-0.6, 0.5]) g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8), silver, x, -0.14, z));
    }
    // Regalitos a bordo
    g.add(mesh(new THREE.BoxGeometry(0.34, 0.3, 0.34), std(COL.lavender), -0.25, 0.47, 0));
    g.add(mesh(new THREE.BoxGeometry(0.36, 0.06, 0.36), std(COL.snow), -0.25, 0.47, 0));
    g.add(mesh(new THREE.BoxGeometry(0.26, 0.22, 0.26), std(COL.cyan), 0.15, 0.42, 0.05));
    return g;
  },

  /* 6 · Taza de chocolate */
  6() {
    const g = new THREE.Group();
    const profile = [[0, 0], [0.46, 0], [0.5, 0.04], [0.56, 0.95], [0.52, 0.97], [0.47, 0.12], [0, 0.12]]
      .map(([x, y]) => new THREE.Vector2(x, y));
    const mug = std(COL.blue, { roughness: 0.25, metalness: 0.1, side: THREE.DoubleSide });
    g.add(new THREE.Mesh(new THREE.LatheGeometry(profile, 48), mug));
    const handle = mesh(new THREE.TorusGeometry(0.24, 0.06, 12, 24, Math.PI), mug, 0.52, 0.5, 0);
    handle.rotation.z = -Math.PI / 2;
    g.add(handle);
    g.add(mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.02, 40), std(0x6b3f2a, { roughness: 0.3 }), 0, 0.82, 0));
    const mm = std(COL.snow, { roughness: 0.9 });
    [[-0.15, 0.05, 0.3], [0.12, -0.12, 1.2], [0.05, 0.2, 2.1]].forEach(([x, z, r]) => {
      const b = mesh(new THREE.BoxGeometry(0.15, 0.1, 0.15), mm, x, 0.86, z);
      b.rotation.set(0.2, r, 0.1);
      g.add(b);
    });
    g.add(mesh(new THREE.CylinderGeometry(0.85, 0.7, 0.05, 48), metal(COL.silver), 0, -0.03, 0));
    // Vapor: tubos ondulados translúcidos
    const steamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false });
    const steam = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const pts = [];
      for (let k = 0; k < 8; k++) pts.push(new THREE.Vector3((i - 1) * 0.18 + Math.sin(k * 1.3 + i) * 0.07, 0.9 + k * 0.08, 0));
      steam.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.018, 6), steamMat));
    }
    g.add(steam);
    g.userData.update = (t) => {
      steamMat.opacity = 0.18 + Math.sin(t * 1.5) * 0.12;
      steam.position.y = Math.sin(t * 0.8) * 0.03;
    };
    return g;
  },

  /* 7 · Farolillo */
  7() {
    const g = new THREE.Group();
    const frame = std(COL.navy, { metalness: 0.6, roughness: 0.35 });
    g.add(mesh(new THREE.BoxGeometry(0.75, 0.1, 0.75), frame, 0, 0, 0));
    for (const x of [-0.31, 0.31]) for (const z of [-0.31, 0.31]) g.add(mesh(new THREE.BoxGeometry(0.06, 1, 0.06), frame, x, 0.55, z));
    g.add(mesh(new THREE.BoxGeometry(0.75, 0.08, 0.75), frame, 0, 1.06, 0));
    const roof = mesh(new THREE.ConeGeometry(0.56, 0.42, 4), metal(COL.silver), 0, 1.31, 0);
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
    g.add(mesh(new THREE.TorusGeometry(0.1, 0.025, 8, 20), metal(COL.silver), 0, 1.6, 0));
    g.add(mesh(new THREE.BoxGeometry(0.58, 0.98, 0.58),
      new THREE.MeshStandardMaterial({ color: 0xfff1d0, transparent: true, opacity: 0.18, roughness: 0.05, depthWrite: false }), 0, 0.55, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.4, 20), std(COL.snow), 0, 0.25, 0));
    const f = flame(1);
    f.position.set(0, 0.56, 0);
    g.add(f);
    g.userData.update = f.userData.update;
    return g;
  },

  /* 8 · Campana */
  8() {
    const g = new THREE.Group();
    const swing = new THREE.Group();
    const pts = [[0.75, 0], [0.8, 0.05], [0.7, 0.13], [0.55, 0.4], [0.46, 0.75], [0.38, 0.96], [0.2, 1.06], [0, 1.09]]
      .map(([x, y]) => new THREE.Vector2(x, y));
    swing.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 48), metal(COL.silver, { side: THREE.DoubleSide, roughness: 0.15 })));
    swing.add(mesh(new THREE.SphereGeometry(0.14, 16, 12), metal(0xd9cdff), 0, 0.05, 0));
    swing.position.y = -1.1;
    const pivot = new THREE.Group();
    pivot.position.y = 1.1;
    pivot.add(swing);
    const b = bow(COL.cyan, 1.6);
    b.position.y = 1.14;
    g.add(pivot, b);
    g.userData.update = (t) => { pivot.rotation.z = Math.sin(t * 2.2) * 0.18; };
    return g;
  },

  /* 9 · Arbolito */
  9() {
    const g = new THREE.Group();
    const m = std(COL.teal, { roughness: 0.6, emissive: 0x0d2a40, emissiveIntensity: 0.4 });
    [[0.75, 0.7, 0.35], [0.58, 0.6, 0.8], [0.4, 0.5, 1.2]].forEach(([r, h, y]) => g.add(mesh(new THREE.ConeGeometry(r, h, 24), m, 0, y, 0)));
    g.add(mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.3, 12), std(0x5a4a6a), 0, -0.1, 0));
    const colors = [COL.cyan, COL.lavender, COL.snow, COL.rose];
    for (let i = 0; i < 14; i++) {
      const y = 0.15 + (i / 14) * 1.1;
      const r = 0.72 - (y / 1.45) * 0.6;
      const a = i * 2.4;
      g.add(mesh(new THREE.SphereGeometry(0.05, 12, 10), glow(colors[i % 4], 1.6), Math.cos(a) * r, y, Math.sin(a) * r));
    }
    const star = new THREE.ExtrudeGeometry(starShape(0.16, 0.07), { depth: 0.04, bevelEnabled: false });
    star.center();
    g.add(mesh(star, glow(COL.warm, 2), 0, 1.55, 0));
    return g;
  },

  /* 10 · Calcetín navideño */
  10() {
    const g = new THREE.Group();
    const s = new THREE.Shape();
    s.moveTo(-0.35, 1);
    s.lineTo(0.35, 1);
    s.lineTo(0.35, 0.15);
    s.quadraticCurveTo(0.4, 0, 0.7, -0.05);
    s.quadraticCurveTo(0.95, -0.12, 0.9, -0.38);
    s.quadraticCurveTo(0.85, -0.55, 0.55, -0.55);
    s.lineTo(-0.1, -0.55);
    s.quadraticCurveTo(-0.42, -0.55, -0.38, -0.2);
    s.closePath();
    const tex = canvasTexture(64, 64, (ctx, w, h) => {
      ctx.fillStyle = '#3f6fc4';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#c7b8ff';
      ctx.fillRect(0, h * 0.4, w, h * 0.2);
    }, [1, 3]);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.07, bevelSegments: 4 });
    g.add(new THREE.Mesh(geo, std(0xffffff, { map: tex, roughness: 0.8 })));
    const cuffShape = new THREE.Shape();
    const w = 0.5, h = 0.16, r = 0.12;
    cuffShape.moveTo(-w + r, -h);
    cuffShape.lineTo(w - r, -h);
    cuffShape.quadraticCurveTo(w, -h, w, -h + r);
    cuffShape.lineTo(w, h - r);
    cuffShape.quadraticCurveTo(w, h, w - r, h);
    cuffShape.lineTo(-w + r, h);
    cuffShape.quadraticCurveTo(-w, h, -w, h - r);
    cuffShape.lineTo(-w, -h + r);
    cuffShape.quadraticCurveTo(-w, -h, -w + r, -h);
    const cuff = new THREE.ExtrudeGeometry(cuffShape, { depth: 0.42, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3 });
    g.add(mesh(cuff, snowMat(), 0, 1.02, -0.06));
    g.add(mesh(new THREE.TorusGeometry(0.1, 0.025, 8, 20), metal(COL.silver), -0.4, 1.25, 0.15));
    return g;
  },

  /* 11 · Vela */
  11() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.3, 0.32, 1.1, 32), std(COL.lavender, { roughness: 0.6 }), 0, 0.6, 0));
    const drip = std(0xd9cdff, { roughness: 0.5 });
    [[0.3, 0.98, 0], [-0.2, 1.0, 0.22], [0.05, 0.95, -0.29]].forEach(([x, y, z]) => {
      const d = mesh(new THREE.CapsuleGeometry(0.04, 0.16, 4, 8), drip, x, y, z);
      g.add(d);
    });
    g.add(mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.04, 32), drip, 0, 1.15, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.1, 6), std(0x222222), 0, 1.21, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.6, 0.5, 0.08, 40), metal(COL.silver), 0, 0.02, 0));
    const handle = mesh(new THREE.TorusGeometry(0.12, 0.03, 8, 20), metal(COL.silver), 0.66, 0.06, 0);
    handle.rotation.x = Math.PI / 2;
    g.add(handle);
    const f = flame(1.2);
    f.position.set(0, 1.38, 0);
    g.add(f);
    g.userData.update = f.userData.update;
    return g;
  },

  /* 12 · Casita nevada */
  12() {
    const g = new THREE.Group();
    const wall = std(COL.blue, { roughness: 0.6 });
    g.add(mesh(new THREE.BoxGeometry(1, 0.75, 0.8), wall, 0, 0.375, 0));
    const tri = new THREE.Shape();
    tri.moveTo(-0.5, 0);
    tri.lineTo(0.5, 0);
    tri.lineTo(0, 0.42);
    tri.closePath();
    const gable = new THREE.ExtrudeGeometry(tri, { depth: 0.8, bevelEnabled: false });
    gable.translate(0, 0.75, -0.4);
    g.add(new THREE.Mesh(gable, wall));
    const roofMat = std(COL.navy, { roughness: 0.5 });
    const snow = snowMat();
    const slope = Math.atan2(0.42, 0.5);
    for (const s of [-1, 1]) {
      const r = mesh(new THREE.BoxGeometry(0.74, 0.05, 0.95), roofMat, s * 0.27, 0.98, 0);
      r.rotation.z = -s * slope;
      const sn = mesh(new THREE.BoxGeometry(0.74, 0.07, 0.98), snow, s * 0.25, 1.03, 0);
      sn.rotation.z = -s * slope;
      g.add(r, sn);
    }
    g.add(mesh(new THREE.BoxGeometry(0.14, 0.32, 0.14), std(0x5a4a6a), 0.25, 1.15, -0.15));
    g.add(mesh(new THREE.BoxGeometry(0.18, 0.05, 0.18), snow, 0.25, 1.32, -0.15));
    g.add(mesh(new THREE.BoxGeometry(0.2, 0.36, 0.02), roofMat, 0, 0.18, 0.41));
    const win = glow(COL.warm, 1.8);
    for (const x of [-0.32, 0.32]) g.add(mesh(new THREE.BoxGeometry(0.18, 0.18, 0.02), win, x, 0.45, 0.41));
    g.add(mesh(new THREE.CircleGeometry(0.07, 20), win, 0, 0.92, 0.405));
    g.add(mesh(new THREE.CylinderGeometry(0.85, 0.9, 0.06, 40), snow, 0, -0.03, 0));
    return g;
  },

  /* 13 · Bola de nieve (globo) */
  13() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.62, 0.75, 0.35, 40), std(COL.navy, { metalness: 0.5, roughness: 0.3 }), 0, 0.17, 0));
    const rim = mesh(new THREE.TorusGeometry(0.62, 0.04, 10, 40), metal(COL.silver), 0, 0.34, 0);
    rim.rotation.x = Math.PI / 2;
    g.add(rim);
    g.add(mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.04, 32), snowMat(), 0, 0.37, 0));
    const tree = std(COL.teal, { emissive: 0x0d2a40, emissiveIntensity: 0.5 });
    g.add(mesh(new THREE.ConeGeometry(0.22, 0.4, 16), tree, 0, 0.6, 0));
    g.add(mesh(new THREE.ConeGeometry(0.16, 0.3, 16), tree, 0, 0.8, 0));
    g.add(mesh(new THREE.SphereGeometry(0.04, 10, 8), glow(COL.warm, 2.5), 0, 0.97, 0));
    g.add(mesh(new THREE.SphereGeometry(0.78, 48, 32),
      new THREE.MeshStandardMaterial({ color: 0xdff2ff, transparent: true, opacity: 0.16, roughness: 0, metalness: 0.2, depthWrite: false }), 0, 0.85, 0));
    // Nieve flotante dentro del globo
    const N = 140;
    const pos = new Float32Array(N * 3);
    const seeds = [];
    for (let i = 0; i < N; i++) seeds.push([Math.random() * Math.PI * 2, Math.random() * 0.55, Math.random()]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const flakes = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.035, transparent: true, opacity: 0.9 }));
    g.add(flakes);
    g.userData.update = (t) => {
      for (let i = 0; i < N; i++) {
        const [a, r, ph] = seeds[i];
        const y = 1.45 - ((ph + t * 0.06) % 1) * 1.0;
        pos[i * 3] = Math.cos(a + t * 0.3) * r;
        pos[i * 3 + 1] = y;
        pos[i * 3 + 2] = Math.sin(a + t * 0.3) * r;
      }
      geo.attributes.position.needsUpdate = true;
    };
    return g;
  },

  /* 14 · Bastón de caramelo */
  14() {
    const pts = [];
    for (let i = 0; i <= 20; i++) pts.push(new THREE.Vector3(0, -1.2 + i * 0.085, 0));
    for (let i = 1; i <= 24; i++) {
      const a = Math.PI - (i / 24) * Math.PI;
      pts.push(new THREE.Vector3(0.38 + Math.cos(a) * 0.38, 0.5 + Math.sin(a) * 0.38, 0));
    }
    pts.push(new THREE.Vector3(0.76, 0.32, 0));
    const curve = new THREE.CatmullRomCurve3(pts);
    const tex = canvasTexture(128, 128, (ctx, w, h) => {
      ctx.fillStyle = '#f7fbff';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#4fa8f0';
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        ctx.moveTo(k * w, 0);
        ctx.lineTo(k * w + w * 0.4, 0);
        ctx.lineTo(k * w + w * 1.4, h);
        ctx.lineTo(k * w + w, h);
        ctx.fill();
      }
      ctx.fillStyle = '#c7b8ff';
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        ctx.moveTo(k * w + w * 0.5, 0);
        ctx.lineTo(k * w + w * 0.58, 0);
        ctx.lineTo(k * w + w * 1.58, h);
        ctx.lineTo(k * w + w * 1.5, h);
        ctx.fill();
      }
    }, [16, 1]);
    const geo = new THREE.TubeGeometry(curve, 160, 0.13, 20);
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 })));
    for (const z of [-1, 1]) {
      const cap = mesh(new THREE.SphereGeometry(0.13, 20, 12), std(COL.snow), z < 0 ? 0 : 0.76, z < 0 ? -1.2 : 0.32, 0);
      g.add(cap);
    }
    const b = bow(COL.lavender, 1.3);
    b.position.set(0, -0.2, 0.14);
    b.rotation.x = Math.PI / 2;
    g.add(b);
    return g;
  },

  /* 15 · Regalo */
  15() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.BoxGeometry(1, 0.8, 1), std(COL.lavender, { roughness: 0.5 }), 0, 0.4, 0));
    g.add(mesh(new THREE.BoxGeometry(1.08, 0.2, 1.08), std(COL.deepLav, { roughness: 0.5 }), 0, 0.88, 0));
    const rib = std(COL.cyan, { metalness: 0.4, roughness: 0.3 });
    g.add(mesh(new THREE.BoxGeometry(0.16, 1.0, 1.1), rib, 0, 0.5, 0));
    g.add(mesh(new THREE.BoxGeometry(1.1, 1.0, 0.16), rib, 0, 0.5, 0));
    const b = bow(COL.cyan, 2.2);
    b.position.y = 1.0;
    g.add(b);
    return g;
  },

  /* 16 · Luna creciente */
  16() {
    // Se calcula la silueta muestreando dos circunferencias
    const c2 = new THREE.Vector2(0.48, 0.22);
    const r1 = 1, r2 = 0.86;
    const inC1 = (p) => p.length() <= r1 + 1e-6;
    const outC2 = (p) => p.distanceTo(c2) >= r2 - 1e-6;
    const pts = [];
    for (let i = 0; i < 360; i++) {
      const a = (i / 360) * Math.PI * 2;
      const p = new THREE.Vector2(Math.cos(a) * r1, Math.sin(a) * r1);
      if (outC2(p)) pts.push({ p, a, onOuter: true });
    }
    // Ordena el arco exterior empezando tras el hueco
    let start = 0;
    for (let i = 0; i < pts.length; i++) {
      const next = pts[(i + 1) % pts.length];
      if (next.a - pts[i].a > 0.05 && i + 1 < pts.length) { start = i + 1; break; }
    }
    const outer = pts.slice(start).concat(pts.slice(0, start)).map((o) => o.p);
    const first = outer[0], last = outer[outer.length - 1];
    // Arco interior (dentro de C1) de "last" a "first"
    const aFrom = Math.atan2(last.y - c2.y, last.x - c2.x);
    const aTo = Math.atan2(first.y - c2.y, first.x - c2.x);
    const sample = (dir) => {
      const arr = [];
      let span = aTo - aFrom;
      if (dir > 0 && span < 0) span += Math.PI * 2;
      if (dir < 0 && span > 0) span -= Math.PI * 2;
      for (let i = 1; i < 60; i++) {
        const a = aFrom + (span * i) / 60;
        arr.push(new THREE.Vector2(c2.x + Math.cos(a) * r2, c2.y + Math.sin(a) * r2));
      }
      return arr;
    };
    let inner = sample(1);
    if (!inC1(inner[30])) inner = sample(-1);
    const shape = new THREE.Shape(outer.concat(inner));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.25, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 4 });
    geo.center();
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo, metal(0xf2f5ff, { emissive: 0x9fb8ff, emissiveIntensity: 0.35, roughness: 0.35, metalness: 0.5 })));
    const st = new THREE.ExtrudeGeometry(starShape(0.18, 0.08), { depth: 0.06, bevelEnabled: false });
    st.center();
    const star = mesh(st, glow(COL.warm, 2), 0.55, -0.1, 0);
    g.add(star);
    const thread = mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.5, 4), std(COL.silver), 0.55, 0.17, 0);
    g.add(thread);
    g.userData.update = (t) => { star.rotation.y = t * 2; };
    return g;
  },

  /* 17 · Pingüino */
  17() {
    const g = new THREE.Group();
    const navy = std(COL.navy, { roughness: 0.45 });
    const white = std(COL.snow, { roughness: 0.7 });
    const body = mesh(new THREE.SphereGeometry(0.5, 32, 24), navy, 0, 0.55, 0);
    body.scale.set(1, 1.25, 0.9);
    const belly = mesh(new THREE.SphereGeometry(0.42, 32, 24), white, 0, 0.5, 0.12);
    belly.scale.set(0.9, 1.15, 0.8);
    const head = mesh(new THREE.SphereGeometry(0.34, 32, 24), navy, 0, 1.22, 0);
    const face = mesh(new THREE.SphereGeometry(0.27, 24, 16), white, 0, 1.2, 0.12);
    face.scale.set(1, 0.9, 0.85);
    g.add(body, belly, head, face);
    const eye = std(0x0b1633, { roughness: 0.2 });
    for (const x of [-0.1, 0.1]) g.add(mesh(new THREE.SphereGeometry(0.04, 12, 10), eye, x, 1.26, 0.33));
    const beak = mesh(new THREE.ConeGeometry(0.06, 0.16, 12), std(0xffb366), 0, 1.16, 0.4);
    beak.rotation.x = Math.PI / 2;
    g.add(beak);
    for (const s of [-1, 1]) {
      const fl = mesh(new THREE.SphereGeometry(0.2, 16, 12), navy, s * 0.5, 0.6, 0);
      fl.scale.set(0.3, 1, 0.6);
      fl.rotation.z = s * 0.3;
      g.add(fl);
      const foot = mesh(new THREE.SphereGeometry(0.12, 16, 10), std(0xffb366), s * 0.16, -0.05, 0.18);
      foot.scale.set(1, 0.35, 1.4);
      g.add(foot);
    }
    const scarf = mesh(new THREE.TorusGeometry(0.33, 0.07, 12, 32), std(COL.cyan, { roughness: 0.8 }), 0, 0.95, 0);
    scarf.rotation.x = Math.PI / 2;
    g.add(scarf);
    const hat = mesh(new THREE.ConeGeometry(0.3, 0.4, 24), std(COL.lavender, { roughness: 0.8 }), 0, 1.6, 0);
    g.add(hat, mesh(new THREE.SphereGeometry(0.08, 12, 10), white, 0, 1.82, 0));
    g.userData.update = (t) => { g.rotation.z = Math.sin(t * 3) * 0.06; };
    return g;
  },

  /* 18 · Corona de Adviento */
  18() {
    const g = new THREE.Group();
    const ring = mesh(new THREE.TorusGeometry(0.8, 0.18, 16, 64), std(COL.teal, { roughness: 0.75 }));
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    // Hojitas alrededor
    const leafGeo = new THREE.SphereGeometry(0.1, 8, 6);
    leafGeo.scale(1, 0.35, 2.2);
    const leafMat = std(0x3f86a8, { roughness: 0.6 });
    const leaves = new THREE.InstancedMesh(leafGeo, leafMat, 90);
    const d = new THREE.Object3D();
    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * Math.PI * 2;
      const off = (i % 3 - 1) * 0.13;
      d.position.set(Math.cos(a) * (0.8 + off), 0.1 + (i % 2) * 0.04, Math.sin(a) * (0.8 + off));
      d.rotation.set(0.4 * ((i % 2) * 2 - 1), -a + (i % 3) * 0.5, 0);
      d.updateMatrix();
      leaves.setMatrixAt(i, d.matrix);
    }
    g.add(leaves);
    const berry = metal(COL.lavender, { roughness: 0.2 });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + 0.2;
      g.add(mesh(new THREE.SphereGeometry(0.055, 12, 10), i % 2 ? berry : metal(COL.silver), Math.cos(a) * 0.95, 0.15, Math.sin(a) * 0.95));
    }
    const flames = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const x = Math.cos(a) * 0.8, z = Math.sin(a) * 0.8;
      g.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.55, 20), std(i === 2 ? COL.rose : COL.snow, { roughness: 0.6 }), x, 0.42, z));
      const f = mesh(new THREE.SphereGeometry(0.045, 12, 10), glow(COL.warm, 3), x, 0.76, z);
      f.scale.set(1, 2, 1);
      flames.push(f);
      g.add(f);
    }
    g.add(new THREE.PointLight(COL.warm, 1.2, 4, 2));
    g.children[g.children.length - 1].position.y = 0.9;
    g.userData.update = (t) => flames.forEach((f, i) => f.scale.set(1, 2 + Math.sin(t * 15 + i * 2) * 0.25, 1));
    return g;
  },

  /* 19 · Gorro de lana */
  19() {
    const g = new THREE.Group();
    const tex = canvasTexture(64, 256, (ctx, w, h) => {
      const bands = ['#3f6fc4', '#f7fbff', '#3f6fc4', '#c7b8ff', '#3f6fc4', '#f7fbff', '#3f6fc4'];
      bands.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, (i * h) / bands.length, w, h / bands.length + 1); });
      ctx.fillStyle = 'rgba(255,255,255,.18)';
      for (let x = 0; x < w; x += 8) ctx.fillRect(x, 0, 2, h);
    });
    const pts = [[0.7, 0], [0.69, 0.3], [0.6, 0.62], [0.42, 0.88], [0.2, 1.02], [0, 1.06]].map(([x, y]) => new THREE.Vector2(x, y));
    g.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 48), std(0xffffff, { map: tex, roughness: 0.9 })));
    const brim = mesh(new THREE.TorusGeometry(0.7, 0.14, 16, 48), snowMat());
    brim.rotation.x = Math.PI / 2;
    g.add(brim);
    const pomGeo = new THREE.IcosahedronGeometry(0.24, 3);
    const p = pomGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, i);
      v.multiplyScalar(1 + (Math.sin(i * 12.9898) * 0.5 + 0.5) * 0.12);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    pomGeo.computeVertexNormals();
    g.add(mesh(pomGeo, snowMat(), 0, 1.22, 0));
    return g;
  },

  /* 20 · Cristal de hielo */
  20() {
    const g = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({
      color: 0xbfe6ff, emissive: 0x3aa8d8, emissiveIntensity: 0.35, metalness: 0.3, roughness: 0.05,
      transparent: true, opacity: 0.88, flatShading: true,
    });
    const crystals = [[0, 0, 0, 1.0], [0.5, -0.3, 0.6, 0.6], [-0.55, -0.35, -0.5, 0.65], [0.3, -0.45, -0.9, 0.45], [-0.25, -0.45, 1.0, 0.45], [0, -0.5, 2.6, 0.4]];
    crystals.forEach(([x, z, rot, s]) => {
      const c = mesh(new THREE.OctahedronGeometry(0.35, 0), m);
      c.scale.set(s, s * 3, s);
      c.position.set(x * 0.6, s * 0.9 - 0.4, z * 0.6);
      c.rotation.set(z * 0.6, rot, -x * 0.6);
      g.add(c);
    });
    g.add(mesh(new THREE.CylinderGeometry(0.75, 0.85, 0.12, 7), snowMat(), 0, -0.45, 0));
    return g;
  },

  /* 21 · Piña escarchada */
  21() {
    const g = new THREE.Group();
    const scaleGeo = new THREE.SphereGeometry(0.15, 12, 8);
    scaleGeo.scale(1, 0.45, 0.9);
    const N = 120;
    const scales = new THREE.InstancedMesh(scaleGeo, std(0x7a5a4a, { roughness: 0.7 }), N);
    const tips = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 8, 6), snowMat(), N);
    const d = new THREE.Object3D();
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const t = i / N;
      const y = 1.6 - t * 1.6;
      const r = Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.04)), 0.7) * 0.55 + 0.05;
      const a = i * golden;
      d.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      d.rotation.set(0, -a, -0.6);
      d.updateMatrix();
      scales.setMatrixAt(i, d.matrix);
      d.position.set(Math.cos(a) * (r + 0.1), y + 0.03, Math.sin(a) * (r + 0.1));
      d.updateMatrix();
      tips.setMatrixAt(i, d.matrix);
    }
    g.add(scales, tips);
    g.add(mesh(new THREE.CylinderGeometry(0.2, 0.12, 0.2, 12), std(0x5a4a3a), 0, 1.68, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.25, 6), std(0x5a4a3a), 0, 1.85, 0));
    return g;
  },

  /* 22 · Ángel */
  22() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.ConeGeometry(0.5, 1.1, 32), std(0xe6defd, { roughness: 0.5 }), 0, 0.55, 0));
    g.add(mesh(new THREE.TorusGeometry(0.5, 0.03, 8, 40), metal(COL.silver), 0, 0.02, 0).rotateX(Math.PI / 2));
    g.add(mesh(new THREE.SphereGeometry(0.22, 24, 16), std(0xf6e7de, { roughness: 0.7 }), 0, 1.25, 0));
    const hair = mesh(new THREE.SphereGeometry(0.235, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), std(0xffe6a8, { roughness: 0.6 }), 0, 1.27, -0.02);
    g.add(hair);
    const halo = mesh(new THREE.TorusGeometry(0.18, 0.025, 10, 32), glow(COL.warm, 2.4), 0, 1.58, 0);
    halo.rotation.x = Math.PI / 2;
    g.add(halo);
    const wing = new THREE.Shape();
    wing.moveTo(0, 0);
    wing.bezierCurveTo(0.3, 0.5, 0.75, 0.55, 0.7, 0.2);
    wing.bezierCurveTo(0.65, -0.1, 0.4, -0.3, 0, -0.1);
    const wGeo = new THREE.ExtrudeGeometry(wing, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3 });
    const wMat = metal(COL.silver, { roughness: 0.3, metalness: 0.6, emissive: 0x4a5a8a, emissiveIntensity: 0.3 });
    const wings = new THREE.Group();
    for (const s of [-1, 1]) {
      const w = mesh(wGeo, wMat, 0, 0, 0);
      w.scale.x = s;
      w.rotation.y = s * 0.5;
      wings.add(w);
    }
    wings.position.set(0, 0.85, -0.2);
    g.add(wings);
    for (const s of [-1, 1]) {
      const arm = mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.4, 10), std(0xe6defd), s * 0.17, 0.82, 0.12);
      arm.rotation.set(-0.9, 0, s * 0.35);
      g.add(arm);
    }
    g.userData.update = (t) => { wings.children.forEach((w, i) => { w.rotation.y = (i ? 1 : -1) * (0.5 + Math.sin(t * 3) * 0.15); }); };
    return g;
  },

  /* 23 · Tambor */
  23() {
    const g = new THREE.Group();
    const tex = canvasTexture(512, 128, (ctx, w, h) => {
      ctx.fillStyle = '#2a4c9a';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#e3e9f5';
      ctx.lineWidth = 6;
      ctx.beginPath();
      for (let i = 0; i <= 12; i++) ctx.lineTo((i * w) / 12, i % 2 ? h * 0.85 : h * 0.15);
      ctx.stroke();
      ctx.fillStyle = '#c7b8ff';
      for (let i = 0; i < 12; i++) {
        ctx.beginPath();
        ctx.arc(((i + 0.5) * w) / 12, i % 2 ? h * 0.3 : h * 0.7, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    g.add(mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.8, 48, 1, true), std(0xffffff, { map: tex, roughness: 0.45, side: THREE.DoubleSide }), 0, 0.4, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.69, 0.69, 0.02, 48), std(0xf2ecdf, { roughness: 0.8 }), 0, 0.8, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.69, 0.69, 0.02, 48), std(0xf2ecdf), 0, 0.0, 0));
    for (const y of [0.02, 0.8]) {
      const rim = mesh(new THREE.TorusGeometry(0.71, 0.05, 10, 48), metal(COL.silver), 0, y, 0);
      rim.rotation.x = Math.PI / 2;
      g.add(rim);
    }
    const wood = std(0xd9c2a8, { roughness: 0.6 });
    for (const s of [-1, 1]) {
      const stick = new THREE.Group();
      stick.add(mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.9, 10), wood));
      stick.add(mesh(new THREE.SphereGeometry(0.06, 12, 10), std(COL.lavender), 0, 0.45, 0));
      stick.position.set(s * 0.12, 0.95, 0.1);
      stick.rotation.set(0.2, 0, s * 1.15);
      g.add(stick);
    }
    return g;
  },

  /* 24 · Corazón con estrellas orbitando */
  24() {
    const g = new THREE.Group();
    const s = new THREE.Shape();
    s.moveTo(0.25, 0.25);
    s.bezierCurveTo(0.25, 0.25, 0.2, 0, 0, 0);
    s.bezierCurveTo(-0.3, 0, -0.3, 0.35, -0.3, 0.35);
    s.bezierCurveTo(-0.3, 0.55, -0.1, 0.77, 0.25, 0.95);
    s.bezierCurveTo(0.6, 0.77, 0.8, 0.55, 0.8, 0.35);
    s.bezierCurveTo(0.8, 0.35, 0.8, 0, 0.5, 0);
    s.bezierCurveTo(0.35, 0, 0.25, 0.25, 0.25, 0.25);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.08, bevelSegments: 6, curveSegments: 24 });
    geo.center();
    geo.rotateZ(Math.PI);
    const heart = mesh(geo, metal(0xf0c8ec, { emissive: 0xd08fe0, emissiveIntensity: 0.4, roughness: 0.2, metalness: 0.6 }));
    heart.scale.setScalar(1.7);
    g.add(heart);
    const orbit = new THREE.Group();
    const st = new THREE.ExtrudeGeometry(starShape(0.1, 0.045), { depth: 0.03, bevelEnabled: false });
    st.center();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      orbit.add(mesh(st, glow(i % 2 ? COL.cyan : COL.lavender, 2), Math.cos(a) * 1.1, Math.sin(a * 2) * 0.15, Math.sin(a) * 1.1));
    }
    g.add(orbit);
    g.userData.update = (t) => {
      orbit.rotation.y = t * 0.8;
      const k = 1 + Math.max(0, Math.sin(t * 4)) * 0.06;
      heart.scale.setScalar(1.7 * k);
    };
    return g;
  },
};

/* Crea el objeto del día, centrado y escalado para el visor. */
function createDayObject(day) {
  const build = BUILDERS[day] || BUILDERS[15];
  return fit(build());
}

/* Nombres de los objetos (accesibilidad). */
const OBJECT_NAMES = [
  '', 'Copo de nieve', 'Muñeco de nieve', 'Bola de Navidad', 'Estrella', 'Trineo', 'Taza de chocolate',
  'Farolillo', 'Campana', 'Arbolito', 'Calcetín navideño', 'Vela', 'Casita nevada', 'Bola de nieve',
  'Bastón de caramelo', 'Regalo', 'Luna creciente', 'Pingüino', 'Corona de Adviento', 'Gorro de lana',
  'Cristal de hielo', 'Piña escarchada', 'Ángel', 'Tambor', 'Corazón',
];

/* Mapa de entorno procedural "noche invernal" para reflejos. */
function createEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {},
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vP;
      void main(){
        float h = vP.y;
        vec3 top = vec3(0.05,0.08,0.22);
        vec3 hor = vec3(0.30,0.40,0.70);
        vec3 bot = vec3(0.55,0.62,0.80);
        vec3 c = h > 0.0 ? mix(hor, top, pow(h, 0.6)) : mix(hor, bot, pow(-h, 0.5));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), skyMat);
  env.add(sky);
  const panels = [];
  const addPanel = (color, intensity, pos, w, h) => {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    p.position.set(...pos);
    p.lookAt(0, 0, 0);
    env.add(p);
    panels.push(p);
  };
  addPanel(0xdfeaff, 6, [-5, 6, 4], 3, 3);    // luna
  addPanel(0x7fe8ff, 2.5, [6, 2, -3], 4, 2);  // brillo cian
  addPanel(0xc7b8ff, 2.5, [-4, 1, -6], 4, 2); // brillo lavanda
  addPanel(0xffffff, 1.5, [0, 8, 0], 6, 6);
  const rt = pmrem.fromScene(env, 0.035);
  pmrem.dispose();
  sky.geometry.dispose();
  skyMat.dispose();
  panels.forEach((p) => { p.geometry.dispose(); p.material.dispose(); });
  return rt;
}

/* Libera recursos de un objeto (geometrías, materiales y texturas). */
function disposeObject(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        for (const k in m) {
          const v = m[k];
          if (v && v.isTexture) v.dispose();
        }
        m.dispose();
      });
    }
    if (o.isLight && o.dispose) o.dispose();
  });
}

window.DayObjects = { createDayObject, createEnvironment, disposeObject, OBJECT_NAMES };
})();
