import { clamp } from './utils.js';

export function createTrainerTargets(ctx) {
  const { state, limits } = ctx;
  const now = ctx.now ?? (() => performance.now());

  function setPowerTarget(watts, { force = false } = {}) {
    const intensity = clamp(ctx.getIntensityPct() / 100, 0, 2);
    const scaled = Math.round(clamp(watts * intensity, 0, 2500));
    const time = now();
    const last = state.workout.lastPowerValue;
    const changed = last === null || Math.abs(last - scaled) >= limits.powerDeltaMin;
    if (!force && time - state.workout.lastPowerSentAt < limits.powerThrottleMs && !changed) return scaled;
    state.workout.lastPowerSentAt = time;
    state.workout.lastPowerValue = scaled;
    ctx.sendPower(scaled);
    return scaled;
  }

  function setSlopeTarget(gradePercent, { force = false } = {}) {
    const grade = clamp(gradePercent, limits.gradeMin, limits.gradeMax);
    const difficulty = clamp(ctx.getDifficultyPct() / 100, 0, 2);
    const difficultyChanged = difficulty !== state.sim.difficulty;
    state.currentGrade = grade;
    state.sim.difficulty = difficulty;
    const scaled = clamp(grade * difficulty, limits.gradeMin, limits.gradeMax);
    const time = now();
    const last = state.sim.lastSentGrade;
    const changed = last === null || Math.abs(last - scaled) >= limits.slopeDeltaMin;
    if (!force && !difficultyChanged && time - state.sim.lastSentAt < limits.slopeThrottleMs && !changed) return scaled;
    state.sim.lastSentAt = time;
    // Compare the command sent to the trainer, including the difficulty setting.
    state.sim.lastSentGrade = scaled;
    ctx.sendSlope(scaled);
    return scaled;
  }

  return Object.freeze({ setPowerTarget, setSlopeTarget });
}
