import { xf } from './functions.js';
import './db.js';
import './ble/devices.js';
import { ControlMode } from './ble/enums.js';
import { models } from './models/models.js';

const $ = (id) => document.getElementById(id);

const btnConnect = $('btn-connect');
const btnSet = $('btn-set');
const btnReset = $('btn-reset');
const mode = $('mode');
const target = $('target');

const deviceName = $('device-name');
const status = $('status');

const power = $('power');
const cadence = $('cadence');
const speed = $('speed');
const hr = $('hr');

function setStatus(text) {
    status.textContent = text;
}

function toInt(value, fallback = 0) {
    const x = Number.parseInt(String(value), 10);
    return Number.isFinite(x) ? x : fallback;
}

function toFloat(value, fallback = 0) {
    const x = Number.parseFloat(String(value));
    return Number.isFinite(x) ? x : fallback;
}

function setMode(nextMode) {
    xf.dispatch('ui:mode-set', nextMode);
}

function setTargetForMode() {
    const m = mode.value;

    if (m === ControlMode.erg) {
        xf.dispatch('ui:power-target-set', toInt(target.value, 150));
        return;
    }

    if (m === ControlMode.resistance) {
        xf.dispatch('ui:resistance-target-set', toInt(target.value, 0));
        return;
    }

    if (m === ControlMode.sim) {
        xf.dispatch('ui:slope-target-set', toFloat(target.value, 0));
        return;
    }
}

btnConnect.addEventListener('click', () => {
    // ReactiveConnectable subscribes to ui:ble:controllable:switch
    xf.dispatch('ui:ble:controllable:switch');
});

btnSet.addEventListener('click', () => {
    setTargetForMode();
});

btnReset.addEventListener('click', () => {
    xf.dispatch('ui:trainer:reset');
});

mode.addEventListener('change', () => {
    setMode(mode.value);
    setTargetForMode();
});

// BLE connection status (emitted by ReactiveConnectable)
xf.sub('ble:controllable:connecting', () => setStatus('connecting'));
xf.sub('ble:controllable:connected', () => setStatus('connected'));
xf.sub('ble:controllable:disconnected', () => setStatus('disconnected'));
xf.sub('ble:controllable:name', (name) => {
    deviceName.textContent = name || '--';
});

// Live data (db:* is produced by db proxy)
xf.sub('db:power', (v) => {
    power.textContent = v ?? '--';
});
xf.sub('db:cadence', (v) => {
    cadence.textContent = v ?? '--';
});
xf.sub('db:speed', (mps) => {
    // db.speed is already km/h in Auuki, but some code paths store m/s. Use models helper.
    const kmh = typeof mps === 'number' ? models.speed.mpsToKmh(mps) : NaN;
    speed.textContent = Number.isFinite(kmh) ? Math.round(kmh) : '--';
});
xf.sub('db:heartRate', (v) => {
    hr.textContent = v ?? '--';
});

// Initialize defaults
setStatus('disconnected');
setMode(ControlMode.erg);
setTargetForMode();
