/**
 * @jest-environment jsdom
 */

import { createRideLoop } from '../../src/neo-simple/ride-loop.js';
import { clamp } from '../../src/neo-simple/utils.js';

describe('ride loop workout control', () => {
  let ctx;
  let loop;
  let nextFrame;

  beforeEach(() => {
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      nextFrame = callback;
      return 1;
    });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    ctx = {
      state: {
        mode: 'sim',
        workout: { running: true, paused: false, startAt: 0, distanceStartM: 0, steps: [] },
        sim: { source: 'workout' },
        virtual: { mps: 0 },
        ghost: { recording: false, enabled: false },
        speedMeasuredKmh: 36,
        powerW: 200,
        totalDistanceM: 0,
      },
      clamp,
      toInt: Number.parseInt,
      getRideSettings: () => ({ virtualEnabled: false, difficultyPct: 100, weight: 75 }),
      tickWorkout: jest.fn(),
      tickRoute: jest.fn(),
      getWorkoutNowMs: (now) => now,
      updateWorkoutUi: jest.fn(),
      updateDistanceUi: jest.fn(),
      drawProfile: jest.fn(),
      drawRide: jest.fn(),
      drawWorkoutTimeline: jest.fn(),
      speedEl: {},
      wkgEl: {},
      ftpEl: { value: '250' },
    };
    loop = createRideLoop(ctx);
  });

  afterEach(() => {
    loop.stop();
    jest.restoreAllMocks();
  });

  test.each(['sim', 'workout'])('ticks a running workout in %s mode', (mode) => {
    ctx.state.mode = mode;
    loop.start();
    nextFrame(1000);

    expect(ctx.tickWorkout).toHaveBeenCalledWith(1000);
    expect(ctx.tickRoute).not.toHaveBeenCalled();
  });

  test('ticks the route when no workout is running', () => {
    ctx.state.workout.running = false;
    loop.start();
    nextFrame(1000);

    expect(ctx.tickWorkout).not.toHaveBeenCalled();
    expect(ctx.tickRoute).toHaveBeenCalledTimes(1);
  });

  test('does not add distance while a workout is paused', () => {
    ctx.state.workout.paused = true;
    ctx.state.totalDistanceM = 123;
    loop.start();
    nextFrame(1000);

    expect(ctx.state.totalDistanceM).toBe(123);
  });
});
