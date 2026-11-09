/**
 * settings.js — Vista "Ajustes": sonido, antelación por defecto, etiquetas,
 * exportar/importar copia de seguridad, datos de ejemplo y borrado total.
 */
(function () {
  'use strict';
  const O = window.Organiza;

  const { getState, update, replace, emptyState, exportBackup, validateBackup, isPersistent } = O.Store;
  const { esc, uid, todayISO, addDays, LEAD_OPTIONS, toTime } = O.Utils;
  const { icon } = O.Illus;
  const { toast, confirmDialog } = O.UI;
  const Tasks = O.lazy('Tasks');
  const { playChime, checkNow } = O.Reminders;

  /* ================================================================== */
  /* Datos de ejemplo                                                    */
  /* ================================================================== */
  function sampleData() {
    const s = emptyState();
    const d = (n) => addDays(todayISO(), n);
    const now = new Date().toISOString();
    const tg = {
      urgente: s.tags[0].id, casa: s.tags[1].id, examen: s.tags[2].id,
      cliente: 'tag_cliente', lectura: 'tag_lectura',
    };
    s.tags.push({ id: tg.cliente, name: 'cliente', color: '#6b9bd1' }, { id: tg.lectura, name: 'lectura', color: '#e8b04b' });
    const inHour = new Date(Date.now() + 45 * 60000);
    const task = (o) => ({
      id: uid('t'), description: '', tags: [], dueTime: '', status: 'pending', subtasks: [],
      recurrence: { type: 'none', days: [] }, reminder: null, createdAt: now, updatedAt: now, completedAt: null, ...o,
    });
    const st = (text, done = false) => ({ id: uid('st'), text, done });
    s.tasks = [
      task({ title: 'Preparar presentación trimestral', category: 'trabajo', priority: 'alta', dueDate: d(0), dueTime: '17:00', tags: [tg.cliente, tg.urgente], status: 'doing', reminder: 30,
        description: 'Resultados del trimestre y objetivos del siguiente.', subtasks: [st('Recopilar datos de ventas', true), st('Diseñar diapositivas', true), st('Ensayar', false)] }),
      task({ title: 'Responder correos pendientes', category: 'trabajo', priority: 'media', dueDate: d(0), dueTime: '12:00', recurrence: { type: 'daily', days: [] } }),
      task({ title: 'Revisar contrato del proveedor', category: 'trabajo', priority: 'baja', dueDate: d(3), tags: [tg.cliente] }),
      task({ title: 'Informe de incidencias', category: 'trabajo', priority: 'alta', dueDate: d(-1), dueTime: '18:00' }),
      task({ title: 'Comprar fruta y verdura', category: 'personal', priority: 'media', dueDate: d(0), tags: [tg.casa],
        subtasks: [st('Manzanas'), st('Espinacas'), st('Tomates', true)] }),
      task({ title: 'Salir a correr', category: 'personal', priority: 'baja', dueDate: d(1), dueTime: '07:30', recurrence: { type: 'weekly', days: [1, 3, 5] }, reminder: 15 }),
      task({ title: 'Pagar factura de la luz', category: 'personal', priority: 'alta', dueDate: d(2), reminder: 1440, tags: [tg.casa] }),
      task({ title: 'Llamar a la abuela', category: 'personal', priority: 'media', dueDate: d(5), status: 'done', completedAt: now }),
      task({ title: 'Estudiar tema 4 de Estadística', category: 'estudio', priority: 'alta', dueDate: d(1), dueTime: '19:00', tags: [tg.examen], reminder: 60,
        subtasks: [st('Leer apuntes', true), st('Hacer ejercicios 1–10'), st('Resumen')] }),
      task({ title: 'Leer capítulo 3 de «Clean Code»', category: 'estudio', priority: 'baja', dueDate: d(4), tags: [tg.lectura] }),
      task({ title: 'Entregar práctica de programación', category: 'estudio', priority: 'alta', dueDate: d(6), dueTime: '23:59', tags: [tg.examen], status: 'doing' }),
      task({ title: 'Repasar vocabulario de inglés', category: 'estudio', priority: 'media', dueDate: d(0), recurrence: { type: 'daily', days: [] }, status: 'done', completedAt: now }),
    ];
    const meet = (o) => ({ id: uid('m'), location: '', participants: '', notes: '', reminder: 15, createdAt: now, updatedAt: now, ...o });
    s.meetings = [
      meet({ title: 'Reunión de equipo', category: 'trabajo', date: d(0), start: '10:00', end: '11:00', location: 'Sala Norte', participants: 'Equipo de producto' }),
      meet({ title: 'Llamada con cliente', category: 'trabajo', date: d(0), start: '10:30', end: '11:15', location: 'https://meet.example.com/abc', participants: 'Laura (cliente)', notes: 'Revisar el alcance de la fase 2.' }),
      meet({ title: 'Tutoría de TFG', category: 'estudio', date: d(2), start: '16:00', end: '17:00', location: 'Despacho 2.14', participants: 'Dra. Martín' }),
      meet({ title: 'Grupo de estudio', category: 'estudio', date: d(4), start: '18:00', end: '20:00', location: 'Biblioteca' }),
      meet({ title: 'Cena con amigos', category: 'personal', date: d(3), start: '21:00', end: '23:00', location: 'Restaurante La Huerta', reminder: 60 }),
      meet({ title: 'Revisión de diseño', category: 'trabajo', date: d(1), start: '12:00', end: '13:30', location: 'Online' }),
    ];
    s.reminders = [
      { id: uid('r'), title: 'Tomar la medicación', category: 'personal', date: toISO(inHour), time: toTime(inHour), lead: 0, done: false, createdAt: now },
      { id: uid('r'), title: 'Inscripción al curso de verano', category: 'estudio', date: d(2), time: '09:00', lead: 0, done: false, createdAt: now },
      { id: uid('r'), title: 'Enviar horas al departamento', category: 'trabajo', date: d(1), time: '16:00', lead: 5, done: false, createdAt: now },
    ];
    s.settings = { ...getState().settings, onboarded: true };
    return s;
  }
  function toISO(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }

  async function loadSample({ ask = true } = {}) {
    const st = getState();
    const hasData = st.tasks.length || st.meetings.length || st.reminders.length;
    if (ask && hasData) {
      const ok = await confirmDialog({ title: 'Cargar ejemplo', message: 'Los datos actuales se sustituirán por los de ejemplo. ¿Continuar?', confirmLabel: 'Cargar ejemplo', danger: true });
      if (!ok) return;
    }
    replace(sampleData());
    checkNow();
    toast({ message: 'Datos de ejemplo cargados', type: 'success' });
  }

  /* ================================================================== */
  /* Exportar / importar                                                 */
  /* ================================================================== */
  function downloadJSON() {
    const blob = new Blob([JSON.stringify(exportBackup(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `organiza-copia-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast({ message: 'Copia de seguridad descargada', type: 'success' });
  }

  async function importFile(file) {
    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      toast({ type: 'error', title: 'No se pudo importar', message: 'El archivo no es un JSON válido.' });
      return;
    }
    const res = validateBackup(parsed);
    if (!res.ok) { toast({ type: 'error', title: 'Copia no válida', message: res.error, duration: 6000 }); return; }
    const d = res.data;
    const ok = await confirmDialog({
      title: 'Importar copia de seguridad',
      message: `Se importarán ${d.tasks.length} tareas, ${d.meetings.length} reuniones y ${d.reminders.length} avisos. Los datos actuales se sobrescribirán. ¿Continuar?`,
      confirmLabel: 'Importar y sobrescribir', danger: true,
    });
    if (!ok) return;
    replace(d);
    checkNow();
    toast({ message: 'Datos importados correctamente', type: 'success' });
  }

  async function clearAll() {
    const ok1 = await confirmDialog({ title: 'Borrar todos los datos', message: 'Se eliminarán todas las tareas, reuniones, avisos y etiquetas.', confirmLabel: 'Continuar', danger: true });
    if (!ok1) return;
    const ok2 = await confirmDialog({ title: 'Última confirmación', message: 'Esta acción no se puede deshacer. ¿Borrar definitivamente?', confirmLabel: 'Sí, borrar todo', danger: true });
    if (!ok2) return;
    const fresh = emptyState();
    fresh.settings.onboarded = true;
    replace(fresh);
    toast({ message: 'Se han borrado todos los datos', type: 'success' });
  }

  /* ================================================================== */
  /* Vista                                                               */
  /* ================================================================== */
  const SettingsView = {
    el: null,
    mount(el) {
      this.el = el;
      const st = getState().settings;
      el.innerHTML = `
        <header class="view-header"><div><h1>Ajustes</h1><p class="muted">Preferencias y datos de Organiza.</p></div></header>
        ${isPersistent() ? '' : `<p class="notice warning">${icon('warning', 18)} El almacenamiento local no está disponible: los cambios se perderán al cerrar la pestaña. Exporta una copia para conservarlos.</p>`}
        <div class="settings-grid">
          <section class="panel" aria-labelledby="set-sound">
            <h2 id="set-sound">${icon('sound', 18)} Sonido de los avisos</h2>
            <label class="switch"><input type="checkbox" id="set-sound-on" ${st.sound ? 'checked' : ''}><span class="switch-track" aria-hidden="true"></span><span>Reproducir sonido</span></label>
            <div class="field"><label for="set-volume">Volumen: <output id="set-volume-out">${Math.round(st.volume * 100)}%</output></label>
              <input type="range" id="set-volume" min="0" max="1" step="0.05" value="${st.volume}"></div>
            <button type="button" class="btn btn-ghost" id="set-test">${icon('bell', 16)} Probar sonido</button>
          </section>
          <section class="panel" aria-labelledby="set-lead-h">
            <h2 id="set-lead-h">${icon('clock', 18)} Antelación por defecto</h2>
            <div class="field"><label for="set-lead">Para tareas y reuniones nuevas</label>
              <select id="set-lead">${LEAD_OPTIONS.map((o) => `<option value="${o.value}" ${st.defaultLead === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}</select></div>
            <p class="muted small">Las tareas sin hora avisan tomando como referencia las 09:00 de su fecha.</p>
          </section>
          <section class="panel span-2" aria-labelledby="set-tags-h">
            <h2 id="set-tags-h">${icon('tag', 18)} Etiquetas</h2>
            <ul class="tag-manager" id="set-tags"></ul>
            <form class="inline-add" id="set-tag-form">
              <label for="set-tag-name" class="sr-only">Nombre de la etiqueta</label>
              <input id="set-tag-name" placeholder="Nueva etiqueta" maxlength="24" required>
              <input type="color" id="set-tag-color" value="#a38fd0" aria-label="Color de la etiqueta">
              <button class="btn btn-sm btn-primary">${icon('plus', 16)} Crear</button>
            </form>
          </section>
          <section class="panel span-2" aria-labelledby="set-data-h">
            <h2 id="set-data-h">${icon('download', 18)} Datos</h2>
            <div class="button-row">
              <button type="button" class="btn btn-ghost" id="set-export">${icon('download', 16)} Exportar copia (JSON)</button>
              <label class="btn btn-ghost file-btn">${icon('upload', 16)} Importar JSON
                <input type="file" accept="application/json,.json" id="set-import" class="sr-only"></label>
              <button type="button" class="btn btn-ghost" id="set-sample">${icon('sparkle', 16)} Cargar ejemplo</button>
              <button type="button" class="btn btn-ghost" id="set-tour">${icon('home', 16)} Ver bienvenida</button>
              <button type="button" class="btn btn-danger" id="set-clear">${icon('trash', 16)} Borrar todos los datos</button>
            </div>
            <p class="muted small">Todo se guarda en este navegador (localStorage). Esquema de datos v${getState().version}.</p>
          </section>
        </div>`;

      const $ = (sel) => el.querySelector(sel);
      $('#set-sound-on').addEventListener('change', (e) => update((s) => { s.settings.sound = e.target.checked; }, { type: 'settings' }));
      $('#set-volume').addEventListener('input', (e) => {
        $('#set-volume-out').textContent = `${Math.round(e.target.value * 100)}%`;
      });
      $('#set-volume').addEventListener('change', (e) => update((s) => { s.settings.volume = Number(e.target.value); }, { type: 'settings' }));
      $('#set-test').addEventListener('click', () => playChime(true));
      $('#set-lead').addEventListener('change', (e) => update((s) => { s.settings.defaultLead = Number(e.target.value); }, { type: 'settings' }));
      $('#set-export').addEventListener('click', downloadJSON);
      $('#set-import').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) importFile(f); e.target.value = ''; });
      $('#set-sample').addEventListener('click', () => loadSample());
      $('#set-clear').addEventListener('click', clearAll);
      $('#set-tour').addEventListener('click', () => window.dispatchEvent(new CustomEvent('organiza:onboarding')));
      $('#set-tag-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = $('#set-tag-name').value.trim();
        if (!name) return;
        Tasks.createTag(name, $('#set-tag-color').value);
        $('#set-tag-name').value = '';
      });
      $('#set-tags').addEventListener('change', (e) => {
        const li = e.target.closest('[data-tag]'); if (!li) return;
        if (e.target.matches('input[type=color]')) Tasks.setTagColor(li.dataset.tag, e.target.value);
        if (e.target.matches('input[type=text]')) Tasks.renameTag(li.dataset.tag, e.target.value);
      });
      $('#set-tags').addEventListener('click', async (e) => {
        const b = e.target.closest('[data-del-tag]'); if (!b) return;
        const li = b.closest('[data-tag]');
        const tag = getState().tags.find((t) => t.id === li.dataset.tag);
        const ok = await confirmDialog({ title: 'Borrar etiqueta', message: `Se quitará «${tag.name}» de todas las tareas.`, confirmLabel: 'Borrar', danger: true });
        if (ok) Tasks.deleteTag(tag.id);
      });
      this.update();
    },
    update(meta = {}) {
      if (!this.el) return;
      // Evitar re-pintar la lista mientras se escribe el nombre de una etiqueta
      if (meta.type === 'settings') return;
      const tags = getState().tags;
      const counts = Object.fromEntries(tags.map((t) => [t.id, getState().tasks.filter((x) => x.tags.includes(t.id)).length]));
      this.el.querySelector('#set-tags').innerHTML = tags.length ? tags.map((t) => `<li data-tag="${t.id}" style="--tag:${esc(t.color)}">
        <input type="color" value="${esc(t.color)}" aria-label="Color de ${esc(t.name)}">
        <label class="sr-only" for="tagname-${t.id}">Nombre de la etiqueta</label>
        <input type="text" id="tagname-${t.id}" value="${esc(t.name)}" maxlength="24">
        <span class="muted small">${counts[t.id]} tareas</span>
        <button type="button" class="icon-btn danger" data-del-tag aria-label="Borrar etiqueta ${esc(t.name)}">${icon('trash', 16)}</button>
      </li>`).join('') : '<li class="muted">No hay etiquetas.</li>';
    },
    unmount() { this.el = null; },
  };

  O.Settings = { sampleData, loadSample, SettingsView };
})();
