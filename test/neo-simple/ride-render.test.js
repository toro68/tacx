/**
 * @jest-environment jsdom
 */

import { createRideRenderer } from '../../src/neo-simple/ride-render.js';

describe('ride animation', () => {
  let state;
  let graphics;
  let renderer;

  beforeEach(() => {
    state = {
      totalDistanceM: 100, currentGrade: 0, mode: 'sim', sim: { source: 'manual' },
      mps: 8, kmh: 28.8, powerW: 180, cadenceRpm: 90,
      route: { name: 'test', lengthM: 0, points: [] },
      workout: { running: true, paused: false },
      ghost: { enabled: false, relM: null },
      rideVisual: { npcs: [], seeded: false, crankAngle: 0, wheelAngle: 0 },
    };
    graphics = new Proxy({}, { get(target, name) {
      if (!(name in target)) target[name] = jest.fn(() => ({ addColorStop: jest.fn() }));
      return target[name];
    } });
    renderer = createRideRenderer({
      state,
      rideCanvas: { width: 800, height: 420, getBoundingClientRect: () => ({ width: 800, height: 420 }) },
      rideCtx: graphics,
      gfxEnhancedEl: { checked: true }, gfxLeaderboardEl: { checked: false }, gfxCrowdEl: { value: 'off' },
    });
  });

  test('animates pedalling from measured cadence and freezes it while paused', () => {
    renderer.drawRide(0.1);
    expect(state.rideVisual.crankAngle).toBeCloseTo(90 / 60 * Math.PI * 2 * 0.1);
    const angle = state.rideVisual.crankAngle;
    state.workout.paused = true;
    renderer.drawRide(0.1);
    expect(state.rideVisual.crankAngle).toBe(angle);
  });

  test('does not draw a ghost that is behind the camera', () => {
    state.ghost = { enabled: true, relM: -100 };
    renderer.drawRide();
    expect(graphics.translate).toHaveBeenCalledTimes(1); // the rider
    graphics.translate.mockClear();
    state.ghost.relM = 30;
    renderer.drawRide();
    expect(graphics.translate).toHaveBeenCalledTimes(2); // rider and visible ghost
  });
});
