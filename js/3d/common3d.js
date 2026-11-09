/**
 * 3d/common3d.js — Utilidades para las escenas 3D hechas SOLO con HTML + CSS 3D transforms.
 *
 * Modelo de "cámara": un contenedor con `perspective` y un "mundo" con
 *   transform: scale(--zoom) rotateX(--rx) rotateZ(--rz)
 * El plano del mundo es el suelo (x a la derecha, y hacia el espectador, z hacia arriba).
 * - box(): cubo/prisma con 5 caras (superior y 4 laterales) apoyado en z = 0.
 * - billboard: clase CSS que deshace la rotación del mundo para mirar siempre a la cámara.
 * - attachOrbit(): girar arrastrando (ratón/táctil), zoom con botones, Ctrl+rueda/pellizco y teclado.
 */
(function () {
  'use strict';
  const O = window.Organiza;
  const { prefersReducedMotion, isMobile } = O.Utils;

  /** Calidad según dispositivo: menos objetos y sin sombras en móvil. */
  function quality() {
    const mobile = isMobile();
    return {
      mobile,
      reducedMotion: prefersReducedMotion(),
      maxObjectsPerIsland: mobile ? 8 : 18,
      maxPerPile: mobile ? 3 : 5,
    };
  }

  /**
   * Devuelve el HTML de una caja 3D centrada en su posición, con la base en z = 0.
   * @param {number} w ancho (px)  @param {number} d fondo (px)  @param {number} h alto (px)
   * @param {string} cls clases extra  @param {string} color color CSS de la caja
   * @param {string} topContent HTML dentro de la cara superior
   */
  function box(w, d, h, { cls = '', color = '#ffffff', topContent = '', attrs = '' } = {}) {
    return `<div class="box3d ${cls}" style="--w:${w}px;--d:${d}px;--h:${h}px;--c:${color}" ${attrs}>
      <div class="face f-back"></div><div class="face f-left"></div><div class="face f-right"></div>
      <div class="face f-front"></div><div class="face f-top">${topContent}</div>
    </div>`;
  }

  /**
   * Activa la órbita sobre una escena.
   * @param {HTMLElement} scene  elemento con las variables --rx, --rz, --zoom
   * @param {object} limits { rx: [min, max], rz: [min, max], zoom: [min, max], initial: { rx, rz, zoom } }
   */
  function attachOrbit(scene, limits) {
    const clamp = (v, [a, b]) => Math.max(a, Math.min(b, v));
    const st = { ...limits.initial };
    const apply = () => {
      scene.style.setProperty('--rx', `${st.rx}deg`);
      scene.style.setProperty('--rz', `${st.rz}deg`);
      scene.style.setProperty('--zoom', st.zoom);
    };
    apply();

    let drag = null;
    let suppressClick = false;
    const onDown = (e) => {
      if (e.button !== 0 || e.target.closest('.s3d-tools')) return;
      drag = { x: e.clientX, y: e.clientY, rx: st.rx, rz: st.rz, id: e.pointerId, moved: false };
    };
    const onMove = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x; const dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 6) return;
      if (!drag.moved) {
        drag.moved = true;
        scene.classList.add('orbiting');
        try { scene.setPointerCapture(e.pointerId); } catch { /* sin captura */ }
      }
      st.rz = clamp(drag.rz - dx * 0.25, limits.rz);
      st.rx = clamp(drag.rx - dy * 0.25, limits.rx);
      apply();
    };
    const onUp = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (drag.moved) { suppressClick = true; setTimeout(() => { suppressClick = false; }, 0); }
      scene.classList.remove('orbiting');
      drag = null;
    };
    // Evitar que un arrastre termine "haciendo clic" en un objeto
    const onClickCapture = (e) => { if (suppressClick) { e.stopPropagation(); e.preventDefault(); } };
    // Zoom solo con Ctrl/⌘ + rueda (o pellizco en trackpad) para no secuestrar el scroll de la página
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      st.zoom = clamp(st.zoom * (e.deltaY > 0 ? 0.92 : 1.08), limits.zoom);
      apply();
    };

    // Botones de herramientas (accesibles con teclado)
    const tools = document.createElement('div');
    tools.className = 's3d-tools';
    tools.innerHTML = `
      <button type="button" class="icon-btn" data-z="in" aria-label="Acercar">${O.Illus.icon('plus', 16)}</button>
      <button type="button" class="icon-btn" data-z="out" aria-label="Alejar"><svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg></button>
      <button type="button" class="icon-btn" data-z="left" aria-label="Girar a la izquierda">${O.Illus.icon('left', 16)}</button>
      <button type="button" class="icon-btn" data-z="right" aria-label="Girar a la derecha">${O.Illus.icon('right', 16)}</button>
      <button type="button" class="icon-btn" data-z="reset" aria-label="Restablecer vista">${O.Illus.icon('repeat', 16)}</button>`;
    tools.addEventListener('click', (e) => {
      const b = e.target.closest('[data-z]'); if (!b) return;
      const a = b.dataset.z;
      if (a === 'in') st.zoom = clamp(st.zoom * 1.12, limits.zoom);
      if (a === 'out') st.zoom = clamp(st.zoom / 1.12, limits.zoom);
      if (a === 'left') st.rz = clamp(st.rz + 10, limits.rz);
      if (a === 'right') st.rz = clamp(st.rz - 10, limits.rz);
      if (a === 'reset') Object.assign(st, limits.initial);
      apply();
    });
    scene.appendChild(tools);

    scene.addEventListener('pointerdown', onDown);
    scene.addEventListener('pointermove', onMove);
    scene.addEventListener('pointerup', onUp);
    scene.addEventListener('pointercancel', onUp);
    scene.addEventListener('click', onClickCapture, true);
    scene.addEventListener('wheel', onWheel, { passive: false });

    return {
      state: st,
      apply,
      dispose() {
        scene.removeEventListener('pointerdown', onDown);
        scene.removeEventListener('pointermove', onMove);
        scene.removeEventListener('pointerup', onUp);
        scene.removeEventListener('pointercancel', onUp);
        scene.removeEventListener('click', onClickCapture, true);
        scene.removeEventListener('wheel', onWheel);
        tools.remove();
      },
    };
  }

  /** Coloca un tooltip HTML junto al elemento señalado, dentro de su contenedor posicionado. */
  function placeTooltip(tooltip, target, html) {
    if (!tooltip) return;
    if (!target) { tooltip.hidden = true; return; }
    tooltip.innerHTML = html;
    tooltip.hidden = false;
    const parent = tooltip.offsetParent?.getBoundingClientRect();
    const r = target.getBoundingClientRect();
    if (!parent) return;
    let x = r.left + r.width / 2 - parent.left - tooltip.offsetWidth / 2;
    let y = r.top - parent.top - tooltip.offsetHeight - 10;
    x = Math.max(6, Math.min(x, parent.width - tooltip.offsetWidth - 6));
    if (y < 4) y = r.bottom - parent.top + 10;
    tooltip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  /**
   * Pausa las animaciones CSS 3D cuando la pestaña no está visible
   * (equivalente a pausar requestAnimationFrame).
   */
  function watchVisibility() {
    const fn = () => document.documentElement.classList.toggle('anim-paused', document.hidden);
    document.addEventListener('visibilitychange', fn);
    fn();
  }
  watchVisibility();

  O.Scene3D = { quality, box, attachOrbit, placeTooltip };
})();
