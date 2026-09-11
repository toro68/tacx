import { createRoadScene, routeElevationAt } from '../../src/neo-simple/ride-scene.js';

function state(overrides = {}) {
  return {
    totalDistanceM: 100,
    currentGrade: 0,
    mode: 'sim',
    sim: { source: 'manual' },
    route: { name: 'test', lengthM: 400, points: [{ d: 0, e: 0 }, { d: 400, e: 0 }] },
    ...overrides,
  };
}

const scene = (s) => createRoadScene({ state: s, width: 1000, height: 500 });

describe('road perspective', () => {
  test('objects shrink with distance and approach the horizon', () => {
    const road = scene(state());
    const near = road.project(110);
    const far = road.project(200);
    expect(near.scale).toBeGreaterThan(far.scale);
    expect(near.y).toBeGreaterThan(far.y);
    expect(far.y).toBeGreaterThan(road.horizonY);
  });

  test('moving forward makes a fixed roadside object grow and move toward the camera', () => {
    const before = scene(state({ totalDistanceM: 100 })).project(150);
    const after = scene(state({ totalDistanceM: 110 })).project(150);
    expect(after.scale).toBeGreaterThan(before.scale);
    expect(after.y).toBeGreaterThan(before.y);
  });

  test('grade affects height rather than turning the road sideways', () => {
    const flat = scene(state()).project(180);
    const uphill = scene(state({ currentGrade: 12 })).project(180);
    expect(uphill.x).toBeCloseTo(flat.x);
    expect(uphill.y).not.toBeCloseTo(flat.y);
  });

  test('a rider behind the camera is not mirrored into the road ahead', () => {
    const road = scene(state());
    expect(road.project(80)).toBeNull();
    expect(road.project(120)).not.toBeNull();
  });

  test('actual route hills occlude the road beyond a crest', () => {
    const road = scene(state({
      totalDistanceM: 50,
      sim: { source: 'route' },
      route: { name: 'crest', lengthM: 500, points: [{ d: 0, e: 0 }, { d: 100, e: 12 }, { d: 200, e: 0 }, { d: 500, e: 0 }] },
    }));
    expect(road.segments.some((segment) => !segment.visible && segment.distance > 100 && segment.distance < 200)).toBe(true);
    const visible = road.segments.filter((segment) => segment.visible);
    for (let i = 1; i < visible.length; i += 1) {
      expect(visible[i].clipY).toBeLessThanOrEqual(visible[i - 1].clipY);
    }
  });

  test('manual grade does not use unrelated hills from the selected route', () => {
    const flat = state();
    const withHills = state({ route: { ...flat.route, points: [{ d: 0, e: 0 }, { d: 200, e: 100 }, { d: 400, e: 0 }] } });
    expect(scene(withHills).project(200).y).toBeCloseTo(scene(flat).project(200).y);
  });

  test('route elevation stays continuous across lap boundaries', () => {
    const route = { lengthM: 100, points: [{ d: 0, e: 10 }, { d: 100, e: 20 }] };
    expect(routeElevationAt(route, 99.99)).toBeCloseTo(19.999);
    expect(routeElevationAt(route, 100)).toBe(20);
    expect(routeElevationAt(route, 100.01)).toBeCloseTo(20.001);
    expect(routeElevationAt(route, -10)).toBe(9);
  });
});
