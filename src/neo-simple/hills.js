import {
  buildMiniHillsRoute,
  buildPresetRoute,
  buildRandomRoute,
  buildElevationPointsFromGradeSegments,
} from './routes.js';

export function createHillsController(ctx) {
  const state = ctx.state;

  function setRouteFromElevationPoints({ name, points }) {
    state.route.name = name;
    state.route.points = points;
    const len = points[points.length - 1]?.d ?? 0;
    state.route.lengthM = len;
    if (ctx.routeNameEl) ctx.routeNameEl.textContent = name || '--';
    if (ctx.routeLengthEl) ctx.routeLengthEl.textContent = len > 0 ? `${(len / 1000).toFixed(1)} km` : '--';
  }

  function setRouteConfigVisibility() {
    if (!ctx.simRouteEl) return;
    const v = ctx.simRouteEl.value;
    if (ctx.routeConfigRandomEl) ctx.routeConfigRandomEl.hidden = v !== 'random';
    if (ctx.routeConfigWorkoutEl) ctx.routeConfigWorkoutEl.hidden = v !== 'workout';
  }

  function updateHillsUi() {
    setRouteConfigVisibility();

    const autoOn = !!ctx.simAutoEl?.checked;
    if (ctx.simGradeEl instanceof HTMLInputElement) ctx.simGradeEl.disabled = autoOn;
    if (ctx.btnSimApplyEl instanceof HTMLButtonElement) ctx.btnSimApplyEl.disabled = autoOn;

    if (ctx.hintSimManualEl) {
      ctx.hintSimManualEl.textContent = autoOn
        ? 'Auto route is on. Disable it to use manual grade.'
        : 'Manual grade sets a fixed grade. Enable Auto route to ride the selected route.';
    }
    if (ctx.hintRouteApplyEl) {
      ctx.hintRouteApplyEl.textContent = autoOn
        ? 'Auto route is on: grade follows the route over distance.'
        : 'Auto route is off: route changes only affect the profile until Auto route is enabled.';
    }
  }

  function buildRouteFromSelectedWorkout() {
    const w = ctx.getSelectedWorkout();
    const ftpValue = ctx.toInt(ctx.ftpEl?.value, 250);
    const steps = ctx.normalizeWorkoutToSteps(w, ftpValue);
    const simSteps = steps.filter((s) => s?.control?.mode === 'sim' && typeof s.control.grade === 'number');
    if (!simSteps.length) return null;

    const assumeKmh = ctx.readRouteAssumeKmh({ commit: false });
    const assumeMps = assumeKmh / 3.6;
    const segments = simSteps.map((s) => ({
      lengthM: Math.max(10, s.sec * assumeMps),
      grade: ctx.clampGrade(s.control.grade),
    }));
    return {
      name: `Workout: ${w?.name ?? 'selected'}`,
      points: buildElevationPointsFromGradeSegments(segments),
    };
  }

  function applySelectedRoute({ quiet = false } = {}) {
    if (!ctx.simRouteEl) {
      const res = buildMiniHillsRoute();
      setRouteFromElevationPoints(res);
      return;
    }

    updateHillsUi();

    const v = ctx.simRouteEl.value;
    if (v === 'mini') {
      const res = buildMiniHillsRoute();
      setRouteFromElevationPoints(res);
    } else if (v === 'flat' || v === 'rolling' || v === 'climb' || v === 'punchy') {
      const res = buildPresetRoute(v);
      if (res) setRouteFromElevationPoints(res);
    } else if (v === 'random') {
      const seedStr = String(ctx.routeSeedEl?.value ?? 'neo');
      const lenM = ctx.clamp(ctx.readRouteLengthKm({ commit: false }) * 1000, 1000, 50000);
      const maxG = ctx.readRouteMaxGrade({ commit: false });
      const res = buildRandomRoute({ seedStr, lengthM: lenM, maxGrade: maxG, gradeMin: ctx.gradeMin, gradeMax: ctx.gradeMax });
      setRouteFromElevationPoints(res);
    } else if (v === 'workout') {
      const res = buildRouteFromSelectedWorkout();
      if (!res) {
        const fallback = buildMiniHillsRoute();
        setRouteFromElevationPoints(fallback);
        ctx.simRouteEl.value = 'mini';
        updateHillsUi();
        ctx.persistSettings();
        if (!quiet) ctx.showToast('Selected workout has no SIM (grade) steps. Using Mini Hills.', 'warn', 3500);
      } else {
        setRouteFromElevationPoints(res);
      }
    }

    ctx.drawProfile();
    if (state.mode === 'sim' && ctx.simAutoEl?.checked) {
      const g = ctx.gradeAt(state.totalDistanceM);
      ctx.setSlopeTarget(g);
    }
  }

  function buildRoute() {
    applySelectedRoute({ quiet: true });
  }

  return Object.freeze({
    buildRoute,
    updateHillsUi,
    applySelectedRoute,
  });
}
