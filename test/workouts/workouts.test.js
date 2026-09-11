/**
 * @jest-environment jsdom
 */

import { workouts, parsedWorkouts } from '../../src/workouts/workouts.js';

describe('Workouts', () => {

  global.console = {
    log: jest.fn(),
    error: console.error,
    warn: console.warn,
  };

  test('built-in workouts parse', () => {
    expect(workouts.length).toBeGreaterThan(0);
    expect(parsedWorkouts.length).toBe(workouts.length);
    parsedWorkouts.forEach((w) => {
      expect(w.meta.name).toBeTruthy();
      expect(w.meta.duration).toBeGreaterThan(0);
    });
  });

  test('workout definitions are consistent', () => {
    const quicheRaw = workouts.find((w) => w.includes('<name>Quiche</name>'));
    const rampRaw = workouts.find((w) => w.includes('<name>Ramp Test</name>'));

    expect(quicheRaw).toBeTruthy();
    expect(rampRaw).toBeTruthy();

    expect(quicheRaw).toContain('PowerHigh="0.66"');
    expect(quicheRaw).not.toContain('PowerHigh="0.966"');
    expect(rampRaw).not.toContain('Duration=" 300"');

    const honey = parsedWorkouts.find((w) => w.meta.name === 'Honey');
    const honeySweetSpotBlocks = honey.intervals.filter((i) => {
      const step = i.steps?.[0];
      return i.duration === 600 && step?.power === 0.9;
    });
    expect(honeySweetSpotBlocks).toHaveLength(4);

    const hillLadder = parsedWorkouts.find((w) => w.meta.name === 'Hill Ladder 4-3-2');
    expect(hillLadder.meta.duration).toBe(90 * 60);

    const thirtyMinuteWorkouts = [
      '30min 30/30 VO2',
      '30min 3x6 Threshold',
      '30min 2x10 Sweet Spot',
      '30min Over-Under 3x6',
      '30min Sprint 2x10',
    ];
    thirtyMinuteWorkouts.forEach((name) => {
      const workout = parsedWorkouts.find((w) => w.meta.name === name);
      expect(workout).toBeTruthy();
      expect(workout.meta.duration).toBe(30 * 60);
    });
  });
});
