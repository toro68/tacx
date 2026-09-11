import { prepareCanvas } from './canvas.js';
import { createRoadScene, sceneryNoise, ROAD_HALF_WIDTH_M, ROAD_STEP_M, VIEW_DISTANCE_M } from './ride-scene.js';
import { clamp } from './utils.js';

export function createRideRenderer(ctx) {
  const state = ctx.state;
  const g = ctx.rideCtx;
  const colors = ['#de643e', '#7193b8', '#dfb54e', '#68957b', '#9c80a5', '#d5d8ce'];

  function polygon(points, color) {
    g.fillStyle = color;
    g.beginPath();
    points.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
    g.closePath();
    g.fill();
  }

  function ellipse(x, y, rx, ry, color) {
    g.fillStyle = color;
    g.beginPath();
    g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
    g.fill();
  }

  function line(points, color, width) {
    g.strokeStyle = color;
    g.lineWidth = width;
    g.lineCap = 'round';
    g.beginPath();
    points.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
    g.stroke();
  }

  function updateAnimation(dt) {
    const visual = state.rideVisual;
    const count = visual.crowd === 'off' ? 0 : visual.crowd === 'few' ? 4 : 12;
    if (!visual.seeded || visual.npcs.length !== count) {
      visual.seeded = true;
      visual.npcs = Array.from({ length: count }, (_, i) => ({
        id: `rider-${i}`,
        relM: 24 + i * 31,
        speedMps: 6.3 + sceneryNoise(i + 5) * 3.5,
        lane: 0.5 + sceneryNoise(i + 10) * 1.8,
        phase: sceneryNoise(i) * Math.PI * 2,
        color: colors[i % colors.length],
      }));
    }
    for (const npc of visual.npcs) {
      npc.relM += (npc.speedMps - Math.max(0, state.mps)) * dt;
      npc.phase = (npc.phase + dt * 8.5) % (Math.PI * 2);
      if (npc.relM < -30) npc.relM = 500 + sceneryNoise(npc.lane) * 100;
      if (npc.relM > 740) npc.relM = -25;
    }
    visual.crankAngle = ((visual.crankAngle || 0) + Math.max(0, state.cadenceRpm) / 60 * Math.PI * 2 * dt) % (Math.PI * 2);
    visual.wheelAngle = ((visual.wheelAngle || 0) + Math.max(0, state.mps) / 2.1 * Math.PI * 2 * dt) % (Math.PI * 2);
  }

  function drawSky(scene, enhanced) {
    const { width: w, height: h, horizonY } = scene;
    const sky = g.createLinearGradient(0, 0, 0, Math.max(1, horizonY + h * 0.2));
    sky.addColorStop(0, '#80b4ce');
    sky.addColorStop(0.7, '#c6dce0');
    sky.addColorStop(1, '#e7e8d4');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    const sun = g.createRadialGradient(w * 0.2, h * 0.17, 2, w * 0.2, h * 0.17, h * 0.42);
    sun.addColorStop(0, 'rgba(255,248,213,0.7)');
    sun.addColorStop(1, 'rgba(255,248,213,0)');
    g.fillStyle = sun;
    g.fillRect(0, 0, w, h);
    if (enhanced) {
      for (let i = 0; i < 5; i += 1) {
        const x = (i * 0.28 - 0.1) * w - scene.heading * 35;
        const y = h * (0.12 + sceneryNoise(i + 30) * 0.15);
        ellipse(x, y, w * 0.1, h * 0.017, 'rgba(255,253,241,0.24)');
        ellipse(x + w * 0.04, y - h * 0.01, w * 0.06, h * 0.025, 'rgba(255,253,241,0.2)');
      }
    }
    const layers = [
      { color: '#9cbbbc', amplitude: 0.16, base: -0.015, frequency: 0.005 },
      { color: '#819f98', amplitude: 0.12, base: 0.03, frequency: 0.008 },
      { color: '#698779', amplitude: 0.065, base: 0.075, frequency: 0.012 },
    ];
    layers.forEach((layer, i) => {
      const points = [[-10, h]];
      for (let x = -10; x <= w + 20; x += 10) {
        const worldX = x + scene.heading * (160 + i * 90) + scene.distance * 0.005;
        const ridge = Math.sin(worldX * layer.frequency + i * 2) * 0.55 + Math.sin(worldX * layer.frequency * 2.4 + 1) * 0.24;
        points.push([x, horizonY + h * layer.base - h * layer.amplitude * (0.65 + ridge)]);
      }
      points.push([w + 20, h]);
      polygon(points, layer.color);
    });
  }

  function roadBand(near, far, left, right, color) {
    polygon([
      [near.x + left * near.scale, Math.round(near.y)],
      [near.x + right * near.scale, Math.round(near.y)],
      [far.x + right * far.scale, Math.round(far.y)],
      [far.x + left * far.scale, Math.round(far.y)],
    ], color);
  }

  function drawRoadSegment(segment, scene) {
    if (!segment.visible) return;
    const { near, far, distance } = segment;
    const light = Math.floor(distance / 16) % 2 === 0;
    // Shared pixel boundaries prevent antialiasing seams between road strips.
    const ground = [[0, Math.round(near.y)], [scene.width, Math.round(near.y)], [scene.width, Math.round(far.y)], [0, Math.round(far.y)]];
    polygon(ground, light ? '#789257' : '#779156');
    // Low-contrast field texture stays anchored to world distance.
    roadBand(near, far, -40, -9, light ? '#879c60' : '#84995e');
    roadBand(near, far, 11, 55, light ? '#8e9e65' : '#8b9b62');
    roadBand(near, far, -3.65, 3.65, '#9b9b83');
    roadBand(near, far, -3.25, 3.25, '#777b70');
    roadBand(near, far, -ROAD_HALF_WIDTH_M, ROAD_HALF_WIDTH_M, light ? '#555d5c' : '#535b5a');
    roadBand(near, far, -2.83, -2.73, '#dedfd0');
    roadBand(near, far, 2.73, 2.83, '#dedfd0');
    if (Math.floor(distance / ROAD_STEP_M) % 3 === 0) roadBand(near, far, -0.055, 0.055, '#e5d8a1');
    if (near.depth < 90) {
      for (let i = 0; i < 4; i += 1) {
        const point = scene.project(distance + 0.5 + i * 0.8, (sceneryNoise(distance + i) - 0.5) * 5.2);
        line([[point.x, point.y], [point.x + 0.04 * point.scale, point.y]], 'rgba(220,227,218,0.08)', Math.max(0.4, point.scale * 0.006));
      }
    }
    const fog = clamp((far.depth - 75) / VIEW_DISTANCE_M, 0, 0.85);
    if (fog > 0) polygon(ground, `rgba(198,216,204,${fog})`);
  }

  function foliage(x, y, rx, ry, seed, color) {
    const points = Array.from({ length: 14 }, (_, i) => {
      const angle = i / 14 * Math.PI * 2;
      const r = 0.85 + sceneryNoise(seed + i * 3) * 0.3;
      return [x + Math.cos(angle) * rx * r, y + Math.sin(angle) * ry * r];
    });
    g.fillStyle = color;
    g.beginPath();
    const last = points[points.length - 1];
    g.moveTo((last[0] + points[0][0]) / 2, (last[1] + points[0][1]) / 2);
    points.forEach((point, i) => {
      const next = points[(i + 1) % points.length];
      g.quadraticCurveTo(point[0], point[1], (point[0] + next[0]) / 2, (point[1] + next[1]) / 2);
    });
    g.closePath();
    g.fill();
  }

  function drawTree(point, seed, side) {
    const { x, y, scale: s } = point;
    const height = (5 + sceneryNoise(seed + 1) * 4) * s;
    if (s < 0.2 || x + height < 0 || x - height > ctx.rideCanvas.width) return;
    ellipse(x + height * 0.15, y, height * 0.46, height * 0.055, 'rgba(32,48,35,0.14)');
    polygon([[x - s * 0.16, y], [x + s * 0.16, y], [x + s * 0.05, y - height * 0.83], [x - s * 0.04, y - height * 0.83]], '#625e48');
    if (sceneryNoise(seed) > 0.45) {
      for (let j = 0; j < 3; j += 1) {
        const top = y - height + j * height * 0.17;
        const radius = height * (0.22 + j * 0.06);
        const branches = [[x, top]];
        for (let k = 1; k <= 6; k += 1) branches.push([x + radius * k / 6 * (k % 2 ? 0.7 : 1), top + height * 0.52 * k / 6]);
        for (let k = 6; k >= 1; k -= 1) branches.push([x - radius * k / 6 * (k % 2 ? 0.8 : 1), top + height * 0.52 * k / 6]);
        polygon(branches, ['#36584b', '#3b6150', '#416851'][j]);
      }
    } else {
      foliage(x, y - height * 0.69, height * 0.34, height * 0.32, seed, '#476b4d');
      foliage(x - height * 0.16, y - height * 0.74, height * 0.25, height * 0.24, seed + 9, '#567b51');
      foliage(x + height * 0.18, y - height * 0.63, height * 0.23, height * 0.24, seed + 20, '#3f6549');
      foliage(x - height * 0.06, y - height * 0.86, height * 0.21, height * 0.19, seed + 4, side < 0 ? '#678752' : '#608151');
    }
  }

  function drawPost(point) {
    const { x, y, scale: s } = point;
    g.fillStyle = '#e6e5d6';
    g.fillRect(x - 0.065 * s, y - 0.9 * s, 0.13 * s, 0.9 * s);
    g.fillStyle = '#424b47';
    g.fillRect(x - 0.066 * s, y - 0.77 * s, 0.132 * s, 0.22 * s);
    g.fillStyle = '#f6d6a1';
    g.fillRect(x - 0.035 * s, y - 0.72 * s, 0.07 * s, 0.08 * s);
  }

  function drawCyclist(point, { color, phase = 0, ghost = false }) {
    const { x, y, scale: s } = point;
    if (s < 0.65) return;
    g.save();
    g.globalAlpha = ghost ? 0.55 : 1;
    g.translate(x, y);
    const pedal = Math.sin(phase);
    const sway = pedal * 0.018 * s;
    ellipse(s * 0.12, 0, s * 0.36, s * 0.07, 'rgba(23,35,29,0.28)');
    ellipse(0, -0.34 * s, 0.072 * s, 0.35 * s, '#242c2c');
    ellipse(0, -0.34 * s, 0.035 * s, 0.29 * s, '#828e8a');
    line([[0, -0.68 * s], [0, -0.23 * s]], '#b5c3be', 0.026 * s);
    line([[-0.08 * s, -0.36 * s], [0.09 * s, -0.7 * s], [0, -0.87 * s]], '#c5d4cf', 0.045 * s);
    // Knees and shoes alternate with measured cadence.
    [-1, 1].forEach((side) => {
      const kneeY = (-0.62 + pedal * side * 0.1) * s;
      const footY = (-0.32 - pedal * side * 0.11) * s;
      line([[side * 0.1 * s, -0.9 * s], [side * 0.19 * s, kneeY]], '#273637', 0.13 * s);
      line([[side * 0.19 * s, kneeY], [side * 0.12 * s, footY]], '#c6a58b', 0.085 * s);
      line([[side * 0.12 * s, footY], [side * 0.18 * s, footY + 0.015 * s]], '#e1e4db', 0.075 * s);
    });
    line([[-0.28 * s, -1.06 * s], [0.28 * s, -1.06 * s]], '#333f3f', 0.04 * s);
    [-1, 1].forEach((side) => line([[side * 0.2 * s + sway, -1.26 * s], [side * 0.3 * s, -1.11 * s], [side * 0.27 * s, -1.04 * s]], '#c6a58b', 0.075 * s));
    polygon([[-0.23 * s + sway, -1.28 * s], [0.23 * s + sway, -1.28 * s], [0.16 * s, -0.86 * s], [-0.16 * s, -0.86 * s]], color);
    line([[-0.13 * s, -0.92 * s], [0.13 * s, -0.92 * s]], 'rgba(255,255,255,0.25)', 0.018 * s);
    ellipse(sway, -1.43 * s, 0.135 * s, 0.16 * s, '#e7ece7');
    line([[sway - 0.065 * s, -1.52 * s], [sway - 0.045 * s, -1.35 * s]], '#5d7279', 0.025 * s);
    line([[sway + 0.065 * s, -1.52 * s], [sway + 0.045 * s, -1.35 * s]], '#5d7279', 0.025 * s);
    g.restore();
  }

  function drawWorld(scene, enhanced) {
    const cyclists = [
      ...state.rideVisual.npcs.map((npc) => ({ ...npc, distance: scene.distance + npc.relM })),
      { distance: scene.distance, lane: 0.9, color: '#327baf', phase: state.rideVisual.crankAngle },
    ];
    if (state.ghost.enabled && Number.isFinite(state.ghost.relM)) {
      cyclists.push({ distance: scene.distance + state.ghost.relM, lane: 1.6, color: '#a78cce', phase: state.rideVisual.crankAngle, ghost: true });
    }
    for (let i = scene.segments.length - 1; i >= 0; i -= 1) {
      const segment = scene.segments[i];
      g.save();
      g.beginPath();
      g.rect(0, 0, scene.width, Math.max(0, Math.round(segment.clipY)));
      g.clip();
      drawRoadSegment(segment, scene);
      const d = segment.distance;
      const objects = [];
      if (enhanced && Math.round(d / ROAD_STEP_M) % 4 === 0) {
        [-1, 1].forEach((side) => {
          const seed = d * 0.31 + side * 11;
          const point = scene.project(d + 2, side * (7 + sceneryNoise(seed) * 13));
          objects.push({ depth: point.depth, draw: () => drawTree(point, seed, side) });
        });
      }
      if (Math.round(d / ROAD_STEP_M) % 8 === 0) {
        [-1, 1].forEach((side) => {
          const point = scene.project(d + 1, side * 3.6);
          objects.push({ depth: point.depth, draw: () => drawPost(point) });
        });
      }
      for (const rider of cyclists) {
        if (rider.distance < d || rider.distance >= d + ROAD_STEP_M) continue;
        const point = scene.project(rider.distance, rider.lane);
        if (point) objects.push({ depth: point.depth, draw: () => drawCyclist(point, rider) });
      }
      objects.sort((a, b) => b.depth - a.depth).forEach((object) => object.draw());
      g.restore();
    }
  }

  function drawRouteProfile(x, y, w, h) {
    const route = state.route;
    if (!route?.points?.length || !(route.lengthM > 0)) return;
    const elevations = route.points.map((p) => p.e);
    const min = Math.min(...elevations);
    const span = Math.max(1, Math.max(...elevations) - min);
    const pad = 8;
    const points = route.points.map((p) => [x + pad + p.d / route.lengthM * (w - pad * 2), y + h - pad - (p.e - min) / span * (h - pad * 2)]);
    polygon([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], 'rgba(23,43,44,0.65)');
    line(points, '#c8d6c2', 1.5);
    const local = ((state.totalDistanceM % route.lengthM) + route.lengthM) % route.lengthM;
    const px = x + pad + local / route.lengthM * (w - pad * 2);
    const py = y + h - pad - (ctx.elevationAt(local) - min) / span * (h - pad * 2);
    ellipse(px, py, 3, 3, '#f7dca0');
  }

  function drawHud(scene) {
    const { width: w, height: h } = scene;
    const small = w < 560;
    const pad = small ? 12 : 18;
    g.textAlign = 'left';
    g.font = '600 13px system-ui, sans-serif';
    const top = g.createLinearGradient(0, 0, 0, 86);
    top.addColorStop(0, 'rgba(23,43,44,0.62)');
    top.addColorStop(1, 'rgba(23,43,44,0)');
    g.fillStyle = top;
    g.fillRect(0, 0, w, 86);
    g.fillStyle = '#f0f4ec';
    const routeName = state.mode === 'sim' && state.sim.source === 'route' ? state.route.name : 'Country road';
    g.fillText(routeName, pad, 26);
    g.font = '12px system-ui, sans-serif';
    g.fillStyle = '#d5e1d9';
    g.fillText(`${(state.totalDistanceM / 1000).toFixed(2)} km`, pad, 45);
    if (!small && state.mode === 'sim' && state.sim.source === 'route') drawRouteProfile(w - 218, 14, 200, 48);

    const metrics = [
      { label: 'KM/H', value: Math.round(state.kmh) },
      { label: 'WATTS', value: Math.round(state.powerW) },
      { label: 'RPM', value: Math.round(state.cadenceRpm) },
      { label: 'GRADE', value: `${state.currentGrade.toFixed(1)}%` },
    ];
    const cell = small ? (w - pad * 2) / 4 : 85;
    const panelW = cell * 4;
    g.fillStyle = 'rgba(23,38,39,0.76)';
    g.fillRect(pad, h - 67, panelW, 55);
    metrics.forEach((metric, i) => {
      const x = pad + cell * i + 10;
      g.fillStyle = '#bdcfc7';
      g.font = '10px system-ui, sans-serif';
      g.fillText(metric.label, x, h - 49);
      g.fillStyle = '#f7f7ec';
      g.font = `600 ${small ? 18 : 21}px system-ui, sans-serif`;
      g.fillText(String(metric.value), x, h - 25);
    });
    if (state.rideVisual.leaderboard && !small) {
      const riders = state.rideVisual.npcs.slice().sort((a, b) => Math.abs(a.relM) - Math.abs(b.relM)).slice(0, 3);
      if (state.ghost.enabled && Number.isFinite(state.ghost.relM)) riders.unshift({ relM: state.ghost.relM, color: '#a78cce', ghost: true });
      if (riders.length) {
        const x = w - 146;
        g.fillStyle = 'rgba(23,38,39,0.62)';
        g.fillRect(x, 76, 128, 27 + riders.length * 23);
        g.fillStyle = '#dbe7df';
        g.font = '11px system-ui, sans-serif';
        g.fillText('NEARBY', x + 10, 94);
        riders.forEach((rider, i) => {
          const y = 115 + i * 23;
          ellipse(x + 13, y - 4, 3, 3, rider.color);
          g.fillStyle = '#e3eade';
          const label = rider.ghost ? 'Ghost' : rider.relM >= 0 ? 'Ahead' : 'Behind';
          g.fillText(`${label} ${Math.abs(Math.round(rider.relM))} m`, x + 23, y);
        });
      }
    }
    if (state.workout.running && state.workout.paused) {
      g.fillStyle = 'rgba(23,38,39,0.78)';
      g.fillRect(w / 2 - 48, 16, 96, 30);
      g.fillStyle = '#f2d399';
      g.textAlign = 'center';
      g.font = '600 12px system-ui, sans-serif';
      g.fillText('PAUSED', w / 2, 36);
      g.textAlign = 'left';
    }
  }

  function drawRide(dtSec = 0) {
    const visual = state.rideVisual;
    visual.enhanced = !!ctx.gfxEnhancedEl.checked;
    visual.leaderboard = !!ctx.gfxLeaderboardEl.checked;
    visual.crowd = ctx.gfxCrowdEl?.value ?? 'many';
    const dt = state.workout.running && state.workout.paused ? 0 : clamp(dtSec, 0, 1);
    updateAnimation(dt);
    const { w, h } = prepareCanvas(ctx.rideCanvas, g);
    if (w <= 1 || h <= 1) return;
    const scene = createRoadScene({ state, width: w, height: h });
    drawSky(scene, visual.enhanced);
    drawWorld(scene, visual.enhanced);
    drawHud(scene);
  }

  return Object.freeze({ drawRide });
}
