export function createSettingsController(ctx) {
  const state = ctx.state;
  const el = ctx.elements;
  const limits = ctx.limits;

  function setInvalid(inputEl, invalid) {
    if (!inputEl) return;
    inputEl.classList.toggle('invalid', !!invalid);
  }

  function validateNumberInput(inputEl, { min, max }) {
    if (!inputEl) return;
    const value = ctx.toFloat(inputEl.value, NaN);
    const invalid = !Number.isFinite(value) || value < min || value > max;
    setInvalid(inputEl, invalid);
  }

  function intensityPct() {
    return ctx.clamp(ctx.toInt(el.intensityEl?.value, 100), 0, 200);
  }

  function renderIntensityQuick() {
    if (!el.intensityLiveEl) return;
    el.intensityLiveEl.textContent = `${intensityPct()}%`;
  }

  function maybeRebuildRouteFor(routeType) {
    if (!el.simRouteEl) return;
    if (el.simRouteEl.value !== routeType) return;
    ctx.applySelectedRoute({ quiet: true });
  }

  function setIntensityPct(nextPct) {
    const pct = ctx.clamp(ctx.toInt(nextPct, 100), 0, 200);
    if (el.intensityEl) el.intensityEl.value = String(pct);
    validateNumberInput(el.intensityEl, { min: 0, max: 200 });
    renderIntensityQuick();
    persistSettings();
    ctx.applyCurrentErgStepIfRunning();
  }

  function updateWindSetting() {
    const windMps = ctx.clamp(ctx.toFloat(el.windEl?.value, 0), -20, 20);
    ctx.setWindMps(windMps);
  }

  function persistSettings() {
    const s = ctx.getRideSettings();
    ctx.saveSettings({
      virtualSpeed: s.virtualEnabled,
      weight: s.weight,
      difficultyPct: s.difficultyPct,
      intensityPct: s.intensityPct,
      ftp: ctx.clamp(ctx.toInt(el.ftpEl?.value, 250), 50, 2000),
      cda: s.cda,
      crr: s.crr,
      wind: s.wind,
      simAuto: !!el.simAutoEl?.checked,
      simRoute: el.simRouteEl?.value ?? 'mini',
      simGrade: ctx.readManualGrade({ commit: false }),
      routeSeed: String(el.routeSeedEl?.value ?? 'neo'),
      routeLengthKm: ctx.readRouteLengthKm({ commit: false }),
      routeMaxGrade: ctx.readRouteMaxGrade({ commit: false }),
      routeAssumeKmh: ctx.readRouteAssumeKmh({ commit: false }),
      workoutSound: !!el.workoutSoundEl?.checked,
      builderName: el.builderNameEl?.value ?? '',
      builderSteps: state.builder.steps,
      gfxEnhanced: !!el.gfxEnhancedEl?.checked,
      gfxLeaderboard: !!el.gfxLeaderboardEl?.checked,
      gfxCrowd: el.gfxCrowdEl?.value ?? 'many',
      ghostEnabled: !!el.ghostEnabledEl?.checked,
      ghostAutoSave: !!el.ghostAutoSaveEl?.checked,
      ghostId: el.ghostSelectEl?.value ?? '',
    });
  }

  function applyInitialSettings() {
    const initial = ctx.loadSettings();

    if (typeof initial.virtualSpeed === 'boolean' && el.virtualSpeedEl) el.virtualSpeedEl.checked = initial.virtualSpeed;
    if (typeof initial.weight === 'number' && el.weightEl) el.weightEl.value = String(initial.weight);
    if (typeof initial.difficultyPct === 'number' && el.difficultyEl) el.difficultyEl.value = String(initial.difficultyPct);
    if (typeof initial.intensityPct === 'number' && el.intensityEl) el.intensityEl.value = String(initial.intensityPct);
    if (Number.isFinite(initial.ftp) && el.ftpEl) el.ftpEl.value = String(ctx.clamp(initial.ftp, 50, 2000));
    if (typeof initial.cda === 'number' && el.cdaEl) el.cdaEl.value = String(initial.cda);
    if (typeof initial.crr === 'number' && el.crrEl) el.crrEl.value = String(initial.crr);
    if (typeof initial.wind === 'number' && el.windEl) el.windEl.value = String(initial.wind);

    if (typeof initial.simAuto === 'boolean' && el.simAutoEl) el.simAutoEl.checked = initial.simAuto;
    if (typeof initial.simRoute === 'string' && el.simRouteEl) el.simRouteEl.value = initial.simRoute;
    if (typeof initial.simGrade === 'number' && el.simGradeEl) el.simGradeEl.value = String(initial.simGrade);

    if (typeof initial.routeSeed === 'string' && el.routeSeedEl) el.routeSeedEl.value = initial.routeSeed;
    if (typeof initial.routeLengthKm === 'number' && el.routeLengthKmEl) el.routeLengthKmEl.value = String(initial.routeLengthKm);
    if (typeof initial.routeMaxGrade === 'number' && el.routeMaxGradeEl) el.routeMaxGradeEl.value = String(initial.routeMaxGrade);
    if (typeof initial.routeAssumeKmh === 'number' && el.routeAssumeKmhEl) el.routeAssumeKmhEl.value = String(initial.routeAssumeKmh);

    if (typeof initial.workoutSound === 'boolean' && el.workoutSoundEl) el.workoutSoundEl.checked = initial.workoutSound;
    if (typeof initial.builderName === 'string' && el.builderNameEl) el.builderNameEl.value = initial.builderName;
    if (Array.isArray(initial.builderSteps)) state.builder.steps = initial.builderSteps;

    if (typeof initial.gfxEnhanced === 'boolean' && el.gfxEnhancedEl) el.gfxEnhancedEl.checked = initial.gfxEnhanced;
    if (typeof initial.gfxLeaderboard === 'boolean' && el.gfxLeaderboardEl) el.gfxLeaderboardEl.checked = initial.gfxLeaderboard;
    if (typeof initial.gfxCrowd === 'string' && el.gfxCrowdEl) el.gfxCrowdEl.value = initial.gfxCrowd;

    if (typeof initial.ghostEnabled === 'boolean' && el.ghostEnabledEl) el.ghostEnabledEl.checked = initial.ghostEnabled;
    if (typeof initial.ghostAutoSave === 'boolean' && el.ghostAutoSaveEl) el.ghostAutoSaveEl.checked = initial.ghostAutoSave;

    ctx.readManualGrade();
    ctx.readRouteLengthKm();
    ctx.readRouteMaxGrade();
    ctx.readRouteAssumeKmh();
    ctx.updateHillsUi();
    ctx.applySelectedRoute({ quiet: true });
    updateWindSetting();

    validateNumberInput(el.windEl, { min: -20, max: 20 });
    validateNumberInput(el.simGradeEl, { min: limits.gradeMin, max: limits.gradeMax });
    validateNumberInput(el.routeLengthKmEl, { min: 1, max: 50 });
    validateNumberInput(el.routeMaxGradeEl, { min: 1, max: Math.max(1, Math.min(Math.abs(limits.gradeMin), limits.gradeMax)) });
    validateNumberInput(el.routeAssumeKmhEl, { min: 5, max: 60 });
    validateNumberInput(el.difficultyEl, { min: 0, max: 200 });
    validateNumberInput(el.intensityEl, { min: 0, max: 200 });
    renderIntensityQuick();

    return initial;
  }

  function bind() {
    el.windEl?.addEventListener('change', updateWindSetting);
    el.windEl?.addEventListener('blur', updateWindSetting);

    el.windEl?.addEventListener('input', () => validateNumberInput(el.windEl, { min: -20, max: 20 }));
    el.simGradeEl?.addEventListener('input', () => validateNumberInput(el.simGradeEl, { min: limits.gradeMin, max: limits.gradeMax }));
    el.simGradeEl?.addEventListener('blur', () => {
      ctx.readManualGrade();
      validateNumberInput(el.simGradeEl, { min: limits.gradeMin, max: limits.gradeMax });
      persistSettings();
    });

    el.routeSeedEl?.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      maybeRebuildRouteFor('random');
    });
    el.routeSeedEl?.addEventListener('blur', () => {
      persistSettings();
      maybeRebuildRouteFor('random');
    });

    el.routeLengthKmEl?.addEventListener('input', () => validateNumberInput(el.routeLengthKmEl, { min: 1, max: 50 }));
    el.routeLengthKmEl?.addEventListener('blur', () => {
      ctx.readRouteLengthKm();
      validateNumberInput(el.routeLengthKmEl, { min: 1, max: 50 });
      persistSettings();
      maybeRebuildRouteFor('random');
    });

    el.routeMaxGradeEl?.addEventListener('input', () => {
      const maxMagnitude = Math.max(1, Math.min(Math.abs(limits.gradeMin), limits.gradeMax));
      validateNumberInput(el.routeMaxGradeEl, { min: 1, max: maxMagnitude });
    });
    el.routeMaxGradeEl?.addEventListener('blur', () => {
      const maxMagnitude = Math.max(1, Math.min(Math.abs(limits.gradeMin), limits.gradeMax));
      ctx.readRouteMaxGrade();
      validateNumberInput(el.routeMaxGradeEl, { min: 1, max: maxMagnitude });
      persistSettings();
      maybeRebuildRouteFor('random');
    });

    el.routeAssumeKmhEl?.addEventListener('input', () => validateNumberInput(el.routeAssumeKmhEl, { min: 5, max: 60 }));
    el.routeAssumeKmhEl?.addEventListener('blur', () => {
      ctx.readRouteAssumeKmh();
      validateNumberInput(el.routeAssumeKmhEl, { min: 5, max: 60 });
      persistSettings();
      maybeRebuildRouteFor('workout');
    });

    el.difficultyEl?.addEventListener('input', () => validateNumberInput(el.difficultyEl, { min: 0, max: 200 }));
    el.intensityEl?.addEventListener('input', () => validateNumberInput(el.intensityEl, { min: 0, max: 200 }));
    el.intensityEl?.addEventListener('input', renderIntensityQuick);
    el.intensityEl?.addEventListener('change', renderIntensityQuick);
    el.intensityEl?.addEventListener('change', ctx.applyCurrentErgStepIfRunning);

    const persistEls = [
      el.virtualSpeedEl, el.weightEl, el.difficultyEl, el.intensityEl, el.ftpEl,
      el.cdaEl, el.crrEl, el.windEl,
      el.simAutoEl, el.simRouteEl, el.simGradeEl,
      el.routeSeedEl, el.routeLengthKmEl, el.routeMaxGradeEl, el.routeAssumeKmhEl,
      el.workoutSoundEl,
      el.gfxEnhancedEl, el.gfxLeaderboardEl, el.gfxCrowdEl,
      el.ghostEnabledEl, el.ghostAutoSaveEl,
    ].filter(Boolean);

    for (const x of persistEls) {
      x.addEventListener('change', persistSettings);
    }
    el.builderNameEl?.addEventListener('change', persistSettings);
  }

  return Object.freeze({
    applyInitialSettings,
    bind,
    persistSettings,
    validateNumberInput,
    intensityPct,
    renderIntensityQuick,
    setIntensityPct,
    updateWindSetting,
  });
}
