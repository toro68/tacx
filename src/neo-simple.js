import { xf } from './functions.js';
import { logger } from './functions/logger.js';
import './db.js';
import './ble/devices.js';
import { ControlMode } from './ble/enums.js';
import { models } from './models/models.js';
import { zwo } from './workouts/zwo.js';
import { parseTrainerMessage } from './trainer-messages.js';
import { loadSettings, saveSettings, loadZwoLibrary, storeZwoWorkout } from './neo-simple/persistence.js';
import { elevationAt as elevationAtImpl, gradeAt as gradeAtImpl, hashSeed } from './neo-simple/routes.js';
import { createHillsController } from './neo-simple/hills.js';
import { drawRouteProfile } from './neo-simple/profile.js';
import { prepareCanvas } from './neo-simple/canvas.js';
import { createRideRenderer } from './neo-simple/ride-render.js';
import { createRideLoop } from './neo-simple/ride-loop.js';
import { createSettingsController } from './neo-simple/settings.js';
import { createToast } from './neo-simple/toast.js';
import { createBuilderController } from './neo-simple/builder.js';
import { clamp, createWarnOnce, formatElapsed, formatRemaining, toFloat, toInt, uid } from './neo-simple/utils.js';
import { createWorkoutController } from './neo-simple/workout.js';
import { createTrainerTargets } from './neo-simple/trainer-targets.js';

const log = logger('neo-simple');

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
const btnWorkoutLoad = $('btn-workout-load');
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
const intensityLive = $('intensity-live');
const btnIntensityDown = $('btn-intensity-down');
const btnIntensityUp = $('btn-intensity-up');
const intensitySlider = $('intensity-slider');
const difficultySlider = $('difficulty-slider');
const difficultyLive = $('difficulty-live');
const btnDifficultyDown = $('btn-difficulty-down');
const btnDifficultyUp = $('btn-difficulty-up');
const loadTarget = $('load-target');
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
const workoutVisual = $('workout-visual');
const rideSettings = $('ride-settings');
const btnRideSettings = $('btn-ride-settings');
const controlSource = $('control-source');
const rideControlSource = $('ride-control-source');
const rideIntensityLive = $('ride-intensity-live');
const btnRideIntensityDown = $('btn-ride-intensity-down');
const btnRideIntensityUp = $('btn-ride-intensity-up');
const rideDifficultyLive = $('ride-difficulty-live');
const btnRideDifficultyDown = $('btn-ride-difficulty-down');
const btnRideDifficultyUp = $('btn-ride-difficulty-up');

const simAuto = $('sim-auto');
const simGrade = $('sim-grade');
const simRoute = $('sim-route');
const btnRouteGenerate = $('btn-route-generate');
const btnSimApply = $('btn-sim-apply');
const btnRouteReset = $('btn-route-reset');
const routeLength = $('route-length');
const routeName = $('route-name');
const profile = $('profile');
const ctx = profile.getContext('2d');
const routeConfigRandom = $('route-config-random');
const routeConfigWorkout = $('route-config-workout');
const routeSeed = $('route-seed');
const routeLengthKm = $('route-length-km');
const routeMaxGrade = $('route-max-grade');
const routeAssumeKmh = $('route-assume-kmh');
const hintSimManual = $('hint-sim-manual');
const hintRouteApply = $('hint-route-apply');

const virtualSpeedEl = $('virtual-speed');
const weightEl = $('weight');
const difficultyEl = $('difficulty');
const intensityEl = $('intensity');
const ghostEnabledEl = $('ghost-enabled');
const ghostAutoSaveEl = $('ghost-auto-save');
const ghostSelectEl = $('ghost-select');
const ghostNameEl = $('ghost-name');
const btnGhostSaveName = $('btn-ghost-save-name');
const btnGhostDelete = $('btn-ghost-delete');
const cdaEl = $('cda');
const crrEl = $('crr');
const windEl = $('wind');
const gfxEnhancedEl = $('gfx-enhanced');
const gfxLeaderboardEl = $('gfx-leaderboard');
const gfxCrowdEl = $('gfx-crowd');
const ride = $('ride');
const rideCtx = ride.getContext('2d');
const trainerMsg = $('trainer-msg');
const toastHost = $('toast-host');

const CONTROL_LIMITS = {
    gradeMin: -40,
    gradeMax: 40,
    slopeThrottleMs: 550,
    slopeDeltaMin: 0.2,
    powerThrottleMs: 200,
    powerDeltaMin: 2,
};

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
        lastPowerSentAt: 0,
        lastPowerValue: null,
        resendTimerId: null,
        ackTimerId: null,
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
        crowd: 'many', // off | few | many
        npcs: [],
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
    trainer: {
        lastAt: 0,
        lastText: '',
        lastTone: 'ok',
    },
    db: {
        lock: false,
        mode: null,
    },
};

