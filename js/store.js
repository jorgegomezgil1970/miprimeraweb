/**
 * store.js — Estado único de la aplicación y persistencia en localStorage.
 *
 * Modelo de datos (versión de esquema SCHEMA_VERSION):
 * {
 *   version: 1,
 *   tasks:     [Task],      // ver tasks.js
 *   meetings:  [Meeting],   // ver meetings.js
 *   reminders: [Reminder],  // avisos independientes
 *   tags:      [{ id, name, color }],
 *   alerts: {
 *     log: [AlertEntry]     // avisos disparados (pendientes, pospuestos e historial)
 *   },
 *   settings: { sound, volume, defaultLead, onboarded, filter, lastCheck }
 * }
 *
 * Todas las mutaciones pasan por `update(fn)`, que guarda y notifica a los suscriptores.
 * Si localStorage falla (modo privado, cuota llena…), la app sigue en memoria y lo indica.
 */
(function () {
  'use strict';
  const O = window.Organiza;

  const { CATEGORY_IDS } = O.Utils;

  const SCHEMA_VERSION = 1;
  const STORAGE_KEY = 'organiza:data';

  /** Estado inicial vacío. */
  function emptyState() {
    return {
      version: SCHEMA_VERSION,
      tasks: [],
      meetings: [],
      reminders: [],
      tags: [
        { id: 'tag_urgente', name: 'urgente', color: '#ec7f6d' },
        { id: 'tag_casa', name: 'casa', color: '#7fa88a' },
        { id: 'tag_examen', name: 'examen', color: '#a38fd0' },
      ],
      alerts: { log: [] },
      settings: {
        sound: true,
        volume: 0.6,
        defaultLead: 15,
        onboarded: false,
        filter: 'all',
        lastCheck: null,
      },
    };
  }

  let state = emptyState();
  let persistent = true;           // ¿se está guardando en localStorage?
  let persistError = null;
  const listeners = new Set();

  /** Migraciones de esquema: cada función lleva de la versión N a N+1. */
  const MIGRATIONS = {
    // 0 -> 1: datos sin versión (por si hubiera una versión previa sin campo version)
    0: (s) => ({ ...emptyState(), ...s, version: 1 }),
  };

  function migrate(data) {
    let s = data;
    let v = Number(s.version) || 0;
    while (v < SCHEMA_VERSION) {
      const fn = MIGRATIONS[v];
      if (!fn) break;
      s = fn(s);
      v = s.version;
    }
    return s;
  }

  /** Normaliza y completa campos que falten para que la app sea robusta. */
  function normalize(s) {
    const base = emptyState();
    const out = {
      ...base,
      ...s,
      settings: { ...base.settings, ...(s.settings || {}) },
      alerts: { log: Array.isArray(s.alerts?.log) ? s.alerts.log : [] },
    };
    for (const key of ['tasks', 'meetings', 'reminders', 'tags']) {
      if (!Array.isArray(out[key])) out[key] = base[key];
    }
    if (!['all', ...CATEGORY_IDS].includes(out.settings.filter)) out.settings.filter = 'all';
    return out;
  }

  /**
   * Valida la forma general de una copia de seguridad importada.
   * Devuelve { ok, error, data }.
   */
  function validateBackup(raw) {
    if (!raw || typeof raw !== 'object') return { ok: false, error: 'El archivo no contiene un objeto JSON.' };
    const data = raw.data && raw.app === 'organiza' ? raw.data : raw;
    if (typeof data.version !== 'number') return { ok: false, error: 'Falta la versión de esquema.' };
    if (data.version > SCHEMA_VERSION) return { ok: false, error: 'La copia es de una versión más reciente de Organiza.' };
    for (const key of ['tasks', 'meetings', 'reminders']) {
      if (!Array.isArray(data[key])) return { ok: false, error: `Falta la lista "${key}".` };
    }
    const badTask = data.tasks.find((t) => !t || typeof t.id !== 'string' || typeof t.title !== 'string');
    if (badTask) return { ok: false, error: 'Hay tareas sin id o título.' };
    const badMeeting = data.meetings.find((m) => !m || typeof m.id !== 'string' || typeof m.date !== 'string');
    if (badMeeting) return { ok: false, error: 'Hay reuniones sin id o fecha.' };
    return { ok: true, data: normalize(migrate(data)) };
  }

  /** Carga el estado desde localStorage. */
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) state = normalize(migrate(JSON.parse(raw)));
      // prueba de escritura para detectar modo sin persistencia
      localStorage.setItem('organiza:probe', '1');
      localStorage.removeItem('organiza:probe');
      persistent = true;
    } catch (err) {
      persistent = false;
      persistError = err;
      console.warn('[Organiza] localStorage no disponible; se trabajará en memoria.', err);
    }
    return state;
  }

  function save() {
    if (!persistent) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      persistent = false;
      persistError = err;
      console.warn('[Organiza] No se pudo guardar en localStorage.', err);
      emit({ type: 'persist-error' });
    }
  }

  function emit(meta = {}) {
    for (const fn of listeners) {
      try { fn(state, meta); } catch (err) { console.error('[Organiza] Error en suscriptor', err); }
    }
  }

  /** Devuelve el estado actual (no mutar directamente; usar update). */
  function getState() { return state; }
  function isPersistent() { return persistent; }
  function getPersistError() { return persistError; }

  /**
   * Aplica una mutación sobre el estado, guarda y notifica.
   * @param {(s: object) => void} fn  función que muta el borrador
   * @param {object} meta              información para los suscriptores (tipo de cambio)
   */
  function update(fn, meta = {}) {
    fn(state);
    save();
    emit(meta);
  }

  /** Reemplaza por completo el estado (importar, borrar todo, cargar ejemplo). */
  function replace(next, meta = { type: 'replace' }) {
    state = normalize(next);
    save();
    emit(meta);
  }

  /** Suscribe una función a los cambios. Devuelve la función para desuscribirse. */
  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  /** Copia profunda sencilla (los datos son JSON puro). */
  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /** Filtro global de categoría actual. */
  function currentFilter() { return state.settings.filter; }
  function matchesFilter(item) {
    const f = state.settings.filter;
    return f === 'all' || item.category === f;
  }

  /** Genera el contenido de la copia de seguridad para exportar. */
  function exportBackup() {
    return {
      app: 'organiza',
      exportedAt: new Date().toISOString(),
      data: clone(state),
    };
  }

  /* ---------- Etiquetas ---------- */
  function tagById(id) { return state.tags.find((t) => t.id === id); }

  O.Store = { emptyState, validateBackup, load, getState, isPersistent, getPersistError, update, replace, subscribe, clone, currentFilter, matchesFilter, exportBackup, tagById, SCHEMA_VERSION };
})();
