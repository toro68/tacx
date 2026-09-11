export function createWorkoutController(ctx) {
  const state = ctx.state;

  function getWorkoutNowMs(nowMs) {
    if (!state.workout.running) return nowMs;
    if (!state.workout.paused) return nowMs - state.workout.pausedTotalMs;
    return state.workout.pausedAt - state.workout.pausedTotalMs;
  }

  function reapplyCurrentStep() {
    if (!state.workout.running) return;
    const step = state.workout.steps[state.workout.stepIndex];
    applyWorkoutStep(step);
  }

  function applyWorkoutStep(step) {
    if (!step) return;

    if (step.control?.mode === 'sim') {
      if (typeof ctx.setModeRadio === 'function') ctx.setModeRadio('sim');
      ctx.setModeUi('sim');
      state.sim.source = 'workout';
      if (typeof ctx.updateControlSourceUi === 'function') ctx.updateControlSourceUi();
      ctx.simAuto.checked = false;
      ctx.updateHillsUi();

      const g = ctx.clampGrade(ctx.toFloat(step.control.grade, 0));
      ctx.simGrade.value = String(Math.round(g * 10) / 10);
      const scaledGrade = ctx.setSlopeTarget(g);

      if (state.workout.resendTimerId) clearTimeout(state.workout.resendTimerId);
      if (state.workout.ackTimerId) clearTimeout(state.workout.ackTimerId);

      const activeStepIndex = state.workout.stepIndex;
      state.workout.resendTimerId = setTimeout(() => {
        if (!state.workout.running) return;
        if (state.workout.stepIndex !== activeStepIndex) return;
        if (state.mode !== 'sim') return;
        if (state.sim.source !== 'workout') return;
        ctx.setSlopeTarget(g);
      }, 450);

      const stepStartedAt = Date.now();
      state.workout.ackTimerId = setTimeout(() => {
        if (!state.workout.running) return;
        if (state.workout.stepIndex !== activeStepIndex) return;

        const lastAt = state.trainer.lastAt;
        const lastText = state.trainer.lastText;
        if (lastAt < stepStartedAt) return;

        const parsed = ctx.parseTrainerMessage(lastText);
        if (parsed.kind === 'gradeSent') return;
        if (parsed.kind === 'gradeQueuedModeMismatch') {
          if (state.db.lock) {
            ctx.xf.dispatch('ui:lock-set');
            setTimeout(() => {
              ctx.xf.dispatch('ui:mode-set', ctx.ControlMode.sim);
              ctx.xf.dispatch('ui:slope-target-set', g);
            }, 140);
            ctx.showToast('Control was locked — retried SIM grade.', 'warn', 6000);
            return;
          }
          ctx.showToast('Trainer did not switch to SIM (grade queued). Try Trainer Reset or reconnect.', 'warn', 6000);
          return;
        }
        if (parsed.kind === 'gradeQueuedNotConnected') {
          ctx.showToast('Trainer not connected (grade queued). Reconnect and try again.', 'warn', 6000);
        }
      }, 1400);

      state.workout.currentTargetText = `grade ${scaledGrade.toFixed(1)}%`;
      ctx.targetEl.textContent = state.workout.currentTargetText;
      return;
    }

    if (typeof ctx.setModeRadio === 'function') ctx.setModeRadio('workout');
    ctx.setModeUi('workout');
    if (typeof ctx.updateControlSourceUi === 'function') ctx.updateControlSourceUi();
    const base = Math.round(step.control?.watts ?? 0);
    const scaled = ctx.setPowerTarget(base);

    if (state.workout.resendTimerId) clearTimeout(state.workout.resendTimerId);
    if (state.workout.ackTimerId) clearTimeout(state.workout.ackTimerId);

    const activeStepIndex = state.workout.stepIndex;
    state.workout.resendTimerId = setTimeout(() => {
      if (!state.workout.running) return;
      if (state.workout.stepIndex !== activeStepIndex) return;
      if (state.mode !== 'workout') return;
      const again = ctx.setPowerTarget(base);
      if (again !== scaled) {
        state.workout.currentTargetText = `${again} W`;
        ctx.targetEl.textContent = state.workout.currentTargetText;
      }
    }, 450);

    const stepStartedAt = Date.now();
    state.workout.ackTimerId = setTimeout(() => {
      if (!state.workout.running) return;
      if (state.workout.stepIndex !== activeStepIndex) return;

      const lastAt = state.trainer.lastAt;
      const lastText = state.trainer.lastText;
      if (lastAt < stepStartedAt) return;

      const parsed = ctx.parseTrainerMessage(lastText);
      if (parsed.kind === 'powerSent') return;

      if (parsed.kind === 'powerQueuedModeMismatch') {
        if (state.db.lock) {
          ctx.xf.dispatch('ui:lock-set');
          setTimeout(() => {
            ctx.xf.dispatch('ui:mode-set', ctx.ControlMode.erg);
            ctx.xf.dispatch('ui:power-target-set', scaled);
          }, 140);
          ctx.showToast('Control was locked — retried ERG power target.', 'warn', 6000);
          return;
        }
        ctx.showToast('Trainer did not switch to ERG (power queued). Try Trainer Reset or reconnect.', 'warn', 6000);
        return;
      }
      if (parsed.kind === 'powerQueuedNotConnected') {
        ctx.showToast('Trainer not connected (power queued). Reconnect and try again.', 'warn', 6000);
      }
    }, 1400);

    if (base > 0 && scaled === 0 && ctx.intensityPct() === 0) {
      ctx.showToast('Intensity is 0% — ERG target becomes 0 W.', 'warn', 4500);
    }

    state.workout.currentTargetText = `${scaled} W`;
    ctx.targetEl.textContent = state.workout.currentTargetText;
  }

  function startWorkout() {
    if (state.workout.running) return;

    if (state.db.lock) {
      ctx.xf.dispatch('ui:lock-set');
      ctx.showToast('Control was locked — unlocked for workout control.', 'warn', 4500);
    }

    if (ctx.statusEl?.textContent !== 'connected') {
      ctx.showToast('Trainer not connected — workout will run, but load control may not work.', 'warn', 4500);
    }

    const w = ctx.getSelectedWorkout();
    const ftpValue = ctx.clamp(ctx.toInt(ctx.ftpEl.value, 250), 50, 2000);
    ctx.ftpEl.value = String(ftpValue);

    state.workout.lastPowerSentAt = 0;
    state.workout.lastPowerValue = null;
    state.sim.lastSentAt = 0;
    state.sim.lastSentGrade = null;

    state.workout.steps = ctx.normalizeWorkoutToSteps(w, ftpValue);
    if (!state.workout.steps.length) {
      ctx.showToast('Selected workout has no steps to run.', 'warn', 4500);
      state.workout.steps = [];
      ctx.updateWorkoutUi(performance.now());
      return;
    }

    state.workout.totalDurationSec = state.workout.steps.reduce((acc, s) => acc + (s.sec ?? 0), 0);
    state.workout.running = true;
    state.workout.paused = false;
    state.workout.pausedAt = 0;
    state.workout.pausedTotalMs = 0;
    state.workout.stepIndex = 0;
    state.workout.startAt = performance.now();
    state.workout.stepStartedAt = state.workout.startAt;
    state.workout.distanceStartM = state.totalDistanceM;
    state.workout.lastCueSec = null;

    const first = state.workout.steps[0];
    if (first?.control?.mode === 'sim') ctx.setModeRadio('sim');
    else ctx.setModeRadio('workout');
    ctx.showToast('Workout started — mode follows workout steps (ERG/SIM).', 'info', 3200);
    applyWorkoutStep(first);

    ctx.btnWorkoutPause.textContent = 'Pause';
    ctx.btnWorkoutNext.disabled = state.workout.steps.length <= 1;
    ctx.btnWorkoutPause.disabled = false;
    ctx.btnWorkoutStop.disabled = false;
    ctx.setWorkoutFocusUi(true);
    ctx.beep.play({ freq: 980, durationMs: 90, gain: 0.05 });

    state.ghost.recording = true;
    state.ghost.samples = [[0, 0]];
    state.ghost.lastSampleMs = 0;
  }

  function stopWorkout() {
    if (state.ghost.recording && ctx.ghost) {
      state.ghost.recording = false;
      const run = {
        id: ctx.ghost.ghostSelectEl?.value || undefined,
        version: 1,
        createdAt: Date.now(),
        name: state.workout.steps[0]?.name ? `Workout: ${state.workout.steps[0].name}` : '',
        routeName: state.route.name,
        samples: state.ghost.samples,
        totalTimeMs: state.ghost.samples[state.ghost.samples.length - 1]?.[0] ?? 0,
        totalDistanceM: state.ghost.samples[state.ghost.samples.length - 1]?.[1] ?? 0,
      };

      if (ctx.ghost.ghostAutoSaveEl?.checked && typeof ctx.ghost.normalizeGhostRun === 'function') {
        const normalized = ctx.ghost.normalizeGhostRun(run);
        if (normalized && typeof ctx.ghost.loadGhostLibrary === 'function' && typeof ctx.ghost.saveGhostLibrary === 'function') {
          const lib = ctx.ghost.loadGhostLibrary();
          const id = normalized.id;
          const idx = lib.findIndex((g) => g.id === id);
          const next = idx === -1 ? [normalized, ...lib] : lib.map((g, i) => i === idx ? normalized : g);
          const capped = next.slice(0, 30);
          ctx.ghost.saveGhostLibrary(capped);
          if (typeof ctx.ghost.renderGhostSelect === 'function') ctx.ghost.renderGhostSelect();
          if (ctx.ghost.ghostSelectEl) ctx.ghost.ghostSelectEl.value = id;
          if (ctx.ghost.ghostNameEl) ctx.ghost.ghostNameEl.value = normalized.name ?? '';
          state.ghost.run = normalized;
          state.ghost.enabled = !!ctx.ghost.ghostEnabledEl?.checked;
        }
      }
    }

    if (state.workout.running) {
      ctx.beep.play({ freq: 520, durationMs: 70, gain: 0.05 });
    }

    state.workout.running = false;
    state.workout.paused = false;
    state.workout.pausedAt = 0;
    state.workout.pausedTotalMs = 0;
    state.workout.steps = [];
    state.workout.stepIndex = 0;
    state.workout.startAt = 0;
    state.workout.distanceStartM = 0;
    state.workout.stepStartedAt = 0;
    state.workout.totalDurationSec = 0;
    state.workout.currentTargetText = '--';
    state.workout.lastCueSec = null;
    state.workout.lastPowerSentAt = 0;
    state.workout.lastPowerValue = null;

    if (state.workout.resendTimerId) clearTimeout(state.workout.resendTimerId);
    state.workout.resendTimerId = null;
    if (state.workout.ackTimerId) clearTimeout(state.workout.ackTimerId);
    state.workout.ackTimerId = null;

    state.sim.lastSentAt = 0;
    state.sim.lastSentGrade = null;

    ctx.targetEl.textContent = state.workout.currentTargetText;
    ctx.btnWorkoutPause.textContent = 'Pause';
    ctx.btnWorkoutNext.disabled = true;
    ctx.btnWorkoutPause.disabled = true;
    ctx.btnWorkoutStop.disabled = true;
    ctx.setWorkoutFocusUi(false);
    ctx.updateWorkoutUi(performance.now());
  }

  function togglePauseWorkout() {
    if (!state.workout.running) return;

    const now = performance.now();
    if (!state.workout.paused) {
      state.workout.paused = true;
      state.workout.pausedAt = now;
      ctx.btnWorkoutPause.textContent = 'Resume';
      ctx.beep.play({ freq: 520, durationMs: 70, gain: 0.045 });
      return;
    }

    const pausedFor = now - state.workout.pausedAt;
    state.workout.pausedTotalMs += pausedFor;
    state.workout.paused = false;
    state.workout.pausedAt = 0;
    ctx.btnWorkoutPause.textContent = 'Pause';
    state.workout.lastCueSec = null;
    ctx.beep.play({ freq: 880, durationMs: 70, gain: 0.045 });
  }

  function skipWorkoutStep() {
    if (!state.workout.running) return;

    const now = performance.now();
    const workoutNowMs = getWorkoutNowMs(now);
    const nextIndex = Math.min(state.workout.stepIndex + 1, state.workout.steps.length);
    if (nextIndex >= state.workout.steps.length) {
      stopWorkout();
      return;
    }

    state.workout.stepIndex = nextIndex;
    state.workout.stepStartedAt = workoutNowMs;
    state.workout.lastCueSec = null;
    applyWorkoutStep(state.workout.steps[nextIndex]);
    if (!state.workout.paused) {
      ctx.beep.play({ freq: 1080, durationMs: 90, gain: 0.055 });
    }
  }

  function tickWorkout(nowMs) {
    if (!state.workout.running) return;
    if (state.workout.paused) return;

    let step = state.workout.steps[state.workout.stepIndex];
    if (!step) {
      stopWorkout();
      return;
    }

    const workoutNowMs = getWorkoutNowMs(nowMs);
    const previousIndex = state.workout.stepIndex;
    // Keep interval boundaries on the workout clock, including after a delayed frame.
    while (workoutNowMs - state.workout.stepStartedAt >= step.sec * 1000) {
      state.workout.stepStartedAt += step.sec * 1000;
      state.workout.stepIndex += 1;
      step = state.workout.steps[state.workout.stepIndex];
      if (!step) {
        stopWorkout();
        return;
      }
    }
    if (state.workout.stepIndex === previousIndex) return;

    state.workout.lastCueSec = null;
    applyWorkoutStep(step);
    ctx.beep.play({ freq: 1080, durationMs: 90, gain: 0.055 });
  }

  return Object.freeze({
    applyWorkoutStep,
    startWorkout,
    stopWorkout,
    togglePauseWorkout,
    skipWorkoutStep,
    tickWorkout,
    getWorkoutNowMs,
    reapplyCurrentStep,
  });
}