function setWorkoutFocusUi(running) {
    document.body.classList.toggle('neo-workout-running', !!running);
    // Also collapse optional panels to reduce clutter.
    const builder = document.getElementById('builder-details');
    if (builder instanceof HTMLDetailsElement) builder.open = false;
    const physics = document.getElementById('physics-details');
    if (physics instanceof HTMLDetailsElement) physics.open = false;
    if (workoutVisual instanceof HTMLDetailsElement) workoutVisual.open = !!running;
    if (rideSettings instanceof HTMLDetailsElement) rideSettings.open = !!running;
    const setupSlot = document.getElementById('setup-sticky-slot');
    const rideSlot = document.getElementById('ride-sticky-slot');
    const visual = document.getElementById('workout-visual');
    const rideVisualSlot = document.getElementById('ride-visual-slot');
    const setupVisualSlot = document.getElementById('setup-visual-slot');
    const rideCanvas = document.getElementById('ride');
    const setupRideCanvasSlot = document.getElementById('setup-ride-visual-slot');

    const stickyList = [];
    const stickyById = document.getElementById('neo-sticky');
    if (stickyById) stickyList.push(stickyById);
    else stickyList.push(...document.querySelectorAll('.neo-sticky'));

    if (running) {
        if (!rideSlot) warnOnce('neoSimple:missingRideStickySlot', 'NEO Simple: missing #ride-sticky-slot; ride HUD may be misplaced.');
        for (const sticky of stickyList) {
            if (sticky && rideSlot) rideSlot.appendChild(sticky);
        }
        if (rideCanvas && rideVisualSlot) rideVisualSlot.appendChild(rideCanvas);
        if (visual && rideVisualSlot) rideVisualSlot.appendChild(visual);
        if (visual && !rideVisualSlot) warnOnce('neoSimple:missingRideVisualSlot', 'NEO Simple: missing #ride-visual-slot; workout visual may be misplaced.');
    } else {
        if (!setupSlot) warnOnce('neoSimple:missingSetupStickySlot', 'NEO Simple: missing #setup-sticky-slot; setup HUD may be misplaced.');
        for (const sticky of stickyList) {
            if (sticky && setupSlot) setupSlot.appendChild(sticky);
        }
        if (visual && setupVisualSlot) setupVisualSlot.appendChild(visual);
        if (visual && !setupVisualSlot) warnOnce('neoSimple:missingSetupVisualSlot', 'NEO Simple: missing #setup-visual-slot; workout visual may be misplaced.');
        if (rideCanvas && setupRideCanvasSlot) setupRideCanvasSlot.appendChild(rideCanvas);
    }
}

function setStatus(text) {
    status.textContent = text;
}

function setButtonLoading(el, { loading, text }) {
    if (!el) return;
    el.toggleAttribute('aria-busy', !!loading);
    if (loading) {
        el.setAttribute('aria-disabled', 'true');
        if (el.hasAttribute('tabindex')) {
            el.dataset.prevTabindex = el.getAttribute('tabindex') ?? '';
        }
        el.setAttribute('tabindex', '-1');
    } else {
        el.removeAttribute('aria-disabled');
        if ('prevTabindex' in el.dataset) {
            const prev = el.dataset.prevTabindex;
            delete el.dataset.prevTabindex;
            if (prev === '') el.removeAttribute('tabindex');
            else el.setAttribute('tabindex', prev);
        }
    }

    if (el instanceof HTMLButtonElement) el.disabled = !!loading;
    if (text && typeof text === 'string') {
        const labelSpan = el.querySelector('span:not(.neo-spinner)');
        if (labelSpan) labelSpan.textContent = text;
    }

    const existing = el.querySelector('.neo-spinner');
    if (loading && !existing) {
        const sp = document.createElement('span');
        sp.className = 'neo-spinner';
        sp.setAttribute('aria-hidden', 'true');
        el.prepend(sp);
    }
    if (!loading && existing) existing.remove();
}

function setConnectUi(stateText) {
    if (!btnConnect) return;
    if (stateText === 'connecting') {
        setButtonLoading(btnConnect, { loading: true, text: 'Connecting…' });
        return;
    }
    setButtonLoading(btnConnect, { loading: false, text: stateText === 'connected' ? 'Disconnect' : 'Connect' });
}

function setTrainerMessage(text, tone = 'ok') {
    if (!trainerMsg) return;
    trainerMsg.textContent = text;
    trainerMsg.classList.remove('ok', 'warn', 'error');
    trainerMsg.classList.add(tone);
}

const warnOnce = createWarnOnce();

const { showToast } = createToast(toastHost);

function clampGrade(gradePercent) {
    return clamp(Number(gradePercent) || 0, CONTROL_LIMITS.gradeMin, CONTROL_LIMITS.gradeMax);
}

function readManualGrade({ commit = true } = {}) {
    if (!simGrade) return 0;
    const g = clamp(toFloat(simGrade.value, 0), CONTROL_LIMITS.gradeMin, CONTROL_LIMITS.gradeMax);
    const rounded = Math.round(g * 10) / 10;
    if (commit) simGrade.value = String(rounded);
    return rounded;
}

function readRouteLengthKm({ commit = true } = {}) {
    if (!routeLengthKm) return 5.2;
    const km = clamp(toFloat(routeLengthKm.value, 5.2), 1, 50);
    const rounded = Math.round(km * 10) / 10;
    if (commit) routeLengthKm.value = String(rounded);
    return rounded;
}

