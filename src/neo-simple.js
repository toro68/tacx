import { xf } from './functions.js';
import './db.js';
import './ble/devices.js';
import { ControlMode } from './ble/enums.js';
import { models } from './models/models.js';
import { zwo } from './workouts/zwo.js';

const $ = (id) => document.getElementById(id);

const btnConnect = $('btn-connect');
const btnReset = $('btn-reset');
const btnFullscreen = $('btn-fullscreen');

const deviceName = $('device-name');
const status = $('status');

const power = $('power');
const cadence = $('cadence');
const speed = $('speed');
const hr = $('hr');
const distance = $('distance');
const gradeEl = $('grade');
const targetEl = $('target');
const wkgEl = $('wkg');

const ftp = $('ftp');
const workoutSelect = $('workout');
const workoutFile = $('workout-file');
const btnWorkoutStart = $('btn-workout-start');
const btnWorkoutStop = $('btn-workout-stop');
const btnWorkoutPause = $('btn-workout-pause');
const btnWorkoutNext = $('btn-workout-next');
const workoutStep = $('workout-step');
const workoutStepIdx = $('workout-step-idx');
const workoutRemaining = $('workout-remaining');
const workoutProgress = $('workout-progress');
const workoutNow = $('workout-now');
const workoutNext = $('workout-next');
const workoutElapsed = $('workout-elapsed');
const workoutSound = $('workout-sound');
const workoutTimeline = $('workout-timeline');
const workoutTimelineCtx = workoutTimeline.getContext('2d');

const builderName = $('builder-name');
const builderAddErg = $('builder-add-erg');
const builderAddSim = $('builder-add-sim');
const builderClear = $('builder-clear');
const builderExport = $('builder-export');
const builderLoad = $('builder-load');
const builderTotal = $('builder-total');
const builderRows = $('builder-rows');

const simAuto = $('sim-auto');
const simGrade = $('sim-grade');
const btnSimApply = $('btn-sim-apply');
const btnRouteReset = $('btn-route-reset');
const routeLength = $('route-length');
const profile = $('profile');
const ctx = profile.getContext('2d');

const virtualSpeedEl = $('virtual-speed');
const weightEl = $('weight');
const difficultyEl = $('difficulty');
const ghostEnabledEl = $('ghost-enabled');
const ghostAutoSaveEl = $('ghost-auto-save');
const btnGhostClear = $('btn-ghost-clear');
const cdaEl = $('cda');
const crrEl = $('crr');
const windEl = $('wind');
const gfxEnhancedEl = $('gfx-enhanced');
const gfxLeaderboardEl = $('gfx-leaderboard');
const ride = $('ride');
const rideCtx = ride.getContext('2d');

const state = {
    kmh: 0,
    mps: 0,
    totalDistanceM: 0,
    currentGrade: 0,
    mode: 'workout',
    powerW: 0,
    cadenceRpm: 0,
    speedMeasuredKmh: 0,
    virtual: {
        enabled: true,
        mps: 0,
    },
    sim: {
        lastSentAt: 0,
        lastSentGrade: null,
        source: 'route', // 'route' | 'manual' | 'workout'
        difficulty: 1, // grade multiplier 0..2 (Resistance %)
    },
    workout: {
        running: false,
        paused: false,
        pausedAt: 0,
        pausedTotalMs: 0,
        startAt: 0,
        distanceStartM: 0,
        stepIndex: 0,
        stepStartedAt: 0,
        totalDurationSec: 0,
        steps: [], // normalized steps for playback
        currentTargetText: '--',
        lastCueSec: null,
    },
    route: {
        name: 'Mini Hills',
        points: [],
        lengthM: 0,
    },
    builder: {
        steps: [],
    },
    rideVisual: {
        seeded: false,
        npcs: [],
        postsSeeded: false,
        posts: [],
        enhanced: true,
        leaderboard: true,
        wheelAngle: 0,
        crankAngle: 0,
    },
    ghost: {
        enabled: false,
        run: null,
        relM: null,
        recording: false,
        samples: [],
        lastSampleMs: 0,
    },
};

function setWorkoutFocusUi(running) {
    document.body.classList.toggle('neo-workout-running', !!running);
    // Also collapse optional panels to reduce clutter.
    const builder = document.getElementById('builder-details');
    if (builder instanceof HTMLDetailsElement) builder.open = false;
    const physics = document.getElementById('physics-details');
    if (physics instanceof HTMLDetailsElement) physics.open = false;
}

function setStatus(text) {
    status.textContent = text;
}

function clamp(x, min, max) {
    return Math.min(max, Math.max(min, x));
}

function loadSettings() {
    try {
        const raw = localStorage.getItem('neoSimple:settings');
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return typeof parsed === 'object' && parsed ? parsed : {};
    } catch {
        return {};
    }
}

function saveSettings(next) {
    localStorage.setItem('neoSimple:settings', JSON.stringify(next));
}

function loadGhostRun() {
    try {
        const raw = localStorage.getItem('neoSimple:ghost');
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const samples = parsed?.samples;
        if (!Array.isArray(samples) || samples.length < 2) return null;
        const normalized = [];
        for (const row of samples) {
            if (!Array.isArray(row) || row.length !== 2) continue;
            const t = Number(row[0]);
            const d = Number(row[1]);
            if (!Number.isFinite(t) || !Number.isFinite(d)) continue;
            normalized.push([t, d]);
        }
        normalized.sort((a, b) => a[0] - b[0]);
        if (normalized.length < 2) return null;
        return {
            version: 1,
            createdAt: typeof parsed.createdAt === 'number' ? parsed.createdAt : Date.now(),
            routeName: typeof parsed.routeName === 'string' ? parsed.routeName : '',
            samples: normalized,
            totalTimeMs: typeof parsed.totalTimeMs === 'number' ? parsed.totalTimeMs : normalized[normalized.length - 1][0],
            totalDistanceM: typeof parsed.totalDistanceM === 'number' ? parsed.totalDistanceM : normalized[normalized.length - 1][1],
        };
    } catch {
        return null;
    }
}

function saveGhostRun(run) {
    try {
        localStorage.setItem('neoSimple:ghost', JSON.stringify(run));
    } catch {
        // ignore
    }
}

