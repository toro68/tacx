export function createBuilderController(ctx) {
  const state = ctx.state;
  const els = ctx.elements;
  const limits = ctx.limits;

  function formatTotalDuration(sec) {
    return ctx.formatElapsed(sec);
  }

  function renderBuilder() {
    const steps = state.builder.steps;
    els.builderRowsEl.innerHTML = '';

    const totalSec = steps.reduce((acc, s) => acc + (s.sec ?? 0), 0);
    els.builderTotalEl.textContent = formatTotalDuration(totalSec);

    for (let i = 0; i < steps.length; i += 1) {
      const s = steps[i];
      const row = document.createElement('div');
      row.className = 'data-tile';
      row.style.padding = '10px';
      row.dataset.id = s.id;

      const typeLabel = s.type === 'sim' ? 'SIM' : 'ERG';
      const valueLabel = s.type === 'sim' ? 'Grade %' : '%FTP';
      const value = s.type === 'sim' ? s.grade : s.percent;

      row.innerHTML = `
        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
          <strong style="min-width: 52px;">${typeLabel}</strong>
          <label>
            Name
            <input class="input" data-field="name" type="text" value="${(s.name ?? '').replace(/"/g, '&quot;')}" style="width: 200px; margin-left: 8px;" />
          </label>
          <label>
            Sec
            <input class="input" data-field="sec" type="number" inputmode="numeric" min="5" step="1" value="${s.sec}" style="width: 100px; margin-left: 8px;" />
          </label>
          <label>
            ${valueLabel}
            <input class="input" data-field="${s.type === 'sim' ? 'grade' : 'percent'}" type="number" inputmode="decimal" ${s.type === 'sim' ? `min="${limits.gradeMin}" max="${limits.gradeMax}" step="0.1"` : 'min="0" max="200" step="1"'} value="${value}" style="width: 110px; margin-left: 8px;" />
          </label>
          <button class="button" data-action="up" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button class="button" data-action="down" ${i === steps.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="button" data-action="remove">Remove</button>
        </div>
      `;
      els.builderRowsEl.appendChild(row);
    }
  }

  function addBuilderErgStep() {
    state.builder.steps.push({
      id: ctx.uid(),
      type: 'erg',
      name: 'Steady',
      sec: 300,
      percent: 65,
    });
    renderBuilder();
  }

  function addBuilderSimStep() {
    state.builder.steps.push({
      id: ctx.uid(),
      type: 'sim',
      name: 'Hill',
      sec: 180,
      grade: 4.0,
    });
    renderBuilder();
  }

  function clearBuilder() {
    state.builder.steps = [];
    renderBuilder();
  }

  function buildWorkoutObjectFromBuilder() {
    const name = (els.builderNameEl.value || 'My workout').trim();
    const steps = state.builder.steps;

    const intervals = steps
      .map((s) => {
        const duration = ctx.clamp(ctx.toInt(s.sec, 0), 0, 6 * 60 * 60);
        if (!duration) return null;

        if (s.type === 'sim') {
          const grade = ctx.clampGrade(ctx.toFloat(s.grade, 0));
          return { duration, steps: [{ duration, slope: grade }] };
        }

        const percent = ctx.clamp(ctx.toFloat(s.percent, 0), 0, 200);
        const power = percent / 100;
        return { duration, steps: [{ duration, power }] };
      })
      .filter(Boolean);

    const totalDuration = intervals.reduce((acc, i) => acc + (i.duration ?? 0), 0);
    return {
      meta: {
        author: 'NEO Simple',
        name,
        description: 'Built in NEO Simple',
        category: 'Custom',
        subcategory: '',
        sportType: 'bike',
        duration: totalDuration,
      },
      intervals,
    };
  }

  function workoutObjectToZwoXml(workoutObject) {
    return ctx.zwo.write(ctx.zwo.fromInterval(workoutObject));
  }

  function downloadTextFile({ name, text, mime = 'application/xml' }) {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function bind() {
    els.builderAddErgEl.addEventListener('click', () => {
      addBuilderErgStep();
      ctx.persistSettings();
    });
    els.builderAddSimEl.addEventListener('click', () => {
      addBuilderSimStep();
      ctx.persistSettings();
    });
    els.builderClearEl.addEventListener('click', () => {
      if (state.builder.steps.length) {
        const ok = window.confirm('Clear workout builder steps?');
        if (!ok) return;
      }
      clearBuilder();
      ctx.persistSettings();
      ctx.showToast('Builder cleared.', 'ok', 2500);
    });
    els.builderExportEl.addEventListener('click', () => {
      if (!state.builder.steps.length) {
        ctx.showToast('Add at least one step first.', 'warn', 3500);
        return;
      }
      const workoutObject = buildWorkoutObjectFromBuilder();
      const xml = workoutObjectToZwoXml(workoutObject);
      const safeName = workoutObject.meta.name.replace(/[^\w.-]+/g, '_').slice(0, 64) || 'workout';
      downloadTextFile({ name: `${safeName}.zwo`, text: xml });
      ctx.showToast(`Exported ${safeName}.zwo`, 'ok', 2500);
    });
    els.builderLoadEl.addEventListener('click', () => {
      if (!state.builder.steps.length) {
        ctx.showToast('Add at least one step first.', 'warn', 3500);
        return;
      }
      const workoutObject = buildWorkoutObjectFromBuilder();
      const xml = workoutObjectToZwoXml(workoutObject);
      const parsed = ctx.zwo.readToInterval(xml);
      const id = `zwo:${Math.random().toString(16).slice(2)}`;
      ctx.workoutLibrary.unshift({
        id,
        type: 'zwo',
        name: `${workoutObject.meta.name} (builder)`,
        ...parsed,
      });
      ctx.populateWorkouts();
      els.workoutSelectEl.value = id;
      ctx.showToast(`Loaded into player: ${workoutObject.meta.name}`, 'ok', 2500);
      ctx.persistSettings();
    });

    els.builderRowsEl.addEventListener('click', (e) => {
      const btn = e.target instanceof HTMLElement ? e.target.closest('button[data-action]') : null;
      if (!btn) return;
      const row = btn.closest('[data-id]');
      const id = row?.dataset?.id;
      if (!id) return;

      const steps = state.builder.steps;
      const idx = steps.findIndex((s) => s.id === id);
      if (idx === -1) return;

      const action = btn.dataset.action;
      if (action === 'remove') {
        steps.splice(idx, 1);
        renderBuilder();
        ctx.persistSettings();
        return;
      }
      if (action === 'up' && idx > 0) {
        const [x] = steps.splice(idx, 1);
        steps.splice(idx - 1, 0, x);
        renderBuilder();
        ctx.persistSettings();
        return;
      }
      if (action === 'down' && idx < steps.length - 1) {
        const [x] = steps.splice(idx, 1);
        steps.splice(idx + 1, 0, x);
        renderBuilder();
        ctx.persistSettings();
      }
    });

    els.builderRowsEl.addEventListener('input', (e) => {
      const input = e.target instanceof HTMLInputElement ? e.target : null;
      if (!input) return;
      const row = input.closest('[data-id]');
      const id = row?.dataset?.id;
      const field = input.dataset.field;
      if (!id || !field) return;

      const step = state.builder.steps.find((s) => s.id === id);
      if (!step) return;

      if (field === 'name') {
        step.name = input.value;
        ctx.persistSettings();
        return;
      }
      if (field === 'sec') {
        step.sec = ctx.clamp(ctx.toInt(input.value, step.sec ?? 60), 5, 6 * 60 * 60);
        renderBuilder();
        ctx.persistSettings();
        return;
      }
      if (field === 'percent') {
        step.percent = ctx.clamp(ctx.toFloat(input.value, step.percent ?? 60), 0, 200);
        ctx.persistSettings();
        return;
      }
      if (field === 'grade') {
        step.grade = ctx.clampGrade(ctx.toFloat(input.value, step.grade ?? 0));
        ctx.persistSettings();
      }
    });
  }

  return Object.freeze({
    bind,
    renderBuilder,
    clearBuilder,
  });
}