function readRouteMaxGrade({ commit = true } = {}) {
    if (!routeMaxGrade) return 18;
    const maxMagnitude = Math.max(1, Math.min(Math.abs(CONTROL_LIMITS.gradeMin), CONTROL_LIMITS.gradeMax));
    const g = clamp(Math.abs(toFloat(routeMaxGrade.value, 18)), 1, maxMagnitude);
    const rounded = Math.round(g);
    if (commit) routeMaxGrade.value = String(rounded);
    return rounded;
}

function readRouteAssumeKmh({ commit = true } = {}) {
    if (!routeAssumeKmh) return 28;
    const kmh = clamp(toFloat(routeAssumeKmh.value, 28), 5, 60);
    const rounded = Math.round(kmh * 2) / 2;
    if (commit) routeAssumeKmh.value = String(rounded);
    return rounded;
}

btnWorkoutLoad?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    workoutFile?.click();
});

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
    } catch (e) {
        log.warn('Failed to load ghost run from localStorage', e);
        return null;
    }
}

function loadGhostLibrary() {
    try {
        const raw = localStorage.getItem('neoSimple:ghosts');
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((g) => g && typeof g === 'object');
    } catch (e) {
        log.warn('Failed to load ghost library from localStorage', e);
        return [];
    }
}

function saveGhostLibrary(list) {
    try {
        localStorage.setItem('neoSimple:ghosts', JSON.stringify(list));
    } catch (e) {
        log.warn('Failed to save ghost library to localStorage', e);
    }
}