function clearGhostRun() {
    try {
        localStorage.removeItem('neoSimple:ghost');
    } catch {
        // ignore
    }
    state.ghost.run = null;
    state.ghost.relM = null;
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

function toInt(value, fallback = 0) {
    const x = Number.parseInt(String(value), 10);
    return Number.isFinite(x) ? x : fallback;
}

function toFloat(value, fallback = 0) {
    const x = Number.parseFloat(String(value));
    return Number.isFinite(x) ? x : fallback;
}

function pad2(n) {
    return String(n).padStart(2, '0');
}

function formatRemaining(sec) {
    if (!Number.isFinite(sec) || sec < 0) return '--';
    const s = Math.floor(sec);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${pad2(r)}`;
}

function formatElapsed(sec) {
    if (!Number.isFinite(sec) || sec < 0) return '--';
    const s = Math.floor(sec);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    if (h > 0) return `${h}:${pad2(m)}:${pad2(r)}`;
    return `${m}:${pad2(r)}`;
}

function makeBeep() {
    let ctx = null;
    function ensure() {
        if (ctx) return ctx;
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        return ctx;
    }
    function play({ freq = 880, durationMs = 70, gain = 0.05 } = {}) {
        if (!workoutSound?.checked) return;
        const audio = ensure();
        if (audio.state === 'suspended') {
            // best-effort; user gesture usually resumes automatically from button click
            audio.resume().catch(() => {});
        }
        const osc = audio.createOscillator();
        const g = audio.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        g.gain.value = gain;
        osc.connect(g);
        g.connect(audio.destination);
        const now = audio.currentTime;
        osc.start(now);
        osc.stop(now + durationMs / 1000);
    }
    return { play };
}

const beep = makeBeep();

function uid() {
    return Math.random().toString(16).slice(2);
}

function isFullscreen() {
    return !!document.fullscreenElement;
}

function updateFullscreenButton() {
    if (!btnFullscreen) return;
    btnFullscreen.textContent = isFullscreen() ? 'Exit Fullscreen' : 'Fullscreen';
}

async function toggleFullscreen() {
    if (!document.fullscreenEnabled) return;
    try {
        if (isFullscreen()) {
            await document.exitFullscreen();
            return;
        }
        // Prefer the wrapper container to keep fullscreen scoped to the app UI.
        const el = document.querySelector('.wrapper') ?? document.documentElement;
        await el.requestFullscreen();
    } catch (e) {
        console.warn('fullscreen failed', e);
    } finally {
        updateFullscreenButton();
    }
}

function setControlMode(nextMode) {
    xf.dispatch('ui:mode-set', nextMode);
}

function setPowerTarget(watts) {
    xf.dispatch('ui:power-target-set', Math.round(clamp(watts, 0, 2500)));
}

function setSlopeTarget(gradePercent) {
    const grade = clamp(gradePercent, -10, 20);
    state.currentGrade = grade;
    gradeEl.textContent = grade.toFixed(1);

    state.sim.difficulty = clamp(toInt(difficultyEl?.value, 100) / 100, 0, 2);

    const now = performance.now();
    const lastSent = state.sim.lastSentAt;
    const lastGrade = state.sim.lastSentGrade;
    const gradeChanged = lastGrade === null ? true : Math.abs(lastGrade - grade) >= 0.2;
    if (now - lastSent < 650 && !gradeChanged) return;
    state.sim.lastSentAt = now;
    state.sim.lastSentGrade = grade;
    const scaled = clamp(grade * clamp(state.sim.difficulty, 0, 2), -10, 20);
    xf.dispatch('ui:slope-target-set', scaled);
}

function resetTrainer() {
    xf.dispatch('ui:trainer:reset');
}

function setModeUi(next) {
    state.mode = next;
    if (next === 'workout') {
        state.sim.source = 'workout';
        setControlMode(ControlMode.erg);
        state.workout.currentTargetText = '--';
        targetEl.textContent = state.workout.currentTargetText;
        return;
    }
    if (next === 'sim') {
        setControlMode(ControlMode.sim);
        state.sim.source = simAuto.checked ? 'route' : 'manual';
        setSlopeTarget(state.currentGrade);
        state.workout.currentTargetText = `grade ${state.currentGrade.toFixed(1)}%`;
        targetEl.textContent = state.workout.currentTargetText;
        return;
    }
}

function buildRoute() {
    const pts = [
        [0, 0],
        [200, 2],
        [450, 14],
        [650, 10],
        [950, 25],
        [1200, 18],
        [1500, 6],
        [1750, 2],
        [2100, 8],
        [2500, 22],
        [2850, 28],
        [3200, 20],
        [3600, 10],
        [4100, 6],
        [4700, 2],
        [5200, 0],
    ].map(([d, e]) => ({ d, e }));

    const len = pts[pts.length - 1]?.d ?? 0;
    state.route.points = pts;
    state.route.lengthM = len;
    routeLength.textContent = `${(len / 1000).toFixed(1)} km`;
}

function elevationAt(distanceM) {
    const pts = state.route.points;
    if (!pts.length) return 0;
    const d = clamp(distanceM, 0, state.route.lengthM);
    let i = 1;
    while (i < pts.length && pts[i].d < d) i += 1;
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i)];
    if (a.d === b.d) return a.e;
    const t = (d - a.d) / (b.d - a.d);
    return a.e + (b.e - a.e) * t;
}

function gradeAt(distanceM) {
    const d0 = clamp(distanceM, 0, state.route.lengthM);
    const d1 = clamp(d0 + 10, 0, state.route.lengthM);
    if (d1 === d0) return 0;
    const e0 = elevationAt(d0);
    const e1 = elevationAt(d1);
    return ((e1 - e0) / (d1 - d0)) * 100;
}

function drawProfile() {
    const { w, h } = prepareCanvas(profile, ctx);
    ctx.clearRect(0, 0, w, h);

    const pts = state.route.points;
    if (!pts.length) return;

    let minE = Infinity;
    let maxE = -Infinity;
    for (const p of pts) {
        minE = Math.min(minE, p.e);
        maxE = Math.max(maxE, p.e);
    }
    const pad = 12;
    const innerW = w - pad * 2;
    const innerH = h - pad * 2;
    const eRange = Math.max(1, maxE - minE);

    ctx.lineWidth = 2;

    // Fill under curve
    ctx.beginPath();
    for (let i = 0; i < pts.length; i += 1) {
        const x = pad + (pts[i].d / state.route.lengthM) * innerW;
        const y = pad + (1 - (pts[i].e - minE) / eRange) * innerH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.lineTo(pad + innerW, pad + innerH);
    ctx.lineTo(pad, pad + innerH);
    ctx.closePath();
    ctx.fillStyle = 'rgba(76,154,255,0.10)';
    ctx.fill();

    // Stroke curve
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.beginPath();
    for (let i = 0; i < pts.length; i += 1) {
        const x = pad + (pts[i].d / state.route.lengthM) * innerW;
        const y = pad + (1 - (pts[i].e - minE) / eRange) * innerH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();

    const wrappedDistance = state.route.lengthM > 0 ? state.totalDistanceM % state.route.lengthM : state.totalDistanceM;
    const progressX = pad + (clamp(wrappedDistance, 0, state.route.lengthM) / state.route.lengthM) * innerW;
    const riderE = elevationAt(wrappedDistance);
    const riderY = pad + (1 - (riderE - minE) / eRange) * innerH;

    ctx.fillStyle = 'rgba(76,154,255,0.95)';
    ctx.beginPath();
    ctx.arc(progressX, riderY, 5.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.fillText(`${state.route.name}`, pad, 14);
}

const workoutLibrary = [];

const builtinWorkouts = [
    {
        id: 'easy-30',
        name: 'Easy 30 min',
        type: 'builtin',
        steps: [
            { name: 'Warmup', sec: 8 * 60, target: { type: 'percent', value: 55 } },
            { name: 'Endurance', sec: 20 * 60, target: { type: 'percent', value: 65 } },
            { name: 'Cooldown', sec: 2 * 60, target: { type: 'percent', value: 50 } },
        ],
    },
    {
        id: '4x4',
        name: '4x4 min VO2',
        type: 'builtin',
        steps: [
            { name: 'Warmup', sec: 10 * 60, target: { type: 'percent', value: 55 } },
            { name: 'On 1', sec: 4 * 60, target: { type: 'percent', value: 110 } },
            { name: 'Off 1', sec: 3 * 60, target: { type: 'percent', value: 55 } },
            { name: 'On 2', sec: 4 * 60, target: { type: 'percent', value: 110 } },
            { name: 'Off 2', sec: 3 * 60, target: { type: 'percent', value: 55 } },
            { name: 'On 3', sec: 4 * 60, target: { type: 'percent', value: 110 } },
            { name: 'Off 3', sec: 3 * 60, target: { type: 'percent', value: 55 } },
            { name: 'On 4', sec: 4 * 60, target: { type: 'percent', value: 110 } },
            { name: 'Cooldown', sec: 8 * 60, target: { type: 'percent', value: 50 } },
        ],
    },
    {
        id: 'ss-3x10',
        name: 'Sweet Spot 3x10',
        type: 'builtin',
        steps: [
            { name: 'Warmup', sec: 10 * 60, target: { type: 'percent', value: 55 } },
            { name: 'SS 1', sec: 10 * 60, target: { type: 'percent', value: 90 } },
            { name: 'Easy', sec: 4 * 60, target: { type: 'percent', value: 55 } },
            { name: 'SS 2', sec: 10 * 60, target: { type: 'percent', value: 90 } },
            { name: 'Easy', sec: 4 * 60, target: { type: 'percent', value: 55 } },
            { name: 'SS 3', sec: 10 * 60, target: { type: 'percent', value: 90 } },
            { name: 'Cooldown', sec: 8 * 60, target: { type: 'percent', value: 50 } },
        ],
    },
    {
        id: '30-15',
        name: '30/15 x 10',
        type: 'builtin',
        steps: [
            { name: 'Warmup', sec: 10 * 60, target: { type: 'percent', value: 55 } },
            ...Array.from({ length: 10 }, (_, i) => [
                { name: `On ${i + 1}`, sec: 30, target: { type: 'percent', value: 125 } },
                { name: `Off ${i + 1}`, sec: 15, target: { type: 'percent', value: 55 } },
            ]).flat(),
            { name: 'Cooldown', sec: 8 * 60, target: { type: 'percent', value: 50 } },
        ],
    },
];

function populateWorkouts() {
    workoutSelect.innerHTML = '';
    for (const w of workoutLibrary) {
        const opt = document.createElement('option');
        opt.value = w.id;
        opt.textContent = w.name;
        workoutSelect.appendChild(opt);
    }
}

function getSelectedWorkout() {
    const id = workoutSelect.value;
    return workoutLibrary.find((w) => w.id === id) ?? workoutLibrary[0];
}

function computeWatts(target, ftpValue) {
    if (target.type === 'watts') return Math.round(target.value);
    return Math.round((ftpValue * target.value) / 100);
}

function updateWorkoutUi(nowMs) {
    if (!state.workout.running) {
        workoutStep.textContent = '--';
        workoutStepIdx.textContent = '--';
        workoutRemaining.textContent = '--';
        workoutProgress.style.width = '0%';
        workoutNow.textContent = '--';
        workoutNext.textContent = '--';
        workoutElapsed.textContent = '--';
        btnWorkoutNext.disabled = true;
        btnWorkoutPause.disabled = true;
        btnWorkoutStop.disabled = true;
        return;
    }
    const { steps, stepIndex, stepStartedAt, startAt, totalDurationSec } = state.workout;
    const step = steps[stepIndex];
    const next = steps[stepIndex + 1];
    workoutStep.textContent = step?.name ?? '--';
    workoutStepIdx.textContent = steps.length ? `${stepIndex + 1}/${steps.length}` : '--';
    workoutNow.textContent = step?.name ?? '--';
    workoutNext.textContent = next?.name ?? '--';

    const workoutNowMs = getWorkoutNowMs(nowMs);
    const stepElapsed = (workoutNowMs - stepStartedAt) / 1000;
    const remaining = Math.max(0, (step?.sec ?? 0) - stepElapsed);
    workoutRemaining.textContent = formatRemaining(remaining);
    const elapsedTotal = (workoutNowMs - startAt) / 1000;
    workoutElapsed.textContent = formatElapsed(elapsedTotal);
    const pct = totalDurationSec > 0 ? (elapsedTotal / totalDurationSec) * 100 : 0;
    workoutProgress.style.width = `${clamp(pct, 0, 100).toFixed(1)}%`;
    btnWorkoutNext.disabled = stepIndex >= steps.length - 1;
    btnWorkoutPause.disabled = false;
    btnWorkoutStop.disabled = false;

    // cue: 3-2-1 seconds before step ends
    if (!state.workout.paused) {
        const cueSec = Math.ceil(remaining);
        if ([3, 2, 1].includes(cueSec) && state.workout.lastCueSec !== cueSec && remaining <= cueSec) {
            state.workout.lastCueSec = cueSec;
            beep.play({ freq: 740, durationMs: 60, gain: 0.04 });
        }
        if (remaining <= 0.05) {
            state.workout.lastCueSec = null;
        }
    }
}

function sumStepsSec(steps) {
    return steps.reduce((acc, s) => acc + (s?.sec ?? 0), 0);
}

function workoutElapsedSec(nowMs) {
    if (!state.workout.running) return 0;
    return (getWorkoutNowMs(nowMs) - state.workout.startAt) / 1000;
}

function workoutStepStartSec(steps, stepIndex) {
    let acc = 0;
    for (let i = 0; i < Math.max(0, stepIndex); i += 1) acc += steps[i]?.sec ?? 0;
    return acc;
}

function drawWorkoutTimeline({ steps, ftpValue, nowMs }) {
    const { w, h } = prepareCanvas(workoutTimeline, workoutTimelineCtx);
    const ctx = workoutTimelineCtx;
    ctx.clearRect(0, 0, w, h);

    const pad = 10;
    const innerW = w - pad * 2;
    const innerH = h - pad * 2;

    // background
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.fillRect(0, 0, w, h);

    if (!steps?.length) {
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
        ctx.fillText('No workout loaded', pad, pad + 14);
        return;
    }

    const totalSec = Math.max(1, sumStepsSec(steps));
    const ergValues = [];
    const simValues = [];

    for (const s of steps) {
        if (s.control?.mode === 'erg') ergValues.push(Math.max(0, s.control.watts ?? 0));
        if (s.control?.mode === 'sim') simValues.push(s.control.grade ?? 0);
    }
    const ergMin = 0;
    const ergMax = Math.max(100, ...ergValues, ftpValue || 0);
    const simMin = Math.min(-10, ...simValues);
    const simMax = Math.max(10, ...simValues);

    function xAt(sec) {
        return pad + (clamp(sec, 0, totalSec) / totalSec) * innerW;
    }
    function yErg(watts) {
        const t = (clamp(watts, ergMin, ergMax) - ergMin) / (ergMax - ergMin || 1);
        return pad + (1 - t) * innerH;
    }
    function ySim(grade) {
        const t = (clamp(grade, simMin, simMax) - simMin) / (simMax - simMin || 1);
        return pad + (1 - t) * innerH;
    }

    // grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i += 1) {
        const y = pad + (innerH * i) / 5;
        ctx.beginPath();
        ctx.moveTo(pad, y);
        ctx.lineTo(pad + innerW, y);
        ctx.stroke();
    }

    // steps as blocks (ERG blue, SIM orange)
    let t0 = 0;
    for (const s of steps) {
        const t1 = t0 + (s.sec ?? 0);
        const x0 = xAt(t0);
        const x1 = xAt(t1);
        const ww = Math.max(1, x1 - x0);

        if (s.control?.mode === 'erg') {
            const y = yErg(s.control.watts ?? 0);
            ctx.fillStyle = 'rgba(76,154,255,0.25)';
            ctx.fillRect(x0, y, ww, pad + innerH - y);
            ctx.strokeStyle = 'rgba(76,154,255,0.85)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x0, y);
            ctx.lineTo(x1, y);
            ctx.stroke();
        } else if (s.control?.mode === 'sim') {
            const y = ySim(s.control.grade ?? 0);
            ctx.fillStyle = 'rgba(255,191,0,0.18)';
            ctx.fillRect(x0, y, ww, pad + innerH - y);
            ctx.strokeStyle = 'rgba(255,191,0,0.85)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x0, y);
            ctx.lineTo(x1, y);
            ctx.stroke();
        } else {
            ctx.fillStyle = 'rgba(255,255,255,0.05)';
            ctx.fillRect(x0, pad, ww, innerH);
        }

        // step separators
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x1, pad);
        ctx.lineTo(x1, pad + innerH);
        ctx.stroke();

        t0 = t1;
    }

    // current marker
    const elapsed = clamp(workoutElapsedSec(nowMs), 0, totalSec);
    const mx = xAt(elapsed);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mx, pad);
    ctx.lineTo(mx, pad + innerH);
    ctx.stroke();

    // labels
    ctx.fillStyle = 'rgba(255,255,255,0.70)';
    ctx.font = '11px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    const totalLabel = `Total ${formatElapsed(totalSec)}`;
    ctx.fillText(totalLabel, pad, h - 8);
}

function isFractionPower(power) {
    return typeof power === 'number' && power >= 0 && power <= 2.5;
}

function normalizeWorkoutToSteps(workout, ftpValue) {
    if (workout.type === 'builtin') {
        return workout.steps.map((s) => {
            const watts = computeWatts(s.target, ftpValue);
            const label = s.target?.type === 'percent' ? `${s.target.value}%` : `${watts} W`;
            return {
                name: `${s.name} · ${label}`,
                sec: s.sec,
                control: { mode: 'erg', watts },
            };
        });
    }

    if (workout.type === 'zwo') {
        const steps = [];
        for (const interval of workout.intervals ?? []) {
            const intervalDuration = typeof interval.duration === 'number' ? interval.duration : 0;
            const intervalSteps = Array.isArray(interval.steps) ? interval.steps : [];
            const fallbackStepDuration = intervalSteps.length > 0 ? Math.max(1, Math.round(intervalDuration / intervalSteps.length)) : intervalDuration;

            for (const step of intervalSteps) {
                const sec = typeof step.duration === 'number' ? step.duration : fallbackStepDuration;
                if (!sec || sec <= 0) continue;

                const power = typeof step.power === 'number' ? step.power : undefined;
                const slope = typeof step.slope === 'number' ? step.slope : undefined;

                if (typeof power === 'number') {
                    const watts = isFractionPower(power) ? Math.round(power * ftpValue) : Math.round(power);
                    steps.push({
                        name: watts > 0 ? `ERG ${watts} W` : 'ERG Free',
                        sec,
                        control: { mode: 'erg', watts },
                    });
                    continue;
                }

                if (typeof slope === 'number') {
                    steps.push({
                        name: `SIM ${toFloat(slope, 0).toFixed(1)}%`,
                        sec,
                        control: { mode: 'sim', grade: slope },
                    });
                    continue;
                }

                steps.push({
                    name: 'Free',
                    sec,
                    control: { mode: 'erg', watts: 0 },
                });
            }
        }
        return steps;
    }

    return [];
}

function applyWorkoutStep(step) {
    if (!step) return;
    if (step.control?.mode === 'sim') {
        setModeUi('sim');
        state.sim.source = 'workout';
        simAuto.checked = false;
        simGrade.value = String(toFloat(step.control.grade, 0));
        setSlopeTarget(toFloat(step.control.grade, 0));
        state.workout.currentTargetText = `grade ${state.currentGrade.toFixed(1)}%`;
        targetEl.textContent = state.workout.currentTargetText;
        return;
    }

    setModeUi('workout');
    setPowerTarget(step.control?.watts ?? 0);
    state.workout.currentTargetText = `${Math.round(step.control?.watts ?? 0)} W`;
    targetEl.textContent = state.workout.currentTargetText;
}

function getWorkoutNowMs(nowMs) {
    if (!state.workout.running) return nowMs;
    if (!state.workout.paused) return nowMs - state.workout.pausedTotalMs;
    return state.workout.pausedAt - state.workout.pausedTotalMs;
}

function formatTotalDuration(sec) {
    return formatElapsed(sec);
}

function renderBuilder() {
    const steps = state.builder.steps;
    builderRows.innerHTML = '';

    const totalSec = steps.reduce((acc, s) => acc + (s.sec ?? 0), 0);
    builderTotal.textContent = formatTotalDuration(totalSec);

    for (let i = 0; i < steps.length; i += 1) {
        const s = steps[i];
        const row = document.createElement('div');
        row.className = 'data-tile';
        row.style.padding = '10px';
        row.dataset.id = s.id;

        const typeLabel = s.type === 'sim' ? 'SIM' : 'ERG';
        const valueLabel = s.type === 'sim' ? 'Grade %' : '%FTP';
        const value = s.type === 'sim' ? s.grade : s.percent;

        row.innerHTML = `
            <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                <strong style="min-width: 52px;">${typeLabel}</strong>
                <label>
                    Name
                    <input class="input" data-field="name" type="text" value="${(s.name ?? '').replace(/"/g, '&quot;')}" style="width: 200px; margin-left: 8px;" />
                </label>
                <label>
                    Sec
                    <input class="input" data-field="sec" type="number" inputmode="numeric" min="5" step="1" value="${s.sec}" style="width: 100px; margin-left: 8px;" />
                </label>
                <label>
                    ${valueLabel}
                    <input class="input" data-field="${s.type === 'sim' ? 'grade' : 'percent'}" type="number" inputmode="decimal" ${s.type === 'sim' ? 'min="-10" max="20" step="0.1"' : 'min="0" max="200" step="1"'} value="${value}" style="width: 110px; margin-left: 8px;" />
                </label>
                <button class="button" data-action="up" ${i === 0 ? 'disabled' : ''}>↑</button>
                <button class="button" data-action="down" ${i === steps.length - 1 ? 'disabled' : ''}>↓</button>
                <button class="button" data-action="remove">Remove</button>
            </div>
        `;
        builderRows.appendChild(row);
    }
}

function addBuilderErgStep() {
    state.builder.steps.push({
        id: uid(),
        type: 'erg',
        name: 'Steady',
        sec: 300,
        percent: 65,
    });
    renderBuilder();
}

function addBuilderSimStep() {
    state.builder.steps.push({
        id: uid(),
        type: 'sim',
        name: 'Hill',
        sec: 180,
        grade: 4.0,
    });
    renderBuilder();
}

function clearBuilder() {
    state.builder.steps = [];
    renderBuilder();
}

function buildWorkoutObjectFromBuilder() {
    const name = (builderName.value || 'My workout').trim();
    const steps = state.builder.steps;

    const intervals = steps
        .map((s) => {
            const duration = clamp(toInt(s.sec, 0), 0, 6 * 60 * 60);
            if (!duration) return null;

            if (s.type === 'sim') {
                const grade = clamp(toFloat(s.grade, 0), -10, 20);
                return { duration, steps: [{ duration, slope: grade }] };
            }

            const percent = clamp(toFloat(s.percent, 0), 0, 200);
            const power = percent / 100;
            return { duration, steps: [{ duration, power }] };
        })
        .filter(Boolean);

    const totalDuration = intervals.reduce((acc, i) => acc + (i.duration ?? 0), 0);
    return {
        meta: {
            author: 'NEO Simple',
            name,
            description: 'Built in NEO Simple',
            category: 'Custom',
            subcategory: '',
            sportType: 'bike',
            duration: totalDuration,
        },
        intervals,
    };
}

function workoutObjectToZwoXml(workoutObject) {
    return zwo.write(zwo.fromInterval(workoutObject));
}

function downloadTextFile({ name, text, mime = 'application/xml' }) {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function startWorkout() {
    const w = getSelectedWorkout();
    const ftpValue = clamp(toInt(ftp.value, 250), 50, 2000);
    ftp.value = String(ftpValue);

    state.workout.steps = normalizeWorkoutToSteps(w, ftpValue);
    state.workout.totalDurationSec = state.workout.steps.reduce((acc, s) => acc + (s.sec ?? 0), 0);
    state.workout.running = true;
    state.workout.paused = false;
    state.workout.pausedAt = 0;
    state.workout.pausedTotalMs = 0;
    state.workout.stepIndex = 0;
    state.workout.startAt = performance.now();
    state.workout.stepStartedAt = state.workout.startAt;
    state.workout.distanceStartM = state.totalDistanceM;
    state.workout.lastCueSec = null;

    const first = state.workout.steps[0];
    applyWorkoutStep(first);
    btnWorkoutPause.textContent = 'Pause';
    btnWorkoutNext.disabled = state.workout.steps.length <= 1;
    btnWorkoutPause.disabled = false;
    btnWorkoutStop.disabled = false;
    setWorkoutFocusUi(true);
    beep.play({ freq: 980, durationMs: 90, gain: 0.05 });

    state.ghost.recording = true;
    state.ghost.samples = [[0, 0]];
    state.ghost.lastSampleMs = 0;
}

function stopWorkout() {
    if (state.ghost.recording) {
        state.ghost.recording = false;
        const run = {
            version: 1,
            createdAt: Date.now(),
            routeName: state.route.name,
            samples: state.ghost.samples,
            totalTimeMs: state.ghost.samples[state.ghost.samples.length - 1]?.[0] ?? 0,
            totalDistanceM: state.ghost.samples[state.ghost.samples.length - 1]?.[1] ?? 0,
        };
        if (ghostAutoSaveEl?.checked) {
            saveGhostRun(run);
            state.ghost.run = run;
            state.ghost.enabled = !!ghostEnabledEl?.checked;
        }
    }
    state.workout.running = false;
    state.workout.paused = false;
    state.workout.pausedAt = 0;
    state.workout.pausedTotalMs = 0;
    state.workout.steps = [];
    state.workout.stepIndex = 0;
    state.workout.startAt = 0;
    state.workout.distanceStartM = 0;
    state.workout.stepStartedAt = 0;
    state.workout.totalDurationSec = 0;
    state.workout.currentTargetText = '--';
    state.workout.lastCueSec = null;
    targetEl.textContent = state.workout.currentTargetText;
    btnWorkoutPause.textContent = 'Pause';
    btnWorkoutNext.disabled = true;
    btnWorkoutPause.disabled = true;
    btnWorkoutStop.disabled = true;
    setWorkoutFocusUi(false);
    updateWorkoutUi(performance.now());
}

function togglePauseWorkout() {
    if (!state.workout.running) return;
    const now = performance.now();
    if (!state.workout.paused) {
        state.workout.paused = true;
        state.workout.pausedAt = now;
        btnWorkoutPause.textContent = 'Resume';
        beep.play({ freq: 520, durationMs: 70, gain: 0.045 });
        return;
    }
    const pausedFor = now - state.workout.pausedAt;
    state.workout.pausedTotalMs += pausedFor;
    state.workout.paused = false;
    state.workout.pausedAt = 0;
    btnWorkoutPause.textContent = 'Pause';
    state.workout.lastCueSec = null;
    beep.play({ freq: 880, durationMs: 70, gain: 0.045 });
}

function setModeRadio(mode) {
    const el = document.querySelector(`input[name="mode"][value="${mode}"]`);
    if (el instanceof HTMLInputElement) el.checked = true;
}

function skipWorkoutStep() {
    if (!state.workout.running) return;
    const now = performance.now();
    const workoutNowMs = getWorkoutNowMs(now);
    const nextIndex = Math.min(state.workout.stepIndex + 1, state.workout.steps.length);
    if (nextIndex >= state.workout.steps.length) {
        stopWorkout();
        return;
    }
    state.workout.stepIndex = nextIndex;
    state.workout.stepStartedAt = workoutNowMs;
    state.workout.lastCueSec = null;
    applyWorkoutStep(state.workout.steps[nextIndex]);
    if (!state.workout.paused) {
        beep.play({ freq: 1080, durationMs: 90, gain: 0.055 });
    }
}

function toggleMode() {
    const next = currentRadioMode() === 'sim' ? 'workout' : 'sim';
    setModeRadio(next);
    setModeUi(next);
    if (next === 'sim') {
        stopWorkout();
        const g = simAuto.checked ? gradeAt(state.totalDistanceM) : toFloat(simGrade.value, 0);
        setSlopeTarget(g);
        state.workout.currentTargetText = `grade ${state.currentGrade.toFixed(1)}%`;
        targetEl.textContent = state.workout.currentTargetText;
        return;
    }
    state.sim.source = 'workout';
    state.workout.currentTargetText = '--';
    targetEl.textContent = state.workout.currentTargetText;
}

function tickWorkout(nowMs) {
    if (!state.workout.running) return;
    if (state.workout.paused) return;
    const step = state.workout.steps[state.workout.stepIndex];
    if (!step) {
        stopWorkout();
        return;
    }
    const workoutNowMs = getWorkoutNowMs(nowMs);
    const elapsed = (workoutNowMs - state.workout.stepStartedAt) / 1000;
    if (elapsed < step.sec) return;

    state.workout.stepIndex += 1;
    state.workout.stepStartedAt = workoutNowMs;
    const next = state.workout.steps[state.workout.stepIndex];
    if (!next) {
        stopWorkout();
        return;
    }
    applyWorkoutStep(next);
    beep.play({ freq: 1080, durationMs: 90, gain: 0.055 });
}

function tickRoute(dtSec) {
    if (state.mode !== 'sim') return;
    if (state.workout.running && state.sim.source === 'workout') return;
    if (!simAuto.checked) return;
    state.sim.source = 'route';

    const wrapped = state.route.lengthM > 0 ? state.totalDistanceM % state.route.lengthM : state.totalDistanceM;
    const g = gradeAt(wrapped);
    setSlopeTarget(g);
    state.workout.currentTargetText = `grade ${state.currentGrade.toFixed(1)}%`;
    targetEl.textContent = state.workout.currentTargetText;
}

function updateDistanceUi() {
    distance.textContent = (state.totalDistanceM / 1000).toFixed(2);
}

function currentRadioMode() {
    const el = document.querySelector('input[name="mode"]:checked');
    return el?.value === 'sim' ? 'sim' : 'workout';
}

btnConnect.addEventListener('click', () => {
    xf.dispatch('ui:ble:controllable:switch');
});

btnReset.addEventListener('click', () => resetTrainer());
btnFullscreen?.addEventListener('click', () => toggleFullscreen());
document.addEventListener('fullscreenchange', () => updateFullscreenButton());

btnWorkoutStart.addEventListener('click', () => startWorkout());
btnWorkoutStop.addEventListener('click', () => stopWorkout());
btnWorkoutPause.addEventListener('click', () => togglePauseWorkout());
btnWorkoutNext.addEventListener('click', () => skipWorkoutStep());

workoutFile.addEventListener('change', async () => {
    const file = workoutFile.files?.[0];
    workoutFile.value = '';
    if (!file) return;
    try {
        const text = await file.text();
        const parsed = zwo.readToInterval(text);
        const id = `zwo:${Math.random().toString(16).slice(2)}`;
        workoutLibrary.unshift({
            id,
            type: 'zwo',
            name: parsed?.meta?.name ? `${parsed.meta.name} (.zwo)` : `${file.name}`,
            ...parsed,
        });
        populateWorkouts();
        workoutSelect.value = id;
    } catch (e) {
        console.error(e);
        alert('Could not load .zwo (check the file contents).');
    }
});

btnSimApply.addEventListener('click', () => {
    const g = toFloat(simGrade.value, 0);
    simGrade.value = String(g);
    if (currentRadioMode() !== 'sim') return;
    state.sim.source = 'manual';
    setSlopeTarget(g);
    state.workout.currentTargetText = `grade ${state.currentGrade.toFixed(1)}%`;
    targetEl.textContent = state.workout.currentTargetText;
});

btnRouteReset.addEventListener('click', () => {
    state.totalDistanceM = 0;
    updateDistanceUi();
    drawProfile();
});

document.addEventListener('change', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement)) return;
    if (t.name !== 'mode') return;
    const next = currentRadioMode();
    setModeUi(next);
    if (next === 'sim') {
        stopWorkout();
        const g = simAuto.checked ? gradeAt(state.totalDistanceM) : toFloat(simGrade.value, 0);
        setSlopeTarget(g);
        state.workout.currentTargetText = `grade ${state.currentGrade.toFixed(1)}%`;
        targetEl.textContent = state.workout.currentTargetText;
    }
});

simAuto.addEventListener('change', () => {
    if (currentRadioMode() !== 'sim') return;
    if (simAuto.checked) {
        state.sim.source = 'route';
        setSlopeTarget(gradeAt(state.totalDistanceM));
        return;
    }
    state.sim.source = 'manual';
    setSlopeTarget(toFloat(simGrade.value, 0));
});

difficultyEl?.addEventListener('change', () => {
    if (currentRadioMode() !== 'sim') return;
    // resend with the new scaling factor
    setSlopeTarget(state.currentGrade);
});

function getRideSettings() {
    const weight = clamp(toFloat(weightEl.value, 80), 40, 140);
    const difficultyPct = clamp(toInt(difficultyEl?.value, 100), 0, 200);
    const cda = clamp(toFloat(cdaEl.value, 0.32), 0.15, 0.6);
    const crr = clamp(toFloat(crrEl.value, 0.005), 0.001, 0.02);
    const wind = clamp(toFloat(windEl.value, 0), -10, 10);
    const virtualEnabled = !!virtualSpeedEl.checked;
    const enhanced = !!gfxEnhancedEl.checked;
    const leaderboard = !!gfxLeaderboardEl.checked;
    return { weight, difficultyPct, cda, crr, wind, virtualEnabled, enhanced, leaderboard };
}

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

function colorForGrade(grade) {
    if (grade >= 10) return 'rgba(255, 95, 86, 0.95)';
    if (grade >= 6) return 'rgba(255, 191, 0, 0.95)';
    if (grade >= 3) return 'rgba(50, 215, 75, 0.95)';
    if (grade <= -3) return 'rgba(10, 132, 255, 0.95)';
    return 'rgba(255,255,255,0.78)';
}

function seedNpcs() {
    if (state.rideVisual.seeded) return;
    state.rideVisual.seeded = true;
    const colors = ['#4C9AFF', '#FFB020', '#FF5F56', '#32D74B', '#BF5AF2', '#64D2FF'];
    state.rideVisual.npcs = Array.from({ length: 9 }, (_, i) => ({
        id: uid(),
        relM: (Math.random() * 260 - 130) | 0, // -130..130m relative to rider
        speedBias: Math.random() * 1.6 - 0.8, // -0.8..0.8 m/s
        color: colors[i % colors.length],
    }));
}

function updateNpcs(dtSec) {
    seedNpcs();
    const riderMps = state.mps;
    for (const npc of state.rideVisual.npcs) {
        const npcMps = clamp(riderMps + npc.speedBias, 0, 25);
        npc.relM += (npcMps - riderMps) * dtSec;
        if (npc.relM > 190) npc.relM = -190;
        if (npc.relM < -190) npc.relM = 190;
    }
}

function seedRoadsidePosts() {
    if (state.rideVisual.postsSeeded) return;
    state.rideVisual.postsSeeded = true;
    // posts exist in "world" z distance ahead of rider, recycled when behind.
    const posts = [];
    const maxZ = 220;
    for (let i = 0; i < 18; i += 1) {
        posts.push({
            z: (i / 18) * maxZ,
            side: i % 2 === 0 ? -1 : 1,
            jitter: Math.random() * 0.6 + 0.7,
        });
    }
    state.rideVisual.posts = posts;
}

function updateRoadsidePosts(dtSec) {
    seedRoadsidePosts();
    const posts = state.rideVisual.posts;
    const speed = Math.max(0, state.mps);
    for (const p of posts) {
        p.z -= speed * dtSec;
        if (p.z < 2) {
            p.z += 220;
            p.side = Math.random() < 0.5 ? -1 : 1;
            p.jitter = Math.random() * 0.6 + 0.7;
        }
    }
}

function updateRideAnimation(dtSec) {
    const rpm = Math.max(0, state.cadenceRpm);
    const crankRadPerSec = (rpm / 60) * Math.PI * 2;
    state.rideVisual.crankAngle = (state.rideVisual.crankAngle + crankRadPerSec * dtSec) % (Math.PI * 2);

    const wheelCircM = 2.1; // typical road wheel circumference
    const wheelRadPerSec = wheelCircM > 0 ? (state.mps / wheelCircM) * Math.PI * 2 : 0;
    state.rideVisual.wheelAngle = (state.rideVisual.wheelAngle + wheelRadPerSec * dtSec) % (Math.PI * 2);
}

    function drawRiderSprite({ x, y, scale = 1, angle = 0, color = 'rgba(76,154,255,0.95)', accent = 'rgba(255,255,255,0.85)', wheelAngle = 0, crankAngle = 0, alpha = 1 }) {
        const ctx = rideCtx;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.scale(scale, scale);
        ctx.globalAlpha = alpha;

    const wheelR = 10;
    const wheelBase = 38;
    const rearX = -wheelBase / 2;
    const frontX = wheelBase / 2;
    const wheelY = 0;

    // wheels
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(rearX, wheelY, wheelR, 0, Math.PI * 2);
    ctx.arc(frontX, wheelY, wheelR, 0, Math.PI * 2);
    ctx.stroke();

    // spokes (simple)
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    for (const wx of [rearX, frontX]) {
        for (let i = 0; i < 2; i += 1) {
            const a = wheelAngle + i * (Math.PI / 2);
            ctx.beginPath();
            ctx.moveTo(wx, wheelY);
            ctx.lineTo(wx + Math.cos(a) * wheelR, wheelY + Math.sin(a) * wheelR);
            ctx.stroke();
        }
    }

    // frame
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.6;
    const seatX = rearX + 12;
    const seatY = -12;
    const bbX = 0;
    const bbY = -6;
    const headX = frontX - 8;
    const headY = -16;

    ctx.beginPath();
    ctx.moveTo(rearX, wheelY);
    ctx.lineTo(bbX, bbY);
    ctx.lineTo(frontX, wheelY);
    ctx.moveTo(seatX, seatY);
    ctx.lineTo(bbX, bbY);
    ctx.lineTo(headX, headY);
    ctx.stroke();

    // handlebar + saddle
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(headX - 6, headY - 2);
    ctx.lineTo(headX + 10, headY - 2);
    ctx.moveTo(seatX - 8, seatY - 2);
    ctx.lineTo(seatX + 6, seatY - 2);
    ctx.stroke();

    // crank + pedal (animated by cadence)
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    const crankLen = 10;
    const px = bbX + Math.cos(crankAngle) * crankLen;
    const py = bbY + Math.sin(crankAngle) * crankLen;
    ctx.beginPath();
    ctx.arc(bbX, bbY, 3.2, 0, Math.PI * 2);
    ctx.moveTo(bbX, bbY);
    ctx.lineTo(px, py);
    ctx.stroke();

    // rider head + torso
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(seatX + 10, seatY - 16, 5.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(seatX + 8, seatY - 12);
    ctx.lineTo(headX - 2, headY - 5);
    ctx.stroke();

    ctx.restore();
}

function drawGaugeArc({ x, y, r, pct, label, value, color }) {
    const start = Math.PI * 0.75;
    const end = Math.PI * 2.25;
    const span = end - start;
    const clamped = clamp(pct, 0, 1);
    rideCtx.save();
    rideCtx.translate(x, y);
    rideCtx.lineWidth = 8;
    rideCtx.lineCap = 'round';

    rideCtx.strokeStyle = 'rgba(255,255,255,0.10)';
    rideCtx.beginPath();
    rideCtx.arc(0, 0, r, start, end);
    rideCtx.stroke();

    rideCtx.strokeStyle = color;
    rideCtx.beginPath();
    rideCtx.arc(0, 0, r, start, start + span * clamped);
    rideCtx.stroke();

    rideCtx.fillStyle = 'rgba(255,255,255,0.75)';
    rideCtx.font = '11px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    rideCtx.textAlign = 'center';
    rideCtx.fillText(label, 0, 6);

    rideCtx.fillStyle = 'rgba(255,255,255,0.92)';
    rideCtx.font = 'bold 14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    rideCtx.fillText(value, 0, 24);
    rideCtx.restore();
}

function drawLeaderboard({ x, y, w, h }) {
    if (!state.rideVisual.leaderboard) return;
    const npcs = state.rideVisual.npcs;
    if (!npcs.length) return;

    rideCtx.save();
    rideCtx.translate(x, y);
    rideCtx.fillStyle = 'rgba(0,0,0,0.22)';
    rideCtx.strokeStyle = 'rgba(255,255,255,0.14)';
    rideCtx.lineWidth = 1;
    rideCtx.beginPath();
    rideCtx.rect(0, 0, w, h);
    rideCtx.fill();
    rideCtx.stroke();

    rideCtx.fillStyle = 'rgba(255,255,255,0.80)';
    rideCtx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    rideCtx.fillText('Nearby', 10, 18);

    rideCtx.font = '11px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    let yy = 38;
    // "You" is always fixed; show closest 5 by abs distance
    const closest = npcs
        .map((n) => ({ ...n, abs: Math.abs(n.relM) }))
        .sort((a, b) => a.abs - b.abs)
        .slice(0, 5)
        .sort((a, b) => b.relM - a.relM);

    // you row
    rideCtx.fillStyle = 'rgba(76,154,255,0.95)';
    rideCtx.fillRect(10, yy - 9, 8, 8);
    rideCtx.fillStyle = 'rgba(255,255,255,0.90)';
    rideCtx.fillText('You', 24, yy);
    rideCtx.fillStyle = 'rgba(255,255,255,0.70)';
    rideCtx.fillText('0 m', w - 44, yy);
    yy += 18;

    if (state.ghost.enabled && typeof state.ghost.relM === 'number') {
        rideCtx.fillStyle = 'rgba(191,90,242,0.95)';
        rideCtx.fillRect(10, yy - 9, 8, 8);
        rideCtx.fillStyle = 'rgba(255,255,255,0.86)';
        const dir = state.ghost.relM >= 0 ? 'ahead' : 'behind';
        rideCtx.fillText(`You (prev) ${dir}`, 24, yy);
        rideCtx.fillStyle = 'rgba(255,255,255,0.70)';
        rideCtx.fillText(`${Math.abs(Math.round(state.ghost.relM))} m`, w - 54, yy);
        yy += 18;
    }

    for (const n of closest) {
        rideCtx.fillStyle = n.color;
        rideCtx.fillRect(10, yy - 9, 8, 8);
        rideCtx.fillStyle = 'rgba(255,255,255,0.86)';
        const dir = n.relM >= 0 ? 'ahead' : 'behind';
        rideCtx.fillText(`${dir}`, 24, yy);
        rideCtx.fillStyle = 'rgba(255,255,255,0.70)';
        rideCtx.fillText(`${Math.abs(Math.round(n.relM))} m`, w - 54, yy);
        yy += 18;
        if (yy > h - 10) break;
    }

    rideCtx.restore();
}

function prepareCanvas(canvas, context) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, Math.round((window.devicePixelRatio || 1) * 100) / 100);
    const cssW = Math.max(1, Math.round(rect.width));
    const cssH = Math.max(1, Math.round(rect.height));
    const pxW = Math.max(1, Math.round(cssW * dpr));
    const pxH = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== pxW) canvas.width = pxW;
    if (canvas.height !== pxH) canvas.height = pxH;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: cssW, h: cssH, dpr };
}

function drawMiniRouteStrip({ x, y, w, h }) {
    if (!state.route.points.length || state.route.lengthM <= 0) return;
    const pts = state.route.points;
    let minE = Infinity;
    let maxE = -Infinity;
    for (const p of pts) {
        minE = Math.min(minE, p.e);
        maxE = Math.max(maxE, p.e);
    }
    const eRange = Math.max(1, maxE - minE);

    rideCtx.save();
    rideCtx.translate(x, y);

    // background box
    rideCtx.fillStyle = 'rgba(0,0,0,0.22)';
    rideCtx.strokeStyle = 'rgba(255,255,255,0.16)';
    rideCtx.lineWidth = 1;
    rideCtx.beginPath();
    rideCtx.rect(0, 0, w, h);
    rideCtx.fill();
    rideCtx.stroke();

    const pad = 6;
    const innerW = w - pad * 2;
    const innerH = h - pad * 2;

    // profile line
    rideCtx.strokeStyle = 'rgba(255,255,255,0.50)';
    rideCtx.lineWidth = 1.5;
    rideCtx.beginPath();
    for (let i = 0; i < pts.length; i += 1) {
        const px = pad + (pts[i].d / state.route.lengthM) * innerW;
        const py = pad + (1 - (pts[i].e - minE) / eRange) * innerH;
        if (i === 0) rideCtx.moveTo(px, py);
        else rideCtx.lineTo(px, py);
    }
    rideCtx.stroke();

    // rider marker
    const wrappedDistance = state.route.lengthM > 0 ? state.totalDistanceM % state.route.lengthM : state.totalDistanceM;
    const rx = pad + (wrappedDistance / state.route.lengthM) * innerW;
    const re = elevationAt(wrappedDistance);
    const ry = pad + (1 - (re - minE) / eRange) * innerH;
    rideCtx.fillStyle = 'rgba(76,154,255,0.95)';
    rideCtx.beginPath();
    rideCtx.arc(rx, ry, 3.8, 0, Math.PI * 2);
    rideCtx.fill();

    rideCtx.restore();
}

function drawRide(dtSec = 0) {
    state.rideVisual.enhanced = !!gfxEnhancedEl.checked;
    state.rideVisual.leaderboard = !!gfxLeaderboardEl.checked;

    const { w, h } = prepareCanvas(ride, rideCtx);
    rideCtx.clearRect(0, 0, w, h);

    updateNpcs(dtSec);
    updateRoadsidePosts(dtSec);
    updateRideAnimation(dtSec);

    // sky gradient
    const sky = rideCtx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, 'rgba(30,32,45,1)');
    sky.addColorStop(0.6, 'rgba(24,26,36,1)');
    sky.addColorStop(1, 'rgba(18,19,26,1)');
    rideCtx.fillStyle = sky;
    rideCtx.fillRect(0, 0, w, h);

    // distant mountains (parallax)
    const base = h * 0.62;
    const parallax = (state.totalDistanceM * 0.02) % w;
    rideCtx.fillStyle = 'rgba(255,255,255,0.06)';
    rideCtx.beginPath();
    rideCtx.moveTo(-w, base);
    for (let x = -w; x <= w * 2; x += 120) {
        const px = x - parallax;
        const peak = base - 40 - (Math.sin((x + state.totalDistanceM * 0.01) / 220) * 22 + 22);
        rideCtx.lineTo(px + 60, peak);
        rideCtx.lineTo(px + 120, base);
    }
    rideCtx.lineTo(w * 2, base);
    rideCtx.lineTo(w * 2, h);
    rideCtx.lineTo(-w, h);
    rideCtx.closePath();
    rideCtx.fill();

    const pad = 16;
    const roadY = h * 0.72;
    const horizonY = h * 0.22;
    const grade = clamp(state.currentGrade, -15, 20);
    const tilt = clamp(grade / 100, -0.16, 0.2);
    const roadWNear = w * 0.92;
    const roadWFar = w * 0.22;
    const centerX = w * 0.52;
    const farX = centerX + tilt * (w * 0.5);

    const leftNear = { x: centerX - roadWNear / 2, y: roadY };
    const rightNear = { x: centerX + roadWNear / 2, y: roadY };
    const leftFar = { x: farX - roadWFar / 2, y: horizonY };
    const rightFar = { x: farX + roadWFar / 2, y: horizonY };

    // ground
    rideCtx.fillStyle = 'rgba(255,255,255,0.035)';
    rideCtx.beginPath();
    rideCtx.moveTo(0, roadY);
    rideCtx.lineTo(w, roadY);
    rideCtx.lineTo(w, h);
    rideCtx.lineTo(0, h);
    rideCtx.closePath();
    rideCtx.fill();

    // road (perspective trapezoid)
    rideCtx.fillStyle = 'rgba(255,255,255,0.08)';
    rideCtx.beginPath();
    rideCtx.moveTo(leftNear.x, leftNear.y);
    rideCtx.lineTo(rightNear.x, rightNear.y);
    rideCtx.lineTo(rightFar.x, rightFar.y);
    rideCtx.lineTo(leftFar.x, leftFar.y);
    rideCtx.closePath();
    rideCtx.fill();

    // edges
    rideCtx.strokeStyle = 'rgba(255,255,255,0.20)';
    rideCtx.lineWidth = 2;
    rideCtx.beginPath();
    rideCtx.moveTo(leftNear.x, leftNear.y);
    rideCtx.lineTo(leftFar.x, leftFar.y);
    rideCtx.moveTo(rightNear.x, rightNear.y);
    rideCtx.lineTo(rightFar.x, rightFar.y);
    rideCtx.stroke();

    // center line stripes (world->screen)
    const speed = Math.max(0, state.mps);
    const stride = 22;
    const offset = (state.totalDistanceM * 0.9) % stride;
    for (let zz = 0; zz < 240; zz += stride) {
        const z = zz + offset;
        const t = clamp(z / 220, 0, 1);
        const y = roadY - (roadY - horizonY) * t;
        const roadW = roadWNear - (roadWNear - roadWFar) * t;
        const cx = centerX + (farX - centerX) * t;
        const x = cx;
        const segW = roadW * 0.03;
        const segH = 12 - t * 10;
        rideCtx.fillStyle = 'rgba(255,255,255,0.12)';
        rideCtx.fillRect(x - segW / 2, y - segH, segW, segH);
    }

    // roadside posts
    if (state.rideVisual.enhanced) {
        for (const p of state.rideVisual.posts) {
            const t = clamp(p.z / 220, 0, 1);
            const y = roadY - (roadY - horizonY) * t;
            const roadW = roadWNear - (roadWNear - roadWFar) * t;
            const cx = centerX + (farX - centerX) * t;
            const x = cx + p.side * (roadW * 0.55) * p.jitter;
            const size = 7 - t * 5;
            rideCtx.fillStyle = 'rgba(255,255,255,0.14)';
            rideCtx.fillRect(x - size / 2, y - size * 2.2, size, size * 2.2);
        }
    }

    // rider (fixed screen position)
    const riderX = centerX;
    const riderY = roadY - 18;
    const vanishing = { x: farX, y: horizonY };

    // ghost rider (your previous run)
    if (state.rideVisual.enhanced && state.ghost.enabled && typeof state.ghost.relM === 'number') {
        const rel = clamp(state.ghost.relM, -140, 140);
        const ahead = rel >= 0;
        const z = ahead ? clamp(rel, 0, 140) : clamp(Math.abs(rel), 0, 140);
        const t = clamp(z / 160, 0, 1);
        const y = roadY - (roadY - horizonY) * t;
        const roadW = roadWNear - (roadWNear - roadWFar) * t;
        const cx = centerX + (farX - centerX) * t;
        const x = cx + (roadW * 0.04);
        const s = 0.55 + (1 - t) * 0.55;
        const angle = Math.atan2(vanishing.y - (y - 6), vanishing.x - x);
        drawRiderSprite({
            x,
            y: y - 6,
            scale: s,
            angle,
            color: 'rgba(191,90,242,0.95)',
            accent: 'rgba(255,255,255,0.70)',
            wheelAngle: state.rideVisual.wheelAngle + t,
            crankAngle: state.rideVisual.crankAngle + t,
            alpha: 0.75,
        });
    }

    // NPC riders
    if (state.rideVisual.enhanced) {
        for (const npc of state.rideVisual.npcs) {
            const rel = clamp(npc.relM, -140, 140);
            const ahead = rel >= 0;
            const z = ahead ? clamp(rel, 0, 140) : clamp(Math.abs(rel), 0, 140);
            const t = clamp(z / 160, 0, 1);
            const y = roadY - (roadY - horizonY) * t;
            const roadW = roadWNear - (roadWNear - roadWFar) * t;
            const cx = centerX + (farX - centerX) * t;
            const laneOffset = (npc.id.charCodeAt(0) % 3) - 1;
            const x = cx + laneOffset * (roadW * 0.12) + (Math.sin((state.totalDistanceM + z) / 50) * 2);
            const s = 0.55 + (1 - t) * 0.55;
            const angle = Math.atan2(vanishing.y - (y - 6), vanishing.x - x);
            drawRiderSprite({
                x,
                y: y - 6,
                scale: s,
                angle,
                color: npc.color,
                accent: 'rgba(255,255,255,0.70)',
                wheelAngle: state.rideVisual.wheelAngle + t,
                crankAngle: state.rideVisual.crankAngle + t,
                alpha: 0.65,
            });
        }
    }

    // main rider
    if (state.rideVisual.enhanced) {
        const angle = Math.atan2(vanishing.y - (riderY + 10), vanishing.x - riderX);
        drawRiderSprite({
            x: riderX,
            y: riderY + 10,
            scale: 1.15,
            angle,
            color: 'rgba(76,154,255,0.95)',
            accent: 'rgba(255,255,255,0.86)',
            wheelAngle: state.rideVisual.wheelAngle,
            crankAngle: state.rideVisual.crankAngle,
            alpha: 1,
        });
    } else {
        rideCtx.fillStyle = 'rgba(76,154,255,0.95)';
        rideCtx.beginPath();
        rideCtx.arc(riderX, riderY, 12, 0, Math.PI * 2);
        rideCtx.fill();
    }

    // HUD
    rideCtx.fillStyle = 'rgba(255,255,255,0.78)';
    rideCtx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    const speedSource = state.virtual.enabled ? 'virtual' : 'measured';
    rideCtx.fillText(`Speed (${speedSource}): ${Math.round(state.kmh)} km/h`, pad, 18);
    rideCtx.fillText(`Power: ${Math.round(state.powerW)} W  ·  W/kg: ${wkgEl.textContent}`, pad, 36);
    rideCtx.fillStyle = colorForGrade(state.currentGrade);
    rideCtx.fillText(`Grade: ${state.currentGrade.toFixed(1)}%`, pad, 54);

    drawMiniRouteStrip({ x: w - pad - 260, y: pad - 2, w: 260, h: 44 });
    drawLeaderboard({ x: w - pad - 130, y: 54, w: 130, h: 118 });

    // gauges
    if (state.rideVisual.enhanced) {
        const ftpValue = clamp(toInt(ftp.value, 250), 50, 2000);
        const powerPct = ftpValue > 0 ? state.powerW / (ftpValue * 1.6) : 0;
        const cad = state.cadenceRpm;
        drawGaugeArc({
            x: 82,
            y: h - 58,
            r: 34,
            pct: powerPct,
            label: 'PWR',
            value: `${Math.round(state.powerW)}W`,
            color: 'rgba(76,154,255,0.9)',
        });
        drawGaugeArc({
            x: 190,
            y: h - 58,
            r: 34,
            pct: cad / 120,
            label: 'CAD',
            value: `${cad}rpm`,
            color: 'rgba(50,215,75,0.9)',
        });
    }

    if (state.workout.running) {
        rideCtx.fillStyle = state.workout.paused ? 'rgba(255,191,0,0.95)' : 'rgba(50,215,75,0.95)';
        rideCtx.fillText(state.workout.paused ? 'WORKOUT · PAUSED' : 'WORKOUT', w - pad - 150, 66);
    }

    // vignette + speed lines
    if (state.rideVisual.enhanced) {
        const speedKmh = Math.max(0, state.kmh);
        const v = clamp(speedKmh / 45, 0, 1);
        // speed lines
        if (v > 0.2) {
            rideCtx.save();
            rideCtx.globalAlpha = 0.10 + v * 0.18;
            rideCtx.strokeStyle = 'rgba(255,255,255,0.65)';
            rideCtx.lineWidth = 1;
            const count = 10;
            for (let i = 0; i < count; i += 1) {
                const yy = horizonY + (i / count) * (roadY - horizonY);
                const len = 30 + v * 90;
                const xx0 = pad + (Math.sin((state.totalDistanceM / 20) + i) * 30);
                rideCtx.beginPath();
                rideCtx.moveTo(xx0, yy);
                rideCtx.lineTo(xx0 + len, yy - 8);
                rideCtx.stroke();
                const xx1 = w - pad - (Math.cos((state.totalDistanceM / 18) + i) * 30);
                rideCtx.beginPath();
                rideCtx.moveTo(xx1, yy);
                rideCtx.lineTo(xx1 - len, yy - 8);
                rideCtx.stroke();
            }
            rideCtx.restore();
        }
        // vignette
        const vg = rideCtx.createRadialGradient(w * 0.5, h * 0.55, h * 0.1, w * 0.5, h * 0.55, h * 0.9);
        vg.addColorStop(0, 'rgba(0,0,0,0)');
        vg.addColorStop(1, 'rgba(0,0,0,0.35)');
        rideCtx.fillStyle = vg;
        rideCtx.fillRect(0, 0, w, h);
    }
}

// BLE connection status (emitted by ReactiveConnectable)
xf.sub('ble:controllable:connecting', () => setStatus('connecting'));
xf.sub('ble:controllable:connected', () => setStatus('connected'));
xf.sub('ble:controllable:disconnected', () => setStatus('disconnected'));
xf.sub('ble:controllable:name', (name) => {
    deviceName.textContent = name || '--';
});

xf.sub('db:power', (v) => {
    power.textContent = v ?? '--';
    state.powerW = typeof v === 'number' ? v : 0;
});
xf.sub('db:cadence', (v) => {
    cadence.textContent = v ?? '--';
    state.cadenceRpm = typeof v === 'number' ? v : 0;
});
xf.sub('db:speed', (value) => {
    if (typeof value !== 'number') {
        state.speedMeasuredKmh = 0;
        return;
    }
    // Heuristic: some code paths store km/h already.
    const kmh = value > 25 ? value : models.speed.mpsToKmh(value);
    if (!Number.isFinite(kmh)) {
        state.speedMeasuredKmh = 0;
        return;
    }
    state.speedMeasuredKmh = kmh;
});
xf.sub('db:heartRate', (v) => {
    hr.textContent = v ?? '--';
});

buildRoute();
workoutLibrary.push(...builtinWorkouts);
populateWorkouts();
setStatus('disconnected');
setModeUi('workout');
setSlopeTarget(0);
updateDistanceUi();
drawProfile();
drawRide(0);
btnWorkoutNext.disabled = true;
btnWorkoutPause.disabled = true;
btnWorkoutStop.disabled = true;
setWorkoutFocusUi(false);
updateFullscreenButton();

const initial = loadSettings();
if (typeof initial.virtualSpeed === 'boolean') virtualSpeedEl.checked = initial.virtualSpeed;
if (typeof initial.weight === 'number') weightEl.value = String(initial.weight);
if (typeof initial.difficultyPct === 'number') difficultyEl.value = String(initial.difficultyPct);
if (typeof initial.cda === 'number') cdaEl.value = String(initial.cda);
if (typeof initial.crr === 'number') crrEl.value = String(initial.crr);
if (typeof initial.wind === 'number') windEl.value = String(initial.wind);
if (typeof initial.workoutSound === 'boolean') workoutSound.checked = initial.workoutSound;
if (typeof initial.builderName === 'string') builderName.value = initial.builderName;
if (Array.isArray(initial.builderSteps)) state.builder.steps = initial.builderSteps;
if (typeof initial.gfxEnhanced === 'boolean') gfxEnhancedEl.checked = initial.gfxEnhanced;
if (typeof initial.gfxLeaderboard === 'boolean') gfxLeaderboardEl.checked = initial.gfxLeaderboard;
if (typeof initial.ghostEnabled === 'boolean') ghostEnabledEl.checked = initial.ghostEnabled;
if (typeof initial.ghostAutoSave === 'boolean') ghostAutoSaveEl.checked = initial.ghostAutoSave;
renderBuilder();

state.ghost.run = loadGhostRun();
state.ghost.enabled = !!ghostEnabledEl?.checked && !!state.ghost.run;
btnGhostClear?.addEventListener('click', () => {
    clearGhostRun();
    state.ghost.enabled = false;
    if (ghostEnabledEl) ghostEnabledEl.checked = false;
    persistSettings();
});
ghostEnabledEl?.addEventListener('change', () => {
    state.ghost.run = loadGhostRun();
    state.ghost.enabled = !!ghostEnabledEl.checked && !!state.ghost.run;
    persistSettings();
});

function updateWorkoutPreview() {
    const ftpValue = clamp(toInt(ftp.value, 250), 50, 2000);
    const w = getSelectedWorkout();
    const steps = normalizeWorkoutToSteps(w, ftpValue);
    drawWorkoutTimeline({ steps, ftpValue, nowMs: performance.now() });
}
workoutSelect.addEventListener('change', () => {
    if (state.workout.running) stopWorkout();
    updateWorkoutPreview();
});
ftp.addEventListener('input', () => {
    if (!state.workout.running) updateWorkoutPreview();
});

updateWorkoutPreview();

function persistSettings() {
    const s = getRideSettings();
    saveSettings({
        virtualSpeed: s.virtualEnabled,
        weight: s.weight,
        difficultyPct: s.difficultyPct,
        cda: s.cda,
        crr: s.crr,
        wind: s.wind,
        workoutSound: !!workoutSound.checked,
        builderName: builderName.value,
        builderSteps: state.builder.steps,
        gfxEnhanced: !!gfxEnhancedEl.checked,
        gfxLeaderboard: !!gfxLeaderboardEl.checked,
        ghostEnabled: !!ghostEnabledEl?.checked,
        ghostAutoSave: !!ghostAutoSaveEl?.checked,
    });
}
for (const el of [virtualSpeedEl, weightEl, difficultyEl, cdaEl, crrEl, windEl, workoutSound, gfxEnhancedEl, gfxLeaderboardEl, ghostEnabledEl, ghostAutoSaveEl]) {
    el.addEventListener('change', persistSettings);
}

builderName.addEventListener('change', persistSettings);

builderAddErg.addEventListener('click', () => {
    addBuilderErgStep();
    persistSettings();
});
builderAddSim.addEventListener('click', () => {
    addBuilderSimStep();
    persistSettings();
});
builderClear.addEventListener('click', () => {
    clearBuilder();
    persistSettings();
});
builderExport.addEventListener('click', () => {
    if (!state.builder.steps.length) {
        alert('Add at least one step first.');
        return;
    }
    const workoutObject = buildWorkoutObjectFromBuilder();
    const xml = workoutObjectToZwoXml(workoutObject);
    const safeName = workoutObject.meta.name.replace(/[^\w.-]+/g, '_').slice(0, 64) || 'workout';
    downloadTextFile({ name: `${safeName}.zwo`, text: xml });
});
builderLoad.addEventListener('click', () => {
    if (!state.builder.steps.length) {
        alert('Add at least one step first.');
        return;
    }
    const workoutObject = buildWorkoutObjectFromBuilder();
    const xml = workoutObjectToZwoXml(workoutObject);
    const parsed = zwo.readToInterval(xml);
    const id = `zwo:${Math.random().toString(16).slice(2)}`;
    workoutLibrary.unshift({
        id,
        type: 'zwo',
        name: `${workoutObject.meta.name} (builder)`,
        ...parsed,
    });
    populateWorkouts();
    workoutSelect.value = id;
    persistSettings();
});

builderRows.addEventListener('click', (e) => {
    const btn = e.target instanceof HTMLElement ? e.target.closest('button[data-action]') : null;
    if (!btn) return;
    const row = btn.closest('[data-id]');
    const id = row?.dataset?.id;
    if (!id) return;

    const steps = state.builder.steps;
    const idx = steps.findIndex((s) => s.id === id);
    if (idx === -1) return;

    const action = btn.dataset.action;
    if (action === 'remove') {
        steps.splice(idx, 1);
        renderBuilder();
        persistSettings();
        return;
    }
    if (action === 'up' && idx > 0) {
        const [x] = steps.splice(idx, 1);
        steps.splice(idx - 1, 0, x);
        renderBuilder();
        persistSettings();
        return;
    }
    if (action === 'down' && idx < steps.length - 1) {
        const [x] = steps.splice(idx, 1);
        steps.splice(idx + 1, 0, x);
        renderBuilder();
        persistSettings();
    }
});

builderRows.addEventListener('input', (e) => {
    const input = e.target instanceof HTMLInputElement ? e.target : null;
    if (!input) return;
    const row = input.closest('[data-id]');
    const id = row?.dataset?.id;
    const field = input.dataset.field;
    if (!id || !field) return;

    const step = state.builder.steps.find((s) => s.id === id);
    if (!step) return;

    if (field === 'name') {
        step.name = input.value;
        persistSettings();
        return;
    }
    if (field === 'sec') {
        step.sec = clamp(toInt(input.value, step.sec ?? 60), 5, 6 * 60 * 60);
        renderBuilder();
        persistSettings();
        return;
    }
    if (field === 'percent') {
        step.percent = clamp(toFloat(input.value, step.percent ?? 60), 0, 200);
        persistSettings();
        return;
    }
    if (field === 'grade') {
        step.grade = clamp(toFloat(input.value, step.grade ?? 0), -10, 20);
        persistSettings();
    }
});

let last = performance.now();
function loop(now) {
    const dt = clamp((now - last) / 1000, 0, 1);
    last = now;

    const rideSettings = getRideSettings();
    state.virtual.enabled = rideSettings.virtualEnabled;
    state.sim.difficulty = clamp(rideSettings.difficultyPct / 100, 0, 2);

    const effectiveGrade = state.currentGrade * state.sim.difficulty;
    const vMps = state.virtual.enabled
        ? solveSpeedMps({ powerW: state.powerW, grade: effectiveGrade, settings: rideSettings })
        : state.speedMeasuredKmh / 3.6;

    // Smooth virtual speed a bit
    const alpha = clamp(dt * 2.5, 0, 1);
    state.virtual.mps = state.virtual.enabled ? state.virtual.mps + (vMps - state.virtual.mps) * alpha : vMps;
    const speedMps = state.virtual.enabled ? state.virtual.mps : vMps;

    state.mps = speedMps;
    state.kmh = speedMps * 3.6;
    speed.textContent = Number.isFinite(state.kmh) ? String(Math.round(state.kmh)) : '--';

    const wkg = rideSettings.weight > 0 ? state.powerW / rideSettings.weight : NaN;
    wkgEl.textContent = Number.isFinite(wkg) ? wkg.toFixed(1) : '--';

    if (state.mode === 'workout') {
        tickWorkout(now);
    } else {
        tickRoute(dt);
    }

    // Distance always progresses based on chosen speed source (unless paused in a workout).
    const distanceDt = state.workout.running && state.workout.paused ? 0 : dt;
    const nextDistance = state.totalDistanceM + speedMps * distanceDt;
    state.totalDistanceM = Number.isFinite(nextDistance) ? nextDistance : state.totalDistanceM;

    // Ghost recording/playback uses workout time (excluding pauses) and distance since workout start.
    if (state.workout.running) {
        const workoutNowMs = getWorkoutNowMs(now);
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

    // Keep currentGrade in sync with mode/source
    if (state.mode === 'sim' && state.sim.source === 'route' && simAuto.checked) {
        const wrapped = state.route.lengthM > 0 ? state.totalDistanceM % state.route.lengthM : state.totalDistanceM;
        const g = clamp(gradeAt(wrapped), -10, 20);
        state.currentGrade = g;
        gradeEl.textContent = g.toFixed(1);
    }

    updateWorkoutUi(now);
    updateDistanceUi();
    drawProfile();
    drawRide(dt);
    if (state.workout.running) {
        const ftpValue = clamp(toInt(ftp.value, 250), 50, 2000);
        drawWorkoutTimeline({ steps: state.workout.steps, ftpValue, nowMs: now });
    }
    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

document.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) ? String(e.target.tagName).toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    if (e.key === ' ' || e.code === 'Space') {
        // Space toggles pause during workout
        if (!state.workout.running) return;
        e.preventDefault();
        togglePauseWorkout();
        return;
    }
    if (e.key === 'p' || e.key === 'P') {
        if (!state.workout.running) return;
        e.preventDefault();
        togglePauseWorkout();
        return;
    }
    if (e.key === 'n' || e.key === 'N') {
        if (!state.workout.running) return;
        e.preventDefault();
        skipWorkoutStep();
        return;
    }
    if (e.key === 's' || e.key === 'S') {
        // Start workout
        e.preventDefault();
        startWorkout();
        return;
    }
    if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        toggleMode();
        return;
    }
    if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
        return;
    }
    if (e.key === 'Escape') {
        e.preventDefault();
        if (state.workout.running) stopWorkout();
    }
});
