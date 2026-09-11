/**
 * @jest-environment jsdom
 */

import { createWorkoutController } from '../../src/neo-simple/workout.js';

describe('neo-simple workout controller', () => {
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('reapplyCurrentStep reapplies ERG target', () => {
    jest.useFakeTimers();

    const state = {
      mode: 'workout',
      db: { lock: false },
      trainer: { lastAt: 0, lastText: '' },
      sim: { source: 'workout' },
      workout: {
        running: true,
        paused: false,
        pausedAt: 0,
        pausedTotalMs: 0,
        startAt: 0,
        distanceStartM: 0,
        stepIndex: 0,
        stepStartedAt: 0,
        totalDurationSec: 60,
        steps: [{ sec: 60, control: { mode: 'erg', watts: 200 } }],
        currentTargetText: '--',
        lastCueSec: null,
        lastPowerSentAt: 0,
        lastPowerValue: null,
        resendTimerId: null,
        ackTimerId: null,
      },
    };

    const targetEl = { textContent: '' };
    const ctx = {
      state,
      setModeRadio: jest.fn(),
      setModeUi: jest.fn((m) => { state.mode = m; }),
      updateControlSourceUi: jest.fn(),
      setPowerTarget: jest.fn(() => 150),
      parseTrainerMessage: jest.fn(() => ({ kind: 'powerSent' })),
      showToast: jest.fn(),
      intensityPct: jest.fn(() => 100),
      targetEl,
    };

    const controller = createWorkoutController(ctx);
    controller.reapplyCurrentStep();

    expect(ctx.setPowerTarget).toHaveBeenCalledWith(200);
    expect(targetEl.textContent).toBe('150 W');
  });

  test('reapplyCurrentStep is a no-op when not running', () => {
    const state = {
      mode: 'workout',
      db: { lock: false },
      trainer: { lastAt: 0, lastText: '' },
      sim: { source: 'workout' },
      workout: {
        running: false,
        paused: false,
        steps: [{ sec: 60, control: { mode: 'erg', watts: 200 } }],
        stepIndex: 0,
      },
    };

    const ctx = {
      state,
      setModeUi: jest.fn(),
      setPowerTarget: jest.fn(),
      targetEl: { textContent: '' },
    };

    const controller = createWorkoutController(ctx);
    controller.reapplyCurrentStep();

    expect(ctx.setPowerTarget).not.toHaveBeenCalled();
  });
});

describe('workout timing', () => {
  let state;
  let ctx;
  let controller;

  beforeEach(() => {
    jest.useFakeTimers();
    state = {
      mode: 'workout',
      db: { lock: false },
      trainer: { lastAt: 0, lastText: '' },
      sim: { source: 'workout' },
      ghost: { recording: false },
      workout: {
        running: true,
        paused: false,
        pausedAt: 0,
        pausedTotalMs: 0,
        startAt: 1000,
        stepStartedAt: 1000,
        stepIndex: 0,
        lastCueSec: 1,
        steps: [100, 200, 300].map((watts) => ({
          sec: 10,
          control: { mode: 'erg', watts },
        })),
      },
    };
    ctx = {
      state,
      setModeUi: jest.fn((mode) => { state.mode = mode; }),
      setPowerTarget: jest.fn((watts) => watts),
      targetEl: {},
      btnWorkoutPause: {},
      btnWorkoutNext: {},
      btnWorkoutStop: {},
      beep: { play: jest.fn() },
      setWorkoutFocusUi: jest.fn(),
      updateWorkoutUi: jest.fn(),
    };
    controller = createWorkoutController(ctx);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('advances from a SIM interval to the next ERG interval', () => {
    state.mode = 'sim';
    state.workout.steps[0].control = { mode: 'sim', grade: 5 };

    controller.tickWorkout(11000);

    expect(state.workout.stepIndex).toBe(1);
    expect(state.mode).toBe('workout');
    expect(ctx.setPowerTarget).toHaveBeenCalledWith(200);
    expect(state.workout.lastCueSec).toBeNull();
  });

  test('keeps scheduled interval boundaries after a late frame', () => {
    controller.tickWorkout(11500);

    expect(state.workout.stepStartedAt).toBe(11000);
    controller.tickWorkout(21000);
    expect(state.workout.stepIndex).toBe(2);
    expect(state.workout.stepStartedAt).toBe(21000);
    expect(ctx.setPowerTarget).toHaveBeenLastCalledWith(300);
  });

  test('skips expired intervals and sends only the current target after a long delay', () => {
    controller.tickWorkout(25500);

    expect(state.workout.stepIndex).toBe(2);
    expect(state.workout.stepStartedAt).toBe(21000);
    expect(ctx.setPowerTarget).toHaveBeenCalledTimes(1);
    expect(ctx.setPowerTarget).toHaveBeenCalledWith(300);
  });

  test('finishes an expired workout without sending old targets', () => {
    controller.tickWorkout(40000);

    expect(state.workout.running).toBe(false);
    expect(ctx.setPowerTarget).not.toHaveBeenCalled();
    expect(ctx.targetEl.textContent).toBe('--');
  });

  test('excludes paused time when advancing intervals', () => {
    state.workout.paused = true;
    state.workout.pausedAt = 6000;
    controller.tickWorkout(26000);
    expect(state.workout.stepIndex).toBe(0);

    state.workout.paused = false;
    state.workout.pausedTotalMs = 20000;
    controller.tickWorkout(30500);
    expect(state.workout.stepIndex).toBe(0);

    controller.tickWorkout(31000);
    expect(state.workout.stepIndex).toBe(1);
    expect(state.workout.stepStartedAt).toBe(11000);
  });
});
