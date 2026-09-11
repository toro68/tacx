import { elevationAt, hashSeed } from './routes.js';
import { clamp } from './utils.js';

export const ROAD_STEP_M = 4;
export const VIEW_DISTANCE_M = 640;
export const ROAD_HALF_WIDTH_M = 3;

export function sceneryNoise(index) {
  const x = Math.sin(index * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// Preserve height across the lap boundary, even for an imported, non-flat loop.
export function routeElevationAt(route, distance) {
  if (!route?.points?.length || !(route.lengthM > 0)) return 0;
  const lap = Math.floor(distance / route.lengthM);
  const local = distance - lap * route.lengthM;
  const rise = route.points[route.points.length - 1].e - route.points[0].e;
  return elevationAt(route, local) + lap * rise;
}

export function createRoadScene({ state, width, height }) {
  const distance = Number.isFinite(state.totalDistanceM) ? state.totalDistanceM : 0;
  const useRoute = state.mode === 'sim' && state.sim.source === 'route';
  const grade = clamp(state.currentGrade || 0, -40, 40) / 100;
  const elevation = useRoute
    ? (d) => (routeElevationAt(state.route, d - 6) + 2 * routeElevationAt(state.route, d) + routeElevationAt(state.route, d + 6)) / 4
    : (d) => (d - distance) * grade;
  const seed = hashSeed(state.route?.name ?? 'country road') % 1000;
  // ZWO routes contain height and distance, so bends are deterministic scenery.
  const bend = (d) => 24 * Math.sin(d / 190 + seed) + 15 * Math.sin(d / 83 + seed * 0.3);
  const cameraDistance = distance - 8;
  const cameraX = bend(cameraDistance) + 0.9;
  const cameraY = elevation(cameraDistance) + 2.4;
  const heading = (bend(cameraDistance + 2) - bend(cameraDistance - 2)) / 4;
  const slope = (elevation(cameraDistance + 8) - elevation(cameraDistance - 8)) / 16;
  const pitch = Math.atan(slope) * 0.8;
  const focal = Math.min(width * 0.9, height * 1.3);
  const centerY = height * 0.43;
  const horizonY = centerY + focal * Math.tan(pitch);

  function project(worldDistance, lateral = 0, aboveGround = 0) {
    const depth = worldDistance - cameraDistance;
    if (depth < 2) return null;
    const scale = focal / depth;
    return {
      x: width / 2 + (bend(worldDistance) + lateral - cameraX - heading * depth) * scale,
      y: horizonY - (elevation(worldDistance) + aboveGround - cameraY) * scale,
      scale,
      depth,
    };
  }

  const segments = [];
  const first = Math.ceil((cameraDistance + 2) / ROAD_STEP_M) * ROAD_STEP_M;
  let clipY = height;
  for (let d = first; d < cameraDistance + VIEW_DISTANCE_M; d += ROAD_STEP_M) {
    const near = project(d);
    const far = project(d + ROAD_STEP_M);
    const visible = near.y > far.y && far.y < clipY;
    segments.push({ distance: d, near, far, clipY, visible });
    if (visible) clipY = Math.min(clipY, far.y);
  }

  return { project, segments, cameraDistance, horizonY, heading, distance, width, height };
}