function ensureGhostId() {
    return `g_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function defaultGhostName(run) {
    const date = new Date(run.createdAt || Date.now());
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    return `${dd}.${mo} ${hh}:${mm}`;
}

function normalizeGhostRun(run) {
    const samples = run?.samples;
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
    const createdAt = typeof run.createdAt === 'number' ? run.createdAt : Date.now();
    const id = typeof run.id === 'string' && run.id ? run.id : ensureGhostId();
    const name = typeof run.name === 'string' ? run.name : '';
    const routeName = typeof run.routeName === 'string' ? run.routeName : '';
    return {
        id,
        version: 1,
        createdAt,
        name: name || defaultGhostName({ createdAt }),
        routeName,
        samples: normalized,
        totalTimeMs: typeof run.totalTimeMs === 'number' ? run.totalTimeMs : normalized[normalized.length - 1][0],
        totalDistanceM: typeof run.totalDistanceM === 'number' ? run.totalDistanceM : normalized[normalized.length - 1][1],
    };
}

function migrateSingleGhostIfNeeded() {
    const lib = loadGhostLibrary();
    if (lib.length) return;
    const single = loadGhostRun();
    if (!single) return;
    const normalized = normalizeGhostRun(single);
    if (!normalized) return;
    saveGhostLibrary([normalized]);
    try {
        localStorage.removeItem('neoSimple:ghost');
    } catch (e) {
        log.debug('Could not remove legacy ghost from localStorage', e);
    }
}

function setGhostActiveById(id) {
    const lib = loadGhostLibrary();
    const found = lib.find((g) => g.id === id) ?? null;
    state.ghost.run = found;
    state.ghost.enabled = !!ghostEnabledEl?.checked && !!found;
}

function renderGhostSelect() {
    if (!(ghostSelectEl instanceof HTMLSelectElement)) return;
    const lib = loadGhostLibrary();
    ghostSelectEl.innerHTML = '';
    const optNone = document.createElement('option');
    optNone.value = '';
    optNone.textContent = '—';
    ghostSelectEl.appendChild(optNone);

    lib
        .slice()
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .forEach((g) => {
            const opt = document.createElement('option');
            opt.value = g.id;
            const label = g.name || defaultGhostName(g);
            opt.textContent = `${label}${g.routeName ? ` · ${g.routeName}` : ''}`;
            ghostSelectEl.appendChild(opt);
        });
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

const trainerTargets = createTrainerTargets({
    state,
    limits: CONTROL_LIMITS,
    getIntensityPct: () => toInt(intensityEl?.value, 100),
    getDifficultyPct: () => toInt(difficultyEl?.value, 100),
    sendPower: (watts) => xf.dispatch('ui:power-target-set', watts),
    sendSlope: (grade) => xf.dispatch('ui:slope-target-set', grade),
});

function setPowerTarget(watts, options) {
    const scaled = trainerTargets.setPowerTarget(watts, options);
    if (loadTarget) loadTarget.textContent = `Selected target: ${scaled} W`;
    return scaled;
}

function setSlopeTarget(gradePercent, options) {
    const scaled = trainerTargets.setSlopeTarget(gradePercent, options);
    gradeEl.textContent = state.currentGrade.toFixed(1);
    if (state.mode === 'sim') {
        state.workout.currentTargetText = `grade ${scaled.toFixed(1)}%`;
        targetEl.textContent = state.workout.currentTargetText;
        if (loadTarget) loadTarget.textContent = `Selected grade: ${scaled.toFixed(1)}% · terrain ${state.currentGrade.toFixed(1)}%`;
    }
    return scaled;
}

function resetTrainer() {
    xf.dispatch('ui:trainer:reset');
}

function controlSourceText() {
    if (state.mode === 'workout') return 'ERG · workout';
    const src = state.sim?.source ?? 'manual';
    return `SIM · ${src}`;
}

function updateControlSourceUi() {
    const text = controlSourceText();
    if (controlSource) controlSource.textContent = text;
    if (rideControlSource) rideControlSource.textContent = text;
}

function setModeUi(next) {
    setModeRadio(next);
    state.mode = next;
    document.body.classList.toggle('neo-mode-workout', next === 'workout');
    document.body.classList.toggle('neo-mode-sim', next === 'sim');
    if (next === 'workout') {
        state.sim.source = 'workout';
        setControlMode(ControlMode.erg);
        state.workout.currentTargetText = '--';
        targetEl.textContent = state.workout.currentTargetText;
        if (loadTarget) loadTarget.textContent = 'Start a workout to set target power.';
        updateWorkoutPreview();
        updateControlSourceUi();
        return;
    }
    if (next === 'sim') {
        setControlMode(ControlMode.sim);
        state.sim.source = simAuto.checked ? 'route' : 'manual';
        const g = simAuto.checked ? gradeAt(state.totalDistanceM) : readManualGrade();
        setSlopeTarget(g);
        updateControlSourceUi();
        return;
    }
}

function buildRoute() {
    // Backwards compatible: default route on startup.
    hillsController?.buildRoute?.();
}

let hillsController;

function updateHillsUi() {
    hillsController?.updateHillsUi();
}

function applySelectedRoute({ quiet = false } = {}) {
    hillsController?.applySelectedRoute({ quiet });
    updateControlSourceUi();
}

function elevationAt(distanceM) {
    return elevationAtImpl(state.route, distanceM);
}

function gradeAt(distanceM) {
    return gradeAtImpl(state.route, distanceM);
}

function drawProfile() {
    drawRouteProfile({ canvas: profile, ctx, route: state.route, totalDistanceM: state.totalDistanceM });
}

hillsController = createHillsController({
    state,
    clamp,
    toInt,
    clampGrade,
    normalizeWorkoutToSteps,
    readRouteLengthKm,
    readRouteMaxGrade,
    readRouteAssumeKmh,
    setSlopeTarget,
    drawProfile,
    gradeAt,
    persistSettings,
    showToast,
    ftpEl: ftp,
    getSelectedWorkout,
    simRouteEl: simRoute,
    simAutoEl: simAuto,
    simGradeEl: simGrade,
    btnSimApplyEl: btnSimApply,
    hintSimManualEl: hintSimManual,
    hintRouteApplyEl: hintRouteApply,
    routeConfigRandomEl: routeConfigRandom,
    routeConfigWorkoutEl: routeConfigWorkout,
    routeSeedEl: routeSeed,
    routeNameEl: routeName,
    routeLengthEl: routeLength,
    gradeMin: CONTROL_LIMITS.gradeMin,
    gradeMax: CONTROL_LIMITS.gradeMax,
});

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

const hillLadderRun = (() => {
    const meta = {
        name: 'Hill Ladder 4-3-2 (Run)',
        author: 'Auuki',
        description: 'Treadmill hill session: 5 min @1% warm-up, then 10x [4%-30s, 3%-30s, 2%-1 min, 1%-1 min, 0%-1 min] repeated twice per round; finish with 5 min @0% cool-down.',
        category: 'Run',
        sportType: 'run',
    };
    const intervals = [];
    intervals.push({ duration: 300, steps: [{ duration: 300, slope: 1 }] });
    const pattern = [
        { duration: 30, slope: 4 },
        { duration: 30, slope: 3 },
        { duration: 60, slope: 2 },
        { duration: 60, slope: 1 },
        { duration: 60, slope: 0 },
        { duration: 30, slope: 4 },
        { duration: 30, slope: 3 },
        { duration: 60, slope: 2 },
        { duration: 60, slope: 1 },
        { duration: 60, slope: 0 },
    ];
    for (let i = 0; i < 10; i += 1) {
        for (const step of pattern) {
            intervals.push({ duration: step.duration, steps: [{ duration: step.duration, slope: step.slope }] });
        }
    }
    intervals.push({ duration: 300, steps: [{ duration: 300, slope: 0 }] });
    return { id: 'hill-ladder-4-3-2', name: meta.name, type: 'zwo', meta, intervals };
})();

function populateWorkouts() {
    workoutSelect.innerHTML = '';
    for (const w of workoutLibrary) {
        const opt = document.createElement('option');
        opt.value = w.id;
        opt.textContent = w.name;
        workoutSelect.appendChild(opt);
    }
}

const builderController = createBuilderController({
    state,
    limits: CONTROL_LIMITS,
    elements: {
        builderNameEl: builderName,
        builderAddErgEl: builderAddErg,
        builderAddSimEl: builderAddSim,
        builderClearEl: builderClear,
        builderExportEl: builderExport,
        builderLoadEl: builderLoad,
        builderTotalEl: builderTotal,
        builderRowsEl: builderRows,
        workoutSelectEl: workoutSelect,
    },
    clamp,
    clampGrade,
    toInt,
    toFloat,
    uid,
    formatElapsed,
    persistSettings,
    showToast,
    zwo,
    workoutLibrary,
    populateWorkouts,
});
builderController.bind();

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

const workoutController = createWorkoutController({
    state,
    xf,
    ControlMode,
    clamp,
    toInt,
    toFloat,
    clampGrade,
    normalizeWorkoutToSteps,
    parseTrainerMessage,
    setModeUi,
    setModeRadio,
    updateControlSourceUi,
    setPowerTarget,
    setSlopeTarget,
    updateHillsUi,
    updateWorkoutUi,
    setWorkoutFocusUi,
    showToast,
    intensityPct,
    getSelectedWorkout,
    beep,
    simAuto,
    simGrade,
    ftpEl: ftp,
    statusEl: status,
    targetEl,
    btnWorkoutPause,
    btnWorkoutNext,
    btnWorkoutStop,
    ghost: {
        ghostSelectEl,
        ghostAutoSaveEl,
        ghostEnabledEl,
        ghostNameEl,
        normalizeGhostRun,
        loadGhostLibrary,
        saveGhostLibrary,
        renderGhostSelect,
    },
});

function startWorkout() {
    workoutController.startWorkout();
}

function stopWorkout() {
    stopConfirmUntilMs = 0;
    setStopButtonArmed(false);
    workoutController.stopWorkout();
}

function togglePauseWorkout() {
    workoutController.togglePauseWorkout();
}

let stopConfirmUntilMs = 0;
let stopConfirmTimerId = 0;

function setStopButtonArmed(armed) {
    if (!btnWorkoutStop) return;

    btnWorkoutStop.classList.toggle('neo-stop-armed', !!armed);
    if (!('prevAriaLabel' in btnWorkoutStop.dataset)) {
        btnWorkoutStop.dataset.prevAriaLabel = btnWorkoutStop.getAttribute('aria-label') ?? 'Stop workout';
    }
    const prevAriaLabel = btnWorkoutStop.dataset.prevAriaLabel;
    btnWorkoutStop.setAttribute('aria-label', armed ? 'Stop workout (press again to confirm)' : prevAriaLabel);

    const icon = btnWorkoutStop.querySelector('.neo-icon');
    const iconHtml = icon ? icon.outerHTML : '';
    if (!('prevLabel' in btnWorkoutStop.dataset)) {
        btnWorkoutStop.dataset.prevLabel = btnWorkoutStop.textContent ?? 'Stop';
    }
    const prevLabel = btnWorkoutStop.dataset.prevLabel;
    const label = armed ? 'Stop (press again)' : prevLabel;
    btnWorkoutStop.innerHTML = `${iconHtml}${label}`;
}

function requestStopWorkout() {
    if (!state.workout.running) {
        stopWorkout();
        return;
    }
    const now = Date.now();
    if (now < stopConfirmUntilMs) {
        stopWorkout();
        showToast('Workout stopped.', 'ok', 2000);
        return;
    }
    stopConfirmUntilMs = now + 2000;
    setStopButtonArmed(true);
    if (stopConfirmTimerId) clearTimeout(stopConfirmTimerId);
    stopConfirmTimerId = setTimeout(() => {
        stopConfirmTimerId = 0;
        if (!state.workout.running) return;
        if (Date.now() < stopConfirmUntilMs) return;
        setStopButtonArmed(false);
    }, 2100);
    showToast('Press Stop again within 2s to confirm.', 'warn', 2200);
}

function setModeRadio(mode) {
    const el = document.querySelector(`input[name="mode"][value="${mode}"]`);
    if (el instanceof HTMLInputElement) el.checked = true;
}

function skipWorkoutStep() {
    workoutController.skipWorkoutStep();
}

function toggleMode() {
    const next = currentRadioMode() === 'sim' ? 'workout' : 'sim';
    setModeRadio(next);
    setModeUi(next);
    if (next === 'sim') {
        stopWorkout();
        const g = simAuto.checked ? gradeAt(state.totalDistanceM) : readManualGrade();
        setSlopeTarget(g);
        return;
    }
    state.sim.source = 'workout';
    state.workout.currentTargetText = '--';
    targetEl.textContent = state.workout.currentTargetText;
}

function tickWorkout(nowMs) {
    workoutController.tickWorkout(nowMs);
}

function getWorkoutNowMs(nowMs) {
    return workoutController.getWorkoutNowMs(nowMs);
}

function tickRoute(dtSec) {
    if (state.mode !== 'sim') return;
    if (state.workout.running && state.sim.source === 'workout') return;
    if (!simAuto.checked) return;
    state.sim.source = 'route';

    const wrapped = state.route.lengthM > 0 ? state.totalDistanceM % state.route.lengthM : state.totalDistanceM;
    const g = gradeAt(wrapped);
    setSlopeTarget(g);
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
btnWorkoutStop.addEventListener('click', () => requestStopWorkout());
btnWorkoutPause.addEventListener('click', () => togglePauseWorkout());
btnWorkoutNext.addEventListener('click', () => skipWorkoutStep());
btnIntensityDown?.addEventListener('click', () => setIntensityPct(intensityPct() - 1));
btnIntensityUp?.addEventListener('click', () => setIntensityPct(intensityPct() + 1));
intensitySlider?.addEventListener('input', () => setIntensityPct(toInt(intensitySlider.value, 100)));
difficultySlider?.addEventListener('input', () => setDifficultyPct(toInt(difficultySlider.value, 100)));
btnDifficultyDown?.addEventListener('click', () => setDifficultyPct(difficultyPct() - 1));
btnDifficultyUp?.addEventListener('click', () => setDifficultyPct(difficultyPct() + 1));

btnRideIntensityDown?.addEventListener('click', () => setIntensityPct(intensityPct() - 5));
btnRideIntensityUp?.addEventListener('click', () => setIntensityPct(intensityPct() + 5));
btnRideDifficultyDown?.addEventListener('click', () => setDifficultyPct(difficultyPct() - 5));
btnRideDifficultyUp?.addEventListener('click', () => setDifficultyPct(difficultyPct() + 5));

btnRideSettings?.addEventListener('click', () => {
    if (!(rideSettings instanceof HTMLDetailsElement)) return;
    rideSettings.open = !rideSettings.open;
});

workoutFile.addEventListener('change', async () => {
    const file = workoutFile.files?.[0];
    workoutFile.value = '';
    if (!file) return;
    setButtonLoading(btnWorkoutLoad, { loading: true, text: 'Loading…' });
    try {
        const text = await file.text();
        const parsed = zwo.readToInterval(text);
        const id = `zwo:ls:${hashSeed(text).toString(16)}`;
        const displayName = parsed?.meta?.name ? `${parsed.meta.name} (.zwo)` : `${file.name}`;
        storeZwoWorkout({ id, name: displayName, text });
        workoutLibrary.unshift({
            id,
            type: 'zwo',
            name: displayName,
            ...parsed,
        });
        populateWorkouts();
        workoutSelect.value = id;
        showToast(`Loaded workout: ${workoutLibrary[0]?.name ?? file.name}`, 'ok', 2500);
    } catch (e) {
        console.error(e);
        showToast('Could not load .zwo (check the file contents).', 'error', 5000);
    } finally {
        setButtonLoading(btnWorkoutLoad, { loading: false, text: 'Load .zwo' });
    }
});

btnSimApply.addEventListener('click', () => {
    if (simAuto.checked) return;
    const g = readManualGrade();
    if (currentRadioMode() !== 'sim') return;
    state.sim.source = 'manual';
    setSlopeTarget(g);
    updateControlSourceUi();
    persistSettings();
});

btnRouteReset.addEventListener('click', () => {
    state.totalDistanceM = 0;
    updateDistanceUi();
    drawProfile();
});

btnRouteGenerate?.addEventListener('click', () => {
    applySelectedRoute();
    if (state.mode === 'sim' && simAuto?.checked) showToast('Route updated (Auto route).', 'ok', 2000);
    else showToast('Route updated. Enable Auto route to ride it.', 'info', 2800);
});

simRoute?.addEventListener('change', () => {
    applySelectedRoute();
});

document.addEventListener('change', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement)) return;
    if (t.name !== 'mode') return;
    const next = currentRadioMode();
    setModeUi(next);
    if (next === 'sim') {
        stopWorkout();
        const g = simAuto.checked ? gradeAt(state.totalDistanceM) : readManualGrade();
        setSlopeTarget(g);
    }
});

simAuto.addEventListener('change', () => {
    updateHillsUi();
    if (currentRadioMode() !== 'sim') return;
    if (simAuto.checked) {
        state.sim.source = 'route';
        setSlopeTarget(gradeAt(state.totalDistanceM));
        updateControlSourceUi();
        return;
    }
    state.sim.source = 'manual';
    setSlopeTarget(readManualGrade());
    updateControlSourceUi();
});

difficultyEl?.addEventListener('change', () => {
    if (currentRadioMode() !== 'sim') return;
    // resend with the new scaling factor
    setSlopeTarget(state.currentGrade, { force: true });
});

difficultyEl?.addEventListener('input', renderRideQuickAdjust);
difficultyEl?.addEventListener('change', renderRideQuickAdjust);
intensityEl?.addEventListener('input', () => {
    renderRideQuickAdjust();
});
intensityEl?.addEventListener('change', () => {
    renderRideQuickAdjust();
});

function updateWindSetting() {
    const windMps = clamp(toFloat(windEl.value, 0), -20, 20);
    xf.dispatch('ui:wind-set', windMps);
}

let settingsController;

function validateNumberInput(el, { min, max }) {
    settingsController?.validateNumberInput(el, { min, max });
}

function intensityPct() {
    return settingsController?.intensityPct() ?? 100;
}

function renderIntensityQuick() {
    settingsController?.renderIntensityQuick();
}

function setIntensityPct(nextPct) {
    settingsController?.setIntensityPct(nextPct);
    renderRideQuickAdjust();
    if (!state.workout.running && loadTarget) loadTarget.textContent = `Workout load: ${intensityPct()}% · start a workout to apply.`;
}

function difficultyPct() {
    return clamp(toInt(difficultyEl?.value, 100), 0, 200);
}

function renderRideQuickAdjust() {
    if (rideIntensityLive) rideIntensityLive.textContent = `${intensityPct()}%`;
    if (rideDifficultyLive) rideDifficultyLive.textContent = `${difficultyPct()}%`;
    if (difficultyLive) difficultyLive.textContent = `${difficultyPct()}%`;
    if (intensitySlider) intensitySlider.value = String(intensityPct());
    if (difficultySlider) difficultySlider.value = String(difficultyPct());
}

function setDifficultyPct(nextPct) {
    const pct = clamp(toInt(nextPct, 100), 0, 200);
    if (difficultyEl) difficultyEl.value = String(pct);
    validateNumberInput(difficultyEl, { min: 0, max: 200 });
    renderRideQuickAdjust();
    persistSettings();
    if (currentRadioMode() === 'sim') {
        // resend with the new scaling factor
        setSlopeTarget(state.currentGrade, { force: true });
    }
}

function getRideSettings() {
    const weight = clamp(toFloat(weightEl.value, 80), 40, 140);
    const difficultyPct = clamp(toInt(difficultyEl?.value, 100), 0, 200);
    const intensityPct = clamp(toInt(intensityEl?.value, 100), 0, 200);
    const cda = clamp(toFloat(cdaEl.value, 0.32), 0.15, 0.6);
    const crr = clamp(toFloat(crrEl.value, 0.005), 0.001, 0.02);
    const wind = clamp(toFloat(windEl.value, 0), -10, 10);
    const virtualEnabled = !!virtualSpeedEl.checked;
    const enhanced = !!gfxEnhancedEl.checked;
    const leaderboard = !!gfxLeaderboardEl.checked;
    const crowd = (gfxCrowdEl && typeof gfxCrowdEl.value === 'string') ? gfxCrowdEl.value : 'many';
    return { weight, difficultyPct, intensityPct, cda, crr, wind, virtualEnabled, enhanced, leaderboard, crowd };
}

const rideRenderer = createRideRenderer({
    state,
    rideCanvas: ride,
    rideCtx,
    gfxEnhancedEl,
    gfxLeaderboardEl,
    gfxCrowdEl,
    ftpEl: ftp,
    wkgEl,
    uid,
    clamp,
    toInt,
    elevationAt,
});

function drawRide(dtSec = 0) {
    rideRenderer.drawRide(dtSec);
}

// BLE connection status (emitted by ReactiveConnectable)
xf.sub('ble:controllable:connecting', () => {
    setStatus('connecting');
    setConnectUi('connecting');
});
xf.sub('ble:controllable:connected', () => {
    setStatus('connected');
    setConnectUi('connected');
});
xf.sub('ble:controllable:disconnected', () => {
    setStatus('disconnected');
    setConnectUi('disconnected');
});
xf.sub('ble:controllable:name', (name) => {
    deviceName.textContent = name || '--';
});
xf.sub('ui:trainer-message', (payload) => {
    if (!payload) return;
    const tone = payload.tone === 'warn' ? 'warn' : payload.tone === 'error' ? 'error' : 'ok';
    state.trainer.lastAt = Date.now();
    state.trainer.lastText = String(payload.text || '');
    state.trainer.lastTone = tone;
    setTrainerMessage(payload.text || 'Trainer: ready', tone);
    if (tone === 'warn' || tone === 'error') showToast(payload.text, tone);
});

xf.sub('db:lock', (locked) => {
    state.db.lock = !!locked;
});
xf.sub('db:mode', (mode) => {
    state.db.mode = mode ?? null;
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
workoutLibrary.push(hillLadderRun);
for (const stored of loadZwoLibrary()) {
    const id = typeof stored?.id === 'string' ? stored.id : '';
    const name = typeof stored?.name === 'string' ? stored.name : '';
    const text = typeof stored?.text === 'string' ? stored.text : '';
    if (!id || !text) continue;
    try {
        const parsed = zwo.readToInterval(text);
        workoutLibrary.unshift({
            id,
            type: 'zwo',
            name: name || (parsed?.meta?.name ? `${parsed.meta.name} (.zwo)` : id),
            ...parsed,
        });
    } catch (e) {
        log.debug('Skipping invalid stored ZWO entry', { id, name }, e);
    }
}
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
setTrainerMessage('Trainer: ready', 'ok');
setConnectUi('disconnected');

function applyCurrentErgStepIfRunning() {
    if (!state.workout.running) return;
    if (state.mode !== 'workout') return;
    const step = state.workout.steps[state.workout.stepIndex];
    if (!step || step.control?.mode !== 'erg') return;
    // Adjust the current target without resetting the mode or replaying the old target.
    const scaled = setPowerTarget(step.control.watts, { force: true });
    state.workout.currentTargetText = `${scaled} W`;
    targetEl.textContent = state.workout.currentTargetText;
}

settingsController = createSettingsController({
    state,
    limits: CONTROL_LIMITS,
    elements: {
        virtualSpeedEl,
        weightEl,
        difficultyEl,
        intensityEl,
        intensityLiveEl: intensityLive,
        ftpEl: ftp,
        cdaEl,
        crrEl,
        windEl,
        simAutoEl: simAuto,
        simRouteEl: simRoute,
        simGradeEl: simGrade,
        routeSeedEl: routeSeed,
        routeLengthKmEl: routeLengthKm,
        routeMaxGradeEl: routeMaxGrade,
        routeAssumeKmhEl: routeAssumeKmh,
        workoutSoundEl: workoutSound,
        builderNameEl: builderName,
        gfxEnhancedEl,
        gfxLeaderboardEl,
        gfxCrowdEl,
        ghostEnabledEl,
        ghostAutoSaveEl,
        ghostSelectEl,
    },
    clamp,
    toInt,
    toFloat,
    getRideSettings,
    loadSettings,
    saveSettings,
    readManualGrade,
    readRouteLengthKm,
    readRouteMaxGrade,
    readRouteAssumeKmh,
    updateHillsUi,
    applySelectedRoute,
    setWindMps: (windMps) => xf.dispatch('ui:wind-set', windMps),
    applyCurrentErgStepIfRunning,
});
settingsController.bind();
const initial = settingsController.applyInitialSettings();
renderRideQuickAdjust();
updateControlSourceUi();
builderController.renderBuilder();

migrateSingleGhostIfNeeded();
renderGhostSelect();
if (typeof initial.ghostId === 'string' && initial.ghostId) {
    ghostSelectEl.value = initial.ghostId;
    setGhostActiveById(initial.ghostId);
} else if (ghostSelectEl instanceof HTMLSelectElement && ghostSelectEl.options.length > 1) {
    // default to latest ghost in list
    const id = ghostSelectEl.options[1].value;
    ghostSelectEl.value = id;
    setGhostActiveById(id);
} else {
    state.ghost.run = null;
    state.ghost.enabled = false;
}
if (ghostNameEl) {
    ghostNameEl.value = state.ghost.run?.name ?? '';
}

btnGhostDelete?.addEventListener('click', () => {
    if (!(ghostSelectEl instanceof HTMLSelectElement)) return;
    const id = ghostSelectEl.value;
    if (!id) return;
    const name = ghostSelectEl.selectedOptions?.[0]?.textContent?.trim() || id;
    const ok = window.confirm(`Delete ghost "${name}"?`);
    if (!ok) return;
    const lib = loadGhostLibrary().filter((g) => g.id !== id);
    saveGhostLibrary(lib);
    ghostSelectEl.value = '';
    if (ghostNameEl) ghostNameEl.value = '';
    state.ghost.run = null;
    state.ghost.enabled = false;
    renderGhostSelect();
    persistSettings();
    showToast('Ghost deleted.', 'ok', 2500);
});

btnGhostSaveName?.addEventListener('click', () => {
    if (!(ghostSelectEl instanceof HTMLSelectElement)) return;
    const id = ghostSelectEl.value;
    if (!id) return;
    const nextName = String(ghostNameEl?.value ?? '').trim();
    if (!nextName) return;
    const lib = loadGhostLibrary();
    const idx = lib.findIndex((g) => g.id === id);
    if (idx === -1) return;
    lib[idx] = { ...lib[idx], name: nextName };
    saveGhostLibrary(lib);
    renderGhostSelect();
    ghostSelectEl.value = id;
    setGhostActiveById(id);
    persistSettings();
});

ghostSelectEl?.addEventListener('change', () => {
    if (!(ghostSelectEl instanceof HTMLSelectElement)) return;
    const id = ghostSelectEl.value;
    if (ghostNameEl) ghostNameEl.value = '';
    if (!id) {
        state.ghost.run = null;
        state.ghost.enabled = false;
        persistSettings();
        return;
    }
    setGhostActiveById(id);
    if (ghostNameEl) ghostNameEl.value = state.ghost.run?.name ?? '';
    persistSettings();
});

ghostEnabledEl?.addEventListener('change', () => {
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
    if (simRoute?.value === 'workout') applySelectedRoute();
});
ftp.addEventListener('input', () => {
    if (!state.workout.running) updateWorkoutPreview();
});

updateWorkoutPreview();

function persistSettings() {
    settingsController?.persistSettings();
}

const rideLoop = createRideLoop({
    state,
    clamp,
    clampGrade,
    toInt,
    getRideSettings,
    speedEl: speed,
    wkgEl,
    tickWorkout,
    tickRoute,
    getWorkoutNowMs,
    simAutoEl: simAuto,
    gradeAt,
    gradeEl,
    updateWorkoutUi,
    updateDistanceUi,
    drawProfile,
    drawRide,
    drawWorkoutTimeline,
    ftpEl: ftp,
});
rideLoop.start();

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
        if (state.workout.running) requestStopWorkout();
    }
});
