/* =====================================================================
   ILUSTRACIONES SVG — una distinta para cada día
   ---------------------------------------------------------------------
   getIllustration(day) devuelve un string con un <svg> completo en el
   estilo "invierno mágico": fondo nocturno, estrellas, nieve y un motivo
   central dibujado a mano con formas vectoriales.
   Todos los ids internos llevan un prefijo por día para no colisionar.
   ===================================================================== */

/* Paleta compartida */
const C = {
  night: '#0b1633',
  deep: '#132654',
  ice: '#bfe6ff',
  cyan: '#7fe8ff',
  lavender: '#c7b8ff',
  silver: '#e3e9f5',
  snow: '#f7fbff',
  steel: '#8ea3c9',
  warm: '#ffe6a8',
  rose: '#ff9fc2',
};

/* Generador pseudoaleatorio con semilla (para que cada día sea estable). */
function rng(seed) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/* Estrella de N puntas como lista de puntos. */
function starPoints(cx, cy, outer, inner, n = 5, rot = -90) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = ((rot + (i * 180) / n) * Math.PI) / 180;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

/* Destello de 4 puntas pequeño. */
function sparkle(x, y, s, color = C.snow) {
  return `<path d="M${x} ${y - s} Q${x} ${y} ${x + s} ${y} Q${x} ${y} ${x} ${y + s} Q${x} ${y} ${x - s} ${y} Q${x} ${y} ${x} ${y - s}Z" fill="${color}" opacity=".9"/>`;
}

/* Marco común: fondo, estrellas, colinas nevadas y copos. */
function frame(day, content, { ground = true } = {}) {
  const p = `il${day}`;
  const r = rng(day);
  let stars = '';
  for (let i = 0; i < 26; i++) {
    const x = (r() * 190 + 5).toFixed(1);
    const y = (r() * 120 + 5).toFixed(1);
    const rad = (r() * 1.1 + 0.3).toFixed(2);
    stars += `<circle cx="${x}" cy="${y}" r="${rad}" fill="#fff" opacity="${(0.35 + r() * 0.6).toFixed(2)}"/>`;
  }
  let flakes = '';
  for (let i = 0; i < 14; i++) {
    const x = (r() * 190 + 5).toFixed(1);
    const y = (r() * 170 + 10).toFixed(1);
    flakes += `<circle cx="${x}" cy="${y}" r="${(r() * 1.6 + 0.8).toFixed(1)}" fill="${C.snow}" opacity=".75"/>`;
  }
  const hills = ground
    ? `<path d="M0 168 Q50 152 100 162 T200 156 V200 H0Z" fill="url(#${p}-snow)"/>
       <path d="M0 180 Q60 170 120 178 T200 174 V200 H0Z" fill="${C.snow}" opacity=".9"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" role="img" aria-label="Ilustración del día ${day}">
  <defs>
    <radialGradient id="${p}-bg" cx="50%" cy="35%" r="75%">
      <stop offset="0" stop-color="#2a4585"/>
      <stop offset=".55" stop-color="${C.deep}"/>
      <stop offset="1" stop-color="${C.night}"/>
    </radialGradient>
    <linearGradient id="${p}-snow" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#b9cdf0"/>
    </linearGradient>
    <linearGradient id="${p}-ice" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset=".5" stop-color="${C.ice}"/>
      <stop offset="1" stop-color="${C.lavender}"/>
    </linearGradient>
    <linearGradient id="${p}-silver" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset=".5" stop-color="${C.silver}"/>
      <stop offset="1" stop-color="${C.steel}"/>
    </linearGradient>
    <linearGradient id="${p}-blue" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#5d8fe0"/>
      <stop offset="1" stop-color="#2a4c9a"/>
    </linearGradient>
    <linearGradient id="${p}-lav" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#d9cdff"/>
      <stop offset="1" stop-color="#8f7fd6"/>
    </linearGradient>
    <radialGradient id="${p}-warm" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#fff8dc"/>
      <stop offset=".4" stop-color="${C.warm}" stop-opacity=".85"/>
      <stop offset="1" stop-color="${C.warm}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${p}-halo" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".9"/>
      <stop offset=".35" stop-color="${C.cyan}" stop-opacity=".35"/>
      <stop offset="1" stop-color="${C.cyan}" stop-opacity="0"/>
    </radialGradient>
    <filter id="${p}-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="${p}-soft" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="6"/>
    </filter>
    <clipPath id="${p}-clip"><rect width="200" height="200" rx="24"/></clipPath>
  </defs>
  <g clip-path="url(#${p}-clip)">
    <rect width="200" height="200" fill="url(#${p}-bg)"/>
    ${stars}
    ${hills}
    ${content(p)}
    ${flakes}
  </g>
  <rect x="1.5" y="1.5" width="197" height="197" rx="23" fill="none" stroke="${C.silver}" stroke-opacity=".35" stroke-width="1.5"/>
</svg>`;
}

