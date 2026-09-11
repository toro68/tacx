import { createTrainerTargets } from '../../src/neo-simple/trainer-targets.js';

describe('trainer load adjustments', () => {
  let state;
  let ctx;
  let targets;
  let intensity;
  let difficulty;
  let time;

  beforeEach(() => {
    time = 1000;
    intensity = 100;
    difficulty = 100;
    state = {
      workout: { lastPowerSentAt: 0, lastPowerValue: null },
      sim: { lastSentAt: 0, lastSentGrade: null, difficulty: 1 },
    };
    ctx = {
      state,
      limits: { gradeMin: -40, gradeMax: 40, slopeThrottleMs: 550, slopeDeltaMin: 0.2, powerThrottleMs: 200, powerDeltaMin: 2 },
      now: () => time,
      getIntensityPct: () => intensity,
      getDifficultyPct: () => difficulty,
      sendPower: jest.fn(),
      sendSlope: jest.fn(),
    };
    targets = createTrainerTargets(ctx);
  });

  test('applies hill-strength changes immediately on an unchanged hill', () => {
    targets.setSlopeTarget(6);
    difficulty = 50;
    time += 10;
    expect(targets.setSlopeTarget(6)).toBe(3);
    difficulty = 25;
    time += 10;
    expect(targets.setSlopeTarget(6)).toBe(1.5);

    expect(ctx.sendSlope.mock.calls).toEqual([[6], [3], [1.5]]);
    expect(state.currentGrade).toBe(6);
  });

  test('sends fine hill adjustments even if the ride loop already read the setting', () => {
    targets.setSlopeTarget(1);
    difficulty = 99;
    state.sim.difficulty = 0.99;
    expect(targets.setSlopeTarget(1, { force: true })).toBe(0.99);
    expect(ctx.sendSlope).toHaveBeenLastCalledWith(0.99);
  });

  test('throttles repeated route frames using the scaled grade', () => {
    difficulty = 50;
    targets.setSlopeTarget(6);
    targets.setSlopeTarget(6);
    time += 550;
    targets.setSlopeTarget(6);
    expect(ctx.sendSlope.mock.calls).toEqual([[3], [3]]);
  });

  test('applies a small watt adjustment without waiting for the throttle', () => {
    targets.setPowerTarget(100);
    intensity = 99;
    expect(targets.setPowerTarget(100, { force: true })).toBe(99);
    expect(ctx.sendPower.mock.calls).toEqual([[100], [99]]);
  });

  test('scales each ERG interval from its original watts', () => {
    intensity = 80;
    expect(targets.setPowerTarget(250)).toBe(200);
    expect(targets.setPowerTarget(150)).toBe(120);
    expect(ctx.sendPower.mock.calls).toEqual([[200], [120]]);
  });

  test('keeps commands within the trainer limits', () => {
    difficulty = 200;
    intensity = 200;
    expect(targets.setSlopeTarget(30)).toBe(40);
    expect(targets.setSlopeTarget(-30)).toBe(-40);
    expect(targets.setPowerTarget(2000)).toBe(2500);
  });
});
