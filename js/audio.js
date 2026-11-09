/* =====================================================================
   AUDIO — Música y efectos sintetizados con la Web Audio API
   ---------------------------------------------------------------------
   No se usa ningún archivo de sonido: todo se genera en tiempo real.
   - Música: caja de música con campanillas + colchón armónico suave,
     en bucle, con un planificador ("scheduler") preciso.
   - Efectos: brillo al pasar sobre un regalo, sonido mágico al abrirlo,
     golpe sordo al tocar uno bloqueado.
   - El estado de silencio se recuerda en localStorage.

   Política de autoplay: el AudioContext SOLO se crea tras un gesto del
   usuario (el botón "Entrar"), así los navegadores no lo bloquean.
   ===================================================================== */

const STORAGE_KEY = 'adviento.muted';

/* --- Utilidades seguras para localStorage ------------------------- */
function readMuted() {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
}
function writeMuted(value) {
  try { localStorage.setItem(STORAGE_KEY, value ? '1' : '0'); } catch { /* sin almacenamiento */ }
}

/* Convierte un nombre de nota ("F#5") en frecuencia (Hz). */
const NOTE_INDEX = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
function noteToFreq(note) {
  const m = /^([A-G]#?)(\d)$/.exec(note);
  const midi = (Number(m[2]) + 1) * 12 + NOTE_INDEX[m[1]];
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/* --- Partitura original (Re mayor, compás 4/4, en corcheas) ------- */
// Cada compás tiene 8 corcheas; null = silencio.
const MELODY = [
  ['F#5', null, 'A5', null, 'D6', null, 'C#6', 'A5'],
  ['B5', null, null, 'F#5', 'D5', null, 'F#5', null],
  ['G5', null, 'B5', null, 'D6', null, 'B5', 'A5'],
  ['A5', null, null, 'G5', 'E5', null, 'C#5', null],
  ['D5', null, 'F#5', 'A5', 'D6', null, 'E6', null],
  ['F#6', null, 'D6', null, 'B5', null, 'D6', 'C#6'],
  ['B5', null, 'D6', null, 'G5', null, 'B5', 'A5'],
  ['A5', null, 'E5', null, 'C#6', null, 'D6', null],
];
// Acordes (uno por compás) para el arpegio grave y el colchón.
const CHORDS = [
  ['D4', 'F#4', 'A4', 'C#5'],
  ['B3', 'D4', 'F#4', 'A4'],
  ['G3', 'B3', 'D4', 'F#4'],
  ['A3', 'C#4', 'E4', 'G4'],
  ['D4', 'F#4', 'A4', 'C#5'],
  ['B3', 'D4', 'F#4', 'A4'],
  ['G3', 'B3', 'D4', 'F#4'],
  ['A3', 'C#4', 'E4', 'A4'],
];
const BPM = 74;
const EIGHTH = 60 / BPM / 2;           // duración de una corchea (s)
const SPARKLE_NOTES = ['A6', 'B6', 'D7', 'E7', 'F#7', 'A7'];
const HOVER_NOTES = ['D6', 'E6', 'F#6', 'A6', 'B6', 'D7'];

class AudioManager {
  constructor() {
    this.ctx = null;
    this.muted = readMuted();
    this.musicOn = false;
    this._step = 0;
    this._nextTime = 0;
    this._timer = null;
    this._lastHover = 0;
  }

  /* Crea el contexto de audio y el grafo de mezcla.
     Debe llamarse desde un gesto del usuario (clic/toque). */
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return; // navegador sin Web Audio: la app sigue funcionando en silencio
    const ctx = new AC();
    this.ctx = ctx;

    // Bus maestro → compresor suave → altavoces
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    this.master.connect(comp).connect(ctx.destination);

    // Reverberación generada (ruido con caída exponencial)
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._makeImpulse(3.2, 2.4);
    this.reverbGain = ctx.createGain();
    this.reverbGain.gain.value = 0.45;
    this.reverb.connect(this.reverbGain).connect(this.master);

    // Buses de música y efectos
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.55;
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.8;
    for (const bus of [this.musicBus, this.sfxBus]) {
      bus.connect(this.master);
      bus.connect(this.reverb);
    }

    // Pausar el audio cuando la pestaña no está visible
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend();
      else this.ctx.resume();
    });
  }

  /* Respuesta al impulso estéreo para la reverb. */
  _makeImpulse(seconds, decay) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  /* Una nota de "caja de música": fundamental + parciales inarmónicos
     con ataque instantáneo y caída exponencial. */
  _bell(freq, time, { gain = 0.12, decay = 2.2, bus = this.musicBus, bright = 1 } = {}) {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, time);
    out.gain.exponentialRampToValueAtTime(gain, time + 0.006);
    out.gain.exponentialRampToValueAtTime(0.0001, time + decay);
    out.connect(bus);

    const partials = [
      [1, 1, 'sine'],
      [2, 0.28 * bright, 'sine'],
      [3.98, 0.12 * bright, 'sine'],   // brillo metálico típico de las láminas
      [6.1, 0.05 * bright, 'sine'],
    ];
    for (const [ratio, amp, type] of partials) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq * ratio;
      const g = ctx.createGain();
      // Los parciales agudos se apagan antes
      g.gain.setValueAtTime(amp, time);
      g.gain.exponentialRampToValueAtTime(0.0001, time + decay / (ratio > 1 ? ratio * 0.8 : 1));
      osc.connect(g).connect(out);
      osc.start(time);
      osc.stop(time + decay + 0.05);
    }
  }

  /* Colchón suave para un compás: senos ligeramente desafinados y filtrados. */
  _pad(notes, time, duration) {
    const ctx = this.ctx;
    const out = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    out.gain.setValueAtTime(0.0001, time);
    out.gain.linearRampToValueAtTime(0.035, time + duration * 0.35);
    out.gain.linearRampToValueAtTime(0.0001, time + duration + 0.9);
    filter.connect(out).connect(this.musicBus);
    for (const n of notes) {
      for (const detune of [-6, 6]) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = noteToFreq(n) / 2;
        osc.detune.value = detune;
        osc.connect(filter);
        osc.start(time);
        osc.stop(time + duration + 1);
      }
    }
  }

  /* --- Música en bucle con planificador preciso ------------------ */
  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this._step = 0;
    this._nextTime = this.ctx.currentTime + 0.15;
    const tick = () => {
      // Planifica las notas que caen en los próximos 200 ms
      while (this._nextTime < this.ctx.currentTime + 0.2) {
        if (!this.muted) this._scheduleStep(this._step, this._nextTime);
        this._step = (this._step + 1) % (MELODY.length * 8);
        this._nextTime += EIGHTH;
      }
    };
    tick();
    this._timer = setInterval(tick, 50);
  }

  stopMusic() {
    this.musicOn = false;
    clearInterval(this._timer);
  }

  _scheduleStep(step, time) {
    const bar = Math.floor(step / 8);
    const slot = step % 8;
    const note = MELODY[bar][slot];
    // Pequeño "swing" humano en el tiempo
    const human = (Math.random() - 0.5) * 0.012;
    if (note) this._bell(noteToFreq(note), time + human, { gain: 0.11, decay: 2.4 });

    const chord = CHORDS[bar];
    if (slot === 0) this._pad(chord, time, EIGHTH * 8);
    // Arpegio grave en negras
    if (slot % 2 === 0) {
      const n = chord[(slot / 2) % chord.length];
      this._bell(noteToFreq(n), time, { gain: 0.05, decay: 1.8, bright: 0.5 });
    }
    // Destellos de campanillas muy agudas, de vez en cuando
    if (slot === 5 && Math.random() < 0.35) {
      const s = SPARKLE_NOTES[Math.floor(Math.random() * SPARKLE_NOTES.length)];
      this._bell(noteToFreq(s), time, { gain: 0.025, decay: 1.4 });
    }
  }

  /* --- Silencio ----------------------------------------------------- */
  setMuted(value) {
    this.muted = !!value;
    writeMuted(this.muted);
    if (this.ctx) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setValueAtTime(this.master.gain.value, t);
      this.master.gain.linearRampToValueAtTime(this.muted ? 0 : 0.9, t + 0.4);
    }
  }
  toggleMute() { this.setMuted(!this.muted); return this.muted; }

  _ready() { return this.ctx && !this.muted && this.ctx.state === 'running'; }

  /* --- Efectos ------------------------------------------------------ */

  /* Brillo suave al pasar sobre un regalo. */
  playHover() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    if (now - this._lastHover < 0.12) return; // evita ráfagas
    this._lastHover = now;
    const start = Math.floor(Math.random() * 3);
    for (let i = 0; i < 3; i++) {
      this._bell(noteToFreq(HOVER_NOTES[start + i]), now + i * 0.055, { gain: 0.045, decay: 0.9, bus: this.sfxBus });
    }
  }

  /* Sonido mágico al abrir un regalo: barrido de aire + cascada de campanas. */
  playOpen() {
    if (!this._ready()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // "Whoosh" de ruido filtrado que sube
    const len = Math.floor(ctx.sampleRate * 1.4);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 6;
    bp.frequency.setValueAtTime(400, now);
    bp.frequency.exponentialRampToValueAtTime(6000, now + 1.1);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, now);
    ng.gain.exponentialRampToValueAtTime(0.18, now + 0.4);
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 1.35);
    noise.connect(bp).connect(ng).connect(this.sfxBus);
    noise.start(now);
    noise.stop(now + 1.4);

    // Cascada ascendente de campanillas
    const run = ['D5', 'F#5', 'A5', 'D6', 'E6', 'F#6', 'A6', 'D7', 'F#7'];
    run.forEach((n, i) => {
      this._bell(noteToFreq(n), now + 0.1 + i * 0.07, { gain: 0.07, decay: 2.2, bus: this.sfxBus });
    });
    // Acorde final brillante
    ['D6', 'F#6', 'A6', 'D7'].forEach((n) => {
      this._bell(noteToFreq(n), now + 0.85, { gain: 0.05, decay: 3.2, bus: this.sfxBus });
    });
  }

  /* Golpe sordo y breve al tocar un regalo bloqueado. */
  playLocked() {
    if (!this._ready()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.45, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 400;
    osc.connect(g).connect(lp).connect(this.master); // sin reverb: suena "seco"
    osc.start(now);
    osc.stop(now + 0.35);
    // Segundo golpecito más suave (como tocar una caja cerrada)
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(120, now + 0.12);
    osc2.frequency.exponentialRampToValueAtTime(45, now + 0.28);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.0001, now + 0.12);
    g2.gain.exponentialRampToValueAtTime(0.25, now + 0.13);
    g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
    osc2.connect(g2).connect(lp);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.45);
  }

  /* Pequeño clic cristalino para botones de la interfaz. */
  playClick() {
    if (!this._ready()) return;
    this._bell(noteToFreq('A6'), this.ctx.currentTime, { gain: 0.04, decay: 0.6, bus: this.sfxBus });
  }
}

export const audio = new AudioManager();
export default audio;
