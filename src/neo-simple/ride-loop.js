function requiredPowerForSpeed({ v, grade, weightKg, crr, cda, wind }) {
  const g = 9.80665;
  const rho = 1.226; // kg/m^3
  const theta = Math.atan(grade / 100);
  const m = weightKg;
  const vAir = Math.max(0, v + wind);
  const fRoll = m * g * Math.cos(theta) * crr;
  const fGrav = m * g * Math.sin(theta);
  const pAero = 0.5 * rho * cda * Math.pow(vAir, 3);
  const pMech = (fRoll + fGrav) * v;
  return pMech + pAero;
}

function solveSpeedMps({ powerW, grade, settings }) {
  const weightKg = settings.weight;
  const crr = settings.crr;
  const cda = settings.cda;
  const wind = settings.wind;
  const eff = 0.97; // drivetrain
  const p = Math.max(0, powerW) * eff;
  let lo = 0;
  let hi = 60; // 216 km/h cap

  for (let i = 0; i < 26; i += 1) {
    const mid = (lo + hi) / 2;
    const req = requiredPowerForSpeed({ v: mid, grade, weightKg, crr, cda, wind });
    if (req > p) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

function ghostDistanceAt(run, tMs) {
  const samples = run?.samples;
  if (!samples?.length) return 0;
  if (tMs <= samples[0][0]) return samples[0][1];
  const last = samples[samples.length - 1];
  if (tMs >= last[0]) return last[1];
  for (let i = 1; i < samples.length; i += 1) {
    const a = samples[i - 1];
    const b = samples[i];
    if (tMs <= b[0]) {
      const span = b[0] - a[0];
      const t = span > 0 ? (tMs - a[0]) / span : 0;
      return a[1] + (b[1] - a[1]) * t;
    }
  }
  return last[1];
}

export function createRideLoop(ctx) {
  const state = ctx.state;
  let last = performance.now();
  let rafId = null;

  function loop(now) {
    const dt = ctx.clamp((now - last) / 1000, 0, 1);
    last = now;

    const rideSettings = ctx.getRideSettings();
    state.virtual.enabled = rideSettings.virtualEnabled;
    state.sim.difficulty = ctx.clamp(rideSettings.difficultyPct / 100, 0, 2);

    const vMps = state.virtual.enabled
      ? solveSpeedMps({ powerW: state.powerW, grade: state.currentGrade, settings: rideSettings })
      : state.speedMeasuredKmh / 3.6;

    const alpha = ctx.clamp(dt * 2.5, 0, 1);
    state.virtual.mps = state.virtual.enabled ? state.virtual.mps + (vMps - state.virtual.mps) * alpha : vMps;
    const speedMps = state.virtual.enabled ? state.virtual.mps : vMps;

    state.mps = speedMps;
    state.kmh = speedMps * 3.6;
    ctx.speedEl.textContent = Number.isFinite(state.kmh) ? String(Math.round(state.kmh)) : '--';

    const wkg = rideSettings.weight > 0 ? state.powerW / rideSettings.weight : NaN;
    ctx.wkgEl.textContent = Number.isFinite(wkg) ? wkg.toFixed(1) : '--';

    if (state.workout.running) {
      ctx.tickWorkout(now);
    } else {
      ctx.tickRoute(dt);
    }

    const distanceDt = state.workout.running && state.workout.paused ? 0 : dt;
    const nextDistance = state.totalDistanceM + speedMps * distanceDt;
    state.totalDistanceM = Number.isFinite(nextDistance) ? nextDistance : state.totalDistanceM;

    if (state.workout.running) {
      const workoutNowMs = ctx.getWorkoutNowMs(now);
      const tMs = Math.max(0, workoutNowMs - state.workout.startAt);
      const dM = Math.max(0, state.totalDistanceM - state.workout.distanceStartM);

      if (state.ghost.recording && !state.workout.paused) {
        if (tMs - state.ghost.lastSampleMs >= 1000) {
          state.ghost.samples.push([Math.round(tMs), dM]);
          state.ghost.lastSampleMs = tMs;
        }
      }

      if (state.ghost.enabled && state.ghost.run) {
        const ghostD = ghostDistanceAt(state.ghost.run, tMs);
        state.ghost.relM = ghostD - dM;
      } else {
        state.ghost.relM = null;
      }
    } else {
      state.ghost.relM = null;
      state.ghost.recording = false;
    }

    if (state.mode === 'sim' && state.sim.source === 'route' && ctx.simAutoEl.checked) {
      const wrapped = state.route.lengthM > 0 ? state.totalDistanceM % state.route.lengthM : state.totalDistanceM;
      const g = ctx.clampGrade(ctx.gradeAt(wrapped));
      state.currentGrade = g;
      ctx.gradeEl.textContent = g.toFixed(1);
    }

    ctx.updateWorkoutUi(now);
    ctx.updateDistanceUi();
    ctx.drawProfile();
    ctx.drawRide(dt);
    if (state.workout.running) {
      const ftpValue = ctx.clamp(ctx.toInt(ctx.ftpEl.value, 250), 50, 2000);
      ctx.drawWorkoutTimeline({ steps: state.workout.steps, ftpValue, nowMs: now });
    }

    rafId = requestAnimationFrame(loop);
  }

  function start() {
    if (rafId) return;
    last = performance.now();
    rafId = requestAnimationFrame(loop);
  }

  function stop() {
    if (!rafId) return;
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  return Object.freeze({
    start,
    stop,
  });
}