/* ---------------------------------------------------------------------
   Los 24 motivos. Cada función recibe el prefijo de ids (p).
   --------------------------------------------------------------------- */
const MOTIFS = {
  /* 1 · Copo de nieve */
  1: (p) => {
    const arms = [0, 60, 120, 180, 240, 300].map((a) => `
      <g transform="rotate(${a})">
        <line x1="0" y1="0" x2="0" y2="-58"/>
        <polyline points="-15,-28 0,-40 15,-28"/>
        <polyline points="-10,-47 0,-55 10,-47"/>
        <line x1="0" y1="-16" x2="-8" y2="-22"/><line x1="0" y1="-16" x2="8" y2="-22"/>
      </g>`).join('');
    return `<circle cx="100" cy="92" r="70" fill="url(#${p}-halo)" opacity=".5"/>
      <g transform="translate(100 92)" stroke="#dcefff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none" filter="url(#${p}-glow)">
        ${arms}
        <circle r="9" fill="${C.snow}" stroke="none"/>
      </g>
      ${sparkle(160, 40, 7)}${sparkle(40, 150, 5)}`;
  },

  /* 2 · Muñeco de nieve */
  2: (p) => `
    <ellipse cx="100" cy="172" rx="56" ry="8" fill="#9db4de" opacity=".5"/>
    <circle cx="100" cy="140" r="36" fill="url(#${p}-snow)"/>
    <circle cx="100" cy="94" r="27" fill="url(#${p}-snow)"/>
    <circle cx="100" cy="58" r="20" fill="url(#${p}-snow)"/>
    <rect x="80" y="36" width="40" height="5" rx="2" fill="#1d2f5e"/>
    <rect x="87" y="12" width="26" height="26" rx="3" fill="#1d2f5e"/>
    <rect x="87" y="30" width="26" height="5" fill="${C.cyan}"/>
    <circle cx="93" cy="55" r="2.4" fill="#1a2240"/><circle cx="107" cy="55" r="2.4" fill="#1a2240"/>
    <path d="M100 61 L118 64 L100 66Z" fill="#ff9d5c"/>
    <path d="M92 69 Q100 74 108 69" stroke="#1a2240" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <path d="M76 78 Q100 88 124 78 L124 85 Q100 95 76 85Z" fill="${C.cyan}"/>
    <path d="M112 84 l6 26 l-9 -2 l-3 -22Z" fill="#5ec9e6"/>
    <circle cx="100" cy="94" r="2.6" fill="#1a2240"/><circle cx="100" cy="106" r="2.6" fill="#1a2240"/>
    <circle cx="100" cy="130" r="3" fill="#1a2240"/><circle cx="100" cy="145" r="3" fill="#1a2240"/>
    <path d="M74 94 L46 78 M56 84 l-6 -10 M126 94 L154 78 M144 84 l6 -10" stroke="#7a6a8f" stroke-width="3" stroke-linecap="round"/>`,

  /* 3 · Reno */
  3: (p) => `
    <g stroke="${C.silver}" stroke-width="5" stroke-linecap="round" fill="none">
      <path d="M78 66 Q62 44 66 20 M68 40 Q54 36 48 24 M66 30 Q76 22 74 12"/>
      <path d="M122 66 Q138 44 134 20 M132 40 Q146 36 152 24 M134 30 Q124 22 126 12"/>
    </g>
    <ellipse cx="70" cy="78" rx="14" ry="7" transform="rotate(-25 70 78)" fill="#b7a5e8"/>
    <ellipse cx="130" cy="78" rx="14" ry="7" transform="rotate(25 130 78)" fill="#b7a5e8"/>
    <path d="M100 62 C126 62 132 92 124 120 C118 142 108 152 100 152 C92 152 82 142 76 120 C68 92 74 62 100 62Z" fill="url(#${p}-lav)"/>
    <ellipse cx="100" cy="132" rx="18" ry="16" fill="#e6defd"/>
    <circle cx="88" cy="96" r="4" fill="#1a2240"/><circle cx="112" cy="96" r="4" fill="#1a2240"/>
    <circle cx="89.5" cy="94.5" r="1.3" fill="#fff"/><circle cx="113.5" cy="94.5" r="1.3" fill="#fff"/>
    <circle cx="100" cy="124" r="9" fill="${C.rose}" filter="url(#${p}-glow)"/>
    <path d="M78 156 Q100 166 122 156" stroke="${C.cyan}" stroke-width="6" fill="none" stroke-linecap="round"/>
    <circle cx="100" cy="166" r="6" fill="url(#${p}-silver)"/>`,

  /* 4 · Estrella */
  4: (p) => `
    <circle cx="100" cy="95" r="80" fill="url(#${p}-halo)"/>
    <polygon points="${starPoints(100, 98, 62, 26)}" fill="url(#${p}-ice)" filter="url(#${p}-glow)"/>
    <polygon points="${starPoints(100, 98, 40, 17)}" fill="#ffffff" opacity=".55"/>
    ${sparkle(40, 42, 8)}${sparkle(162, 52, 6, C.lavender)}${sparkle(150, 150, 5, C.cyan)}${sparkle(48, 140, 4)}`,

  /* 5 · Trineo */
  5: (p) => `
    <path d="M30 70 Q60 64 80 74" stroke="${C.cyan}" stroke-width="2" stroke-dasharray="3 6" fill="none" opacity=".7"/>
    <rect x="70" y="72" width="22" height="22" rx="2" fill="url(#${p}-lav)"/>
    <rect x="79" y="72" width="4" height="22" fill="${C.snow}"/>
    <rect x="92" y="62" width="26" height="32" rx="2" fill="#5ec9e6"/>
    <rect x="102" y="62" width="5" height="32" fill="${C.snow}"/>
    <path d="M44 90 L150 90 Q160 90 162 80 L166 62 Q170 56 174 64 L170 96 Q166 116 146 116 L62 116 Q48 116 44 104Z" fill="url(#${p}-blue)"/>
    <path d="M52 100 L156 100" stroke="${C.silver}" stroke-width="3" opacity=".8"/>
    <g stroke="url(#${p}-silver)" stroke-width="5" fill="none" stroke-linecap="round">
      <path d="M66 116 L66 132 M140 116 L140 132"/>
      <path d="M30 132 L160 132 Q178 132 176 118"/>
    </g>
    ${sparkle(176, 108, 6)}${sparkle(22, 60, 5, C.lavender)}`,

  /* 6 · Taza de chocolate */
  6: (p) => `
    <g fill="none" stroke="${C.silver}" stroke-width="3" stroke-linecap="round" opacity=".75">
      <path d="M86 58 Q78 46 88 36 Q96 28 88 16"/>
      <path d="M104 56 Q96 44 106 34 Q114 26 106 14"/>
      <path d="M120 58 Q114 48 122 40"/>
    </g>
    <ellipse cx="102" cy="152" rx="60" ry="10" fill="url(#${p}-silver)"/>
    <path d="M140 92 Q166 92 164 114 Q162 134 136 132" stroke="url(#${p}-blue)" stroke-width="10" fill="none"/>
    <path d="M58 70 L146 70 L140 138 Q138 150 124 150 L80 150 Q66 150 64 138Z" fill="url(#${p}-blue)"/>
    <ellipse cx="102" cy="70" rx="44" ry="8" fill="#6b3f2a"/>
    <rect x="80" y="62" width="12" height="10" rx="3" fill="${C.snow}" transform="rotate(-15 86 67)"/>
    <rect x="98" y="60" width="12" height="10" rx="3" fill="#ffe1ee"/>
    <rect x="114" y="63" width="11" height="9" rx="3" fill="${C.snow}" transform="rotate(12 119 67)"/>
    <g stroke="${C.snow}" stroke-width="3" stroke-linecap="round" opacity=".9">
      <path d="M88 100 l14 14 M102 100 l-14 14 M95 96 v22 M84 107 h22"/>
    </g>`,

  /* 7 · Farolillo */
  7: (p) => `
    <circle cx="100" cy="104" r="62" fill="url(#${p}-warm)" opacity=".7"/>
    <path d="M100 12 L100 26" stroke="${C.silver}" stroke-width="2"/>
    <circle cx="100" cy="30" r="7" fill="none" stroke="url(#${p}-silver)" stroke-width="3"/>
    <path d="M74 52 L100 36 L126 52Z" fill="url(#${p}-silver)"/>
    <rect x="70" y="52" width="60" height="8" rx="2" fill="#2a4c9a"/>
    <rect x="76" y="60" width="48" height="76" rx="3" fill="#fff6d6" opacity=".35"/>
    <rect x="76" y="60" width="48" height="76" rx="3" fill="none" stroke="#2a4c9a" stroke-width="5"/>
    <path d="M100 60 V136" stroke="#2a4c9a" stroke-width="3"/>
    <rect x="92" y="104" width="16" height="26" rx="2" fill="${C.snow}"/>
    <path d="M100 82 Q108 94 100 102 Q92 94 100 82Z" fill="${C.warm}" filter="url(#${p}-glow)"/>
    <rect x="66" y="136" width="68" height="10" rx="3" fill="#2a4c9a"/>
    <path d="M74 60 l52 0" stroke="${C.snow}" stroke-width="3" opacity=".8"/>`,

  /* 8 · Manoplas */
  8: (p) => {
    const mitten = (fill) => `
      <path d="M-22 40 L-24 -10 Q-26 -40 0 -42 Q24 -42 24 -10 L24 40Z" fill="${fill}"/>
      <path d="M-24 -4 Q-46 -10 -42 -26 Q-38 -36 -26 -24Z" fill="${fill}"/>
      <rect x="-27" y="34" width="54" height="16" rx="5" fill="${C.snow}"/>
      <g stroke="${C.snow}" stroke-width="2.4" stroke-linecap="round" opacity=".9">
        <path d="M-10 0 l20 0 M0 -10 l0 20 M-7 -7 l14 14 M7 -7 l-14 14"/>
      </g>`;
    return `
      <path d="M62 140 Q100 176 138 140" stroke="${C.silver}" stroke-width="2" fill="none"/>
      <g transform="translate(66 92) rotate(-12)">${mitten(`url(#${p}-blue)`)}</g>
      <g transform="translate(136 92) rotate(12) scale(-1 1)">${mitten(`url(#${p}-lav)`)}</g>`;
  },

  /* 9 · Árbol */
  9: (p) => `
    <rect x="92" y="140" width="16" height="22" rx="3" fill="#5a4a6a"/>
    <path d="M100 30 L140 80 L120 80 L152 118 L128 118 L162 148 L38 148 L72 118 L48 118 L80 80 L60 80Z" fill="url(#${p}-blue)"/>
    <path d="M60 80 L140 80 M48 118 L152 118" stroke="${C.snow}" stroke-width="3" opacity=".7"/>
    <path d="M70 100 Q100 112 130 98 M58 136 Q100 150 144 134" stroke="${C.silver}" stroke-width="2" fill="none" stroke-dasharray="2 4"/>
    ${[[84, 70, C.cyan], [116, 94, C.lavender], [86, 108, C.snow], [70, 132, C.rose], [128, 128, C.cyan], [104, 130, C.lavender]]
      .map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="5" fill="${c}" filter="url(#${p}-glow)"/>`).join('')}
    <polygon points="${starPoints(100, 28, 13, 5.5)}" fill="${C.warm}" filter="url(#${p}-glow)"/>`,

  /* 10 · Campana */
  10: (p) => `
    <circle cx="100" cy="100" r="66" fill="url(#${p}-halo)" opacity=".45"/>
    <path d="M100 34 Q132 34 136 74 Q138 108 152 128 Q156 136 146 138 L54 138 Q44 136 48 128 Q62 108 64 74 Q68 34 100 34Z" fill="url(#${p}-silver)"/>
    <path d="M78 52 Q72 80 70 110" stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity=".7" fill="none"/>
    <rect x="50" y="126" width="100" height="10" rx="5" fill="${C.steel}"/>
    <circle cx="100" cy="146" r="10" fill="url(#${p}-silver)"/>
    <path d="M100 34 Q80 14 70 30 Q78 40 100 34 Q120 40 130 30 Q120 14 100 34Z" fill="${C.cyan}"/>
    <circle cx="100" cy="33" r="5" fill="#5ec9e6"/>
    ${sparkle(150, 60, 7)}${sparkle(50, 156, 5, C.lavender)}`,

  /* 11 · Vela */
  11: (p) => `
    <circle cx="100" cy="64" r="48" fill="url(#${p}-warm)"/>
    <path d="M100 30 Q116 52 106 70 Q100 78 94 70 Q84 52 100 30Z" fill="${C.warm}" filter="url(#${p}-glow)"/>
    <path d="M100 48 Q106 58 102 66 Q100 69 98 66 Q94 58 100 48Z" fill="#ffffff"/>
    <path d="M100 70 V80" stroke="#3a3050" stroke-width="2"/>
    <rect x="78" y="78" width="44" height="74" rx="4" fill="url(#${p}-lav)"/>
    <path d="M78 84 Q84 96 88 84 Q92 104 96 84" fill="#e6defd"/>
    <rect x="84" y="86" width="5" height="56" rx="2" fill="#ffffff" opacity=".35"/>
    <ellipse cx="100" cy="154" rx="46" ry="10" fill="url(#${p}-silver)"/>
    <path d="M146 154 Q162 152 160 164" stroke="url(#${p}-silver)" stroke-width="5" fill="none"/>`,

  /* 12 · Casita nevada */
  12: (p) => `
    <rect x="124" y="40" width="14" height="30" fill="#5a4a6a"/>
    <g fill="${C.silver}" opacity=".5"><circle cx="134" cy="30" r="6"/><circle cx="142" cy="20" r="5"/><circle cx="150" cy="12" r="4"/></g>
    <rect x="56" y="90" width="88" height="68" fill="url(#${p}-blue)"/>
    <path d="M44 94 L100 46 L156 94Z" fill="#33508f"/>
    <path d="M40 96 Q48 88 56 92 L100 52 L144 92 Q152 88 160 96 Q156 104 148 100 Q140 108 132 100 Q120 108 110 98 Q100 106 90 98 Q80 108 68 100 Q60 108 52 100 Q44 104 40 96Z" fill="${C.snow}"/>
    <rect x="88" y="120" width="24" height="38" rx="12" fill="#1d2f5e"/>
    <circle cx="106" cy="140" r="2" fill="${C.warm}"/>
    <rect x="64" y="110" width="18" height="18" rx="2" fill="${C.warm}" filter="url(#${p}-glow)"/>
    <rect x="118" y="110" width="18" height="18" rx="2" fill="${C.warm}" filter="url(#${p}-glow)"/>
    <path d="M73 110 v18 M64 119 h18 M127 110 v18 M118 119 h18" stroke="#33508f" stroke-width="2"/>
    <circle cx="100" cy="76" r="7" fill="${C.warm}" filter="url(#${p}-glow)"/>`,

  /* 13 · Bola de Navidad */
  13: (p) => `
    <path d="M100 10 V34" stroke="${C.silver}" stroke-width="1.5"/>
    <circle cx="100" cy="30" r="5" fill="none" stroke="url(#${p}-silver)" stroke-width="2.5"/>
    <rect x="88" y="34" width="24" height="14" rx="3" fill="url(#${p}-silver)"/>
    <circle cx="100" cy="104" r="58" fill="url(#${p}-blue)"/>
    <path d="M44 92 Q100 112 156 92 M44 118 Q100 138 156 118" stroke="${C.snow}" stroke-width="4" fill="none" opacity=".85"/>
    <g fill="${C.lavender}">
      ${[62, 82, 100, 118, 138].map((x, i) => `<polygon points="${starPoints(x, 106 + (i % 2 ? 4 : 0), 6, 2.5)}"/>`).join('')}
    </g>
    <ellipse cx="78" cy="74" rx="14" ry="9" fill="#ffffff" opacity=".45" transform="rotate(-35 78 74)"/>
    ${sparkle(160, 52, 6)}`,

  /* 14 · Bastón de caramelo */
  14: (p) => `
    <g transform="rotate(-12 100 100)">
      <path d="M92 172 V70 Q92 34 120 34 Q146 34 146 62" stroke="${C.snow}" stroke-width="20" fill="none" stroke-linecap="round"/>
      <path d="M92 172 V70 Q92 34 120 34 Q146 34 146 62" stroke="#4fa8f0" stroke-width="20" fill="none" stroke-linecap="round" stroke-dasharray="10 12"/>
      <path d="M86 168 V72 Q86 40 112 38" stroke="#ffffff" stroke-width="3" fill="none" opacity=".6" stroke-linecap="round"/>
      <path d="M92 120 Q70 110 66 126 Q80 132 92 120 Q100 138 116 132 Q110 116 92 120Z" fill="${C.lavender}"/>
      <circle cx="92" cy="121" r="5" fill="#a796ee"/>
    </g>
    ${sparkle(44, 52, 7)}${sparkle(160, 140, 6, C.cyan)}`,

  /* 15 · Regalo */
  15: (p) => `
    <rect x="52" y="86" width="96" height="72" rx="4" fill="url(#${p}-lav)"/>
    <rect x="44" y="70" width="112" height="22" rx="4" fill="#a796ee"/>
    <rect x="92" y="70" width="16" height="88" fill="${C.cyan}"/>
    <path d="M100 70 Q70 36 62 58 Q60 72 100 70 Q140 72 138 58 Q130 36 100 70Z" fill="${C.cyan}"/>
    <path d="M100 70 L84 96 M100 70 L116 96" stroke="#5ec9e6" stroke-width="6" stroke-linecap="round"/>
    <circle cx="100" cy="68" r="7" fill="#5ec9e6"/>
    <g fill="${C.snow}" opacity=".7">
      <circle cx="66" cy="110" r="3"/><circle cx="130" cy="120" r="3"/><circle cx="72" cy="140" r="3"/><circle cx="124" cy="146" r="3"/>
    </g>
    ${sparkle(150, 44, 8)}${sparkle(42, 54, 5, C.lavender)}`,

  /* 16 · Luna y estrellas */
  16: (p) => `
    <circle cx="96" cy="88" r="62" fill="url(#${p}-halo)" opacity=".6"/>
    <path d="M118 36 A56 56 0 1 0 148 130 A46 46 0 1 1 118 36Z" fill="url(#${p}-silver)" filter="url(#${p}-glow)"/>
    <circle cx="80" cy="100" r="5" fill="${C.steel}" opacity=".4"/><circle cx="70" cy="76" r="3" fill="${C.steel}" opacity=".4"/>
    <path d="M92 128 Q96 124 100 128" stroke="${C.steel}" stroke-width="2" fill="none" opacity=".6"/>
    <polygon points="${starPoints(150, 62, 10, 4)}" fill="${C.warm}"/>
    <polygon points="${starPoints(160, 96, 6, 2.5)}" fill="${C.lavender}"/>
    <path d="M30 150 Q36 136 52 140 Q60 128 76 136 Q90 132 92 146 Q100 152 90 156 L36 156 Q24 156 30 150Z" fill="${C.snow}" opacity=".85"/>`,

  /* 17 · Pingüino */
  17: (p) => `
    <ellipse cx="100" cy="166" rx="40" ry="6" fill="#9db4de" opacity=".5"/>
    <ellipse cx="100" cy="110" rx="44" ry="56" fill="#1d2f5e"/>
    <ellipse cx="100" cy="122" rx="30" ry="42" fill="${C.snow}"/>
    <ellipse cx="58" cy="118" rx="10" ry="26" transform="rotate(20 58 118)" fill="#1d2f5e"/>
    <ellipse cx="142" cy="118" rx="10" ry="26" transform="rotate(-20 142 118)" fill="#1d2f5e"/>
    <circle cx="88" cy="84" r="5" fill="#ffffff"/><circle cx="112" cy="84" r="5" fill="#ffffff"/>
    <circle cx="89" cy="85" r="2.6" fill="#0b1633"/><circle cx="111" cy="85" r="2.6" fill="#0b1633"/>
    <path d="M92 94 L100 104 L108 94Z" fill="#ffb366"/>
    <circle cx="80" cy="98" r="5" fill="${C.rose}" opacity=".5"/><circle cx="120" cy="98" r="5" fill="${C.rose}" opacity=".5"/>
    <path d="M62 112 Q100 128 138 112 L138 120 Q100 136 62 120Z" fill="${C.cyan}"/>
    <path d="M120 120 l4 22 l-10 -2 l0 -18Z" fill="#5ec9e6"/>
    <ellipse cx="84" cy="164" rx="12" ry="5" fill="#ffb366"/><ellipse cx="116" cy="164" rx="12" ry="5" fill="#ffb366"/>
    <path d="M70 64 Q100 30 130 64 Z" fill="${C.lavender}"/><circle cx="100" cy="36" r="8" fill="${C.snow}"/>
    <rect x="66" y="60" width="68" height="9" rx="4" fill="${C.snow}"/>`,

  /* 18 · Corona navideña */
  18: (p) => {
    let leaves = '';
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * 360;
      const fill = i % 2 ? '#2f6b8a' : '#3f86a8';
      leaves += `<ellipse cx="100" cy="42" rx="11" ry="22" fill="${fill}" transform="rotate(${a} 100 98) rotate(${i % 2 ? 30 : -30} 100 42)"/>`;
    }
    let berries = '';
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3;
      berries += `<circle cx="${(100 + Math.cos(a) * 56).toFixed(1)}" cy="${(98 + Math.sin(a) * 56).toFixed(1)}" r="5" fill="${i % 2 ? C.lavender : C.snow}" filter="url(#${p}-glow)"/>`;
    }
    return `${leaves}${berries}
      <path d="M100 150 Q76 130 68 150 Q76 164 100 152 Q124 164 132 150 Q124 130 100 150Z" fill="${C.cyan}"/>
      <path d="M96 154 L84 182 M104 154 L116 182" stroke="${C.cyan}" stroke-width="7" stroke-linecap="round"/>
      <circle cx="100" cy="152" r="7" fill="#5ec9e6"/>`;
  },

  /* 19 · Gorro de lana */
  19: (p) => `
    <circle cx="100" cy="34" r="18" fill="${C.snow}"/>
    <circle cx="94" cy="28" r="6" fill="#ffffff"/>
    <path d="M44 132 Q46 52 100 46 Q154 52 156 132Z" fill="url(#${p}-blue)"/>
    <path d="M50 96 H150 M48 110 H152" stroke="${C.snow}" stroke-width="5"/>
    <g fill="${C.lavender}">
      ${[60, 80, 100, 120, 140].map((x) => `<polygon points="${x - 6},103 ${x},97 ${x + 6},103 ${x},109"/>`).join('')}
    </g>
    <rect x="38" y="126" width="124" height="30" rx="12" fill="${C.snow}"/>
    <g stroke="#c9d7f0" stroke-width="3">${[52, 66, 80, 94, 108, 122, 136, 150].map((x) => `<line x1="${x}" y1="130" x2="${x}" y2="152"/>`).join('')}</g>`,

  /* 20 · Patines de hielo */
  20: (p) => {
    const skate = `
      <path d="M-30 -60 L4 -60 L6 -16 Q40 -12 44 6 L44 14 L-34 14 L-34 -30Z" fill="${C.snow}"/>
      <path d="M-4 -56 L-4 -18 M-10 -48 l12 4 M-10 -38 l12 4 M-10 -28 l12 4" stroke="#8ea3c9" stroke-width="2"/>
      <rect x="-34" y="10" width="78" height="8" rx="3" fill="#33508f"/>
      <path d="M-28 18 V28 M34 18 V28" stroke="url(#${p}-silver)" stroke-width="4"/>
      <path d="M-40 30 L46 30 Q56 30 54 22" stroke="url(#${p}-silver)" stroke-width="4" fill="none" stroke-linecap="round"/>`;
    return `
      <ellipse cx="100" cy="170" rx="80" ry="10" fill="${C.ice}" opacity=".5"/>
      <path d="M62 50 Q100 18 138 50" stroke="${C.lavender}" stroke-width="2" fill="none"/>
      <g transform="translate(70 116) rotate(-6)">${skate}</g>
      <g transform="translate(132 128) rotate(8)">${skate}</g>
      ${sparkle(170, 150, 6)}${sparkle(30, 160, 5, C.cyan)}`;
  },

  /* 21 · Muérdago */
  21: (p) => `
    <path d="M100 0 V46" stroke="${C.silver}" stroke-width="2"/>
    <path d="M100 46 Q82 32 76 44 Q84 54 100 48 Q116 54 124 44 Q118 32 100 46Z" fill="${C.lavender}"/>
    <g fill="url(#${p}-blue)">
      <ellipse cx="72" cy="90" rx="13" ry="34" transform="rotate(-45 72 90)" fill="#3f86a8"/>
      <ellipse cx="128" cy="90" rx="13" ry="34" transform="rotate(45 128 90)" fill="#3f86a8"/>
      <ellipse cx="80" cy="112" rx="11" ry="30" transform="rotate(-20 80 112)" fill="#2f6b8a"/>
      <ellipse cx="120" cy="112" rx="11" ry="30" transform="rotate(20 120 112)" fill="#2f6b8a"/>
    </g>
    <path d="M100 52 Q98 90 100 120" stroke="#2f6b8a" stroke-width="4" fill="none"/>
    <g fill="${C.snow}" filter="url(#${p}-glow)">
      <circle cx="94" cy="74" r="7"/><circle cx="106" cy="78" r="7"/><circle cx="100" cy="88" r="7"/>
    </g>
    <path d="M70 160 Q78 146 92 156 Q100 140 108 156 Q122 146 130 160" stroke="${C.rose}" stroke-width="3" fill="none" opacity=".8"/>`,

  /* 22 · Ángel */
  22: (p) => `
    <circle cx="100" cy="90" r="70" fill="url(#${p}-halo)" opacity=".5"/>
    <path d="M96 84 Q50 40 34 70 Q30 100 92 104Z" fill="url(#${p}-silver)" opacity=".95"/>
    <path d="M104 84 Q150 40 166 70 Q170 100 108 104Z" fill="url(#${p}-silver)" opacity=".95"/>
    <path d="M50 70 Q66 76 84 90 M150 70 Q134 76 116 90" stroke="${C.steel}" stroke-width="2" fill="none"/>
    <path d="M100 74 L140 162 Q100 172 60 162Z" fill="url(#${p}-lav)"/>
    <path d="M70 156 Q100 166 130 156" stroke="${C.snow}" stroke-width="3" fill="none"/>
    <circle cx="100" cy="64" r="16" fill="#f6e7de"/>
    <path d="M84 62 Q86 44 100 46 Q114 44 116 62 Q110 52 100 54 Q90 52 84 62Z" fill="${C.warm}"/>
    <ellipse cx="100" cy="40" rx="18" ry="5" fill="none" stroke="${C.warm}" stroke-width="3" filter="url(#${p}-glow)"/>
    <path d="M94 66 q2 2 4 0 M102 66 q2 2 4 0" stroke="#3a3050" stroke-width="1.5" fill="none"/>
    ${sparkle(150, 140, 6)}${sparkle(44, 130, 5, C.cyan)}`,

  /* 23 · Aurora boreal */
  23: (p) => `
    <g filter="url(#${p}-soft)" opacity=".85">
      <path d="M-10 70 Q40 20 90 60 T200 40 L200 80 Q150 100 100 84 T-10 110Z" fill="${C.cyan}" opacity=".55"/>
      <path d="M-10 96 Q60 50 120 86 T210 70 L210 100 Q150 120 100 108 T-10 130Z" fill="${C.lavender}" opacity=".55"/>
    </g>
    <path d="M0 160 L40 108 L66 136 L100 90 L136 140 L160 116 L200 156 V200 H0Z" fill="#203a74"/>
    <path d="M40 108 L50 121 L44 119 L36 126 L32 118Z M100 90 L114 108 L104 104 L96 112 L90 104Z M160 116 L170 128 L162 126 L156 130Z" fill="${C.snow}"/>
    ${[30, 52, 150, 172].map((x, i) => `<path d="M${x} ${168 - (i % 2) * 4} l8 -22 l8 22Z" fill="#14285a"/>`).join('')}`,

  /* 24 · Nochebuena: pueblo bajo la estrella */
  24: (p) => {
    const house = (x, y, w, h) => `
      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#1d2f5e"/>
      <path d="M${x - 4} ${y + 2} L${x + w / 2} ${y - w * 0.45} L${x + w + 4} ${y + 2}Z" fill="#2a4c9a"/>
      <path d="M${x - 4} ${y + 2} L${x + w / 2} ${y - w * 0.45} L${x + w + 4} ${y + 2} Q${x + w / 2} ${y - 4} ${x - 4} ${y + 2}Z" fill="${C.snow}"/>
      <rect x="${x + w / 2 - 4}" y="${y + h / 2 - 4}" width="8" height="9" fill="${C.warm}" filter="url(#${p}-glow)"/>`;
    return `
      <g stroke="${C.warm}" stroke-width="1.5" opacity=".5">
        <line x1="100" y1="44" x2="100" y2="4"/><line x1="100" y1="44" x2="100" y2="92"/>
        <line x1="100" y1="44" x2="62" y2="44"/><line x1="100" y1="44" x2="138" y2="44"/>
      </g>
      <circle cx="100" cy="44" r="36" fill="url(#${p}-warm)" opacity=".6"/>
      <polygon points="${starPoints(100, 44, 18, 6, 4, -90)}" fill="#fffbe8" filter="url(#${p}-glow)"/>
      ${house(26, 132, 30, 34)}${house(66, 120, 34, 46)}${house(112, 128, 28, 38)}${house(150, 136, 30, 30)}
      <path d="M0 166 Q100 156 200 166 V200 H0Z" fill="${C.snow}"/>`;
  },
};

/* Devuelve el SVG del día (1-24). Si el día no existe, usa el copo. */
export function getIllustration(day) {
  const motif = MOTIFS[day] || MOTIFS[1];
  return frame(day, motif);
}

/* Nombre descriptivo de cada ilustración (para accesibilidad). */
export const ILLUSTRATION_NAMES = [
  '', 'Copo de nieve', 'Muñeco de nieve', 'Reno', 'Estrella', 'Trineo', 'Taza de chocolate',
  'Farolillo', 'Manoplas', 'Árbol de Navidad', 'Campana', 'Vela', 'Casita nevada',
  'Bola de Navidad', 'Bastón de caramelo', 'Regalo', 'Luna y estrellas', 'Pingüino',
  'Corona navideña', 'Gorro de lana', 'Patines de hielo', 'Muérdago', 'Ángel',
  'Aurora boreal', 'Nochebuena',
];

/* Marcador de posición para fotos que aún no existen. */
export function photoPlaceholder(day, path = `assets/photos/dia${String(day).padStart(2, '0')}.jpg`) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 220" role="img" aria-label="Espacio para la foto del día ${day}">
  <defs>
    <linearGradient id="ph-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1c3270"/><stop offset="1" stop-color="#0d1a3d"/>
    </linearGradient>
  </defs>
  <rect width="300" height="220" fill="url(#ph-bg)"/>
  <g transform="translate(150 92)" stroke="#bfe6ff" stroke-width="3" stroke-linecap="round" fill="none" opacity=".85">
    ${[0, 60, 120].map((a) => `<g transform="rotate(${a})"><line x1="0" y1="-30" x2="0" y2="30"/><polyline points="-8,-22 0,-14 8,-22"/><polyline points="-8,22 0,14 8,22"/></g>`).join('')}
  </g>
  <text x="150" y="158" text-anchor="middle" fill="#e3e9f5" font-family="Quicksand, sans-serif" font-size="15" font-weight="600">Aquí irá una foto especial</text>
  <text x="150" y="180" text-anchor="middle" fill="#8ea3c9" font-family="Quicksand, sans-serif" font-size="11">${String(path).replace(/[<&>]/g, '')}</text>
</svg>`;
}
