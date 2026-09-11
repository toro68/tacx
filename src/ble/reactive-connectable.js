import { equals, exists, xf, } from '../functions.js';
import { logger } from '../functions/logger.js';
import { models } from '../models/models.js';
import Connectable from './connectable.js';
import { webBle } from './web-ble.js';
import { Device, ControlMode, } from './enums.js';

const log = logger('ble');

function ReactiveConnectable(args = {}) {
    // config
    const deviceType = args.deviceType ?? Device.generic;
    const filter = args.filter ?? webBle.filters.generic();
    const identifier = `ble:${deviceType}`;

    const connectable = Connectable({
        filter,
        onData,
        onConnecting,
        onConnected,
        onDisconnect,
        onConnectFail,
    });
    // end config

    // state
    let mode = ControlMode.erg;

    let abortController;
    let signal;
    // end state

    function getIdentifier() {
        return identifier;
    }

    function onConnecting() {
        xf.dispatch(`${getIdentifier()}:connecting`);
    }

    function onConnected() {
        xf.dispatch(`${getIdentifier()}:connected`);
        xf.dispatch(`${getIdentifier()}:name`, connectable.getName());
        flushPendingTargets();
    }

    function onDisconnect() {
        xf.dispatch(`${getIdentifier()}:disconnected`);
        xf.dispatch(`${getIdentifier()}:name`, '--');

        if(models.sources.isSource('power', getIdentifier())) {
            xf.dispatch(`power`, 0);
        }
        if(models.sources.isSource('cadence', getIdentifier())) {
            xf.dispatch(`cadence`, 0);
        }
        if(models.sources.isSource('speed', getIdentifier())) {
            xf.dispatch(`speed`, 0);
        }
        if(models.sources.isSource('heartRate', getIdentifier())) {
            xf.dispatch(`heartRate`, 0);
        }
        if(models.sources.isSource('smo2', getIdentifier())) {
            xf.dispatch(`smo2`, 0);
        }
        if(models.sources.isSource('thb', getIdentifier())) {
            xf.dispatch(`thb`, 0);
        }
        if(models.sources.isSource('coreBodyTemperature', getIdentifier())) {
            xf.dispatch(`coreBodyTemperature`, 0);
            xf.dispatch(`skinTemperature`, 0);
        }
    }

    function onConnectFail() {
        xf.dispatch(`${getIdentifier()}:disconnected`);
    }

    function onData(data) {
        if('power' in data && models.sources.isSource('power', identifier)) {
            xf.dispatch(`power`, data.power);
        }

        if('cadence' in data && models.sources.isSource('cadence', identifier)) {
            xf.dispatch(`cadence`, data.cadence);
        }

        if('speed' in data && models.sources.isSource('speed', identifier)) {
            xf.dispatch(`speed`, models.speed.kmhToMps(data.speed));
        }

        if('heartRate' in data && models.sources.isSource('heartRate', identifier)) {
            xf.dispatch(`heartRate`, data.heartRate);

            if('rrInterval' in data) {
                xf.dispatch(`rrInterval`, data.rrInterval);
            }
        }

        if('batteryLevel' in data) {
            xf.dispatch(`${getIdentifier()}:batteryLevel`, data.batteryLevel);
            log.info(`Device ${connectable.getName()} battery level: ${data.batteryLevel}%`);
        }

        if('currentSaturatedHemoglobin' in data) {
            xf.dispatch(`smo2`, data.currentSaturatedHemoglobin);
        }

        if('totalHemoglobinSaturation' in data) {
            xf.dispatch(`thb`, data.totalHemoglobinSaturation);
        }

        if('coreBodyTemperature' in data) {
            xf.dispatch(`coreBodyTemperature`, data.coreBodyTemperature);
        }

        if('skinTemperature' in data) {
            xf.dispatch(`skinTemperature`, data.skinTemperature);
        }
    }

    async function onSwitch() {
        if(connectable.isConnected()) {
            connectable.disconnect();
        } else {
            connectable.connect({requesting: true});
        }
    }

    function onMode(x) {
        log.debug(`Mode change: ${mode} -> ${x}`);
        mode = x;
        flushPendingTargets();
    }

    function onUserWeight(x) {
        if(!connectable.isConnected()) return;
    }

    const pendingTargets = {
        power: null,
        resistance: null,
        slope: null,
    };
    let lastSlopeSent = null;
    let currentWindMps = 0;

    const mpsToKmh = (v) => v * 3.6;

    function emitTrainerMessage(text, tone = 'ok') {
        xf.dispatch('ui:trainer-message', {text, tone});
    }

    async function retryWithProtocol(fn, isCurrent) {
        try {
            const ok = await fn();
            if(ok) return true;
        } catch {
            // handled by caller
        }

        if(!isCurrent()) return false;
        try {
            const trainer = connectable.services?.trainer;
            if(trainer && typeof trainer.protocol === 'function') {
                await trainer.protocol();
            }
        } catch (e) {
            log.warn('Protocol retry failed', e);
        }

        return isCurrent() ? await fn() : false;
    }

    let flushTimer = null;
    let targetChain = Promise.resolve();
    const targetVersions = { power: 0, resistance: 0, slope: 0 };
    const targetSpecs = {
        power: {
            mode: ControlMode.erg,
            label: 'Power target',
            format: (value) => `${value} W`,
            send: (value) => connectable.services.trainer.setPowerTarget({power: value}),
        },
        resistance: {
            mode: ControlMode.resistance,
            label: 'Resistance target',
            format: (value) => String(value),
            send: (value) => connectable.services.trainer.setResistanceTarget({resistance: value}),
        },
        slope: {
            mode: ControlMode.sim,
            label: 'Grade',
            format: (value) => `${value}%`,
            send: (value) => connectable.services.trainer.setSimulation({grade: value, windSpeed: currentWindMps}),
        },
    };

    function scheduleFlushPendingTargets(delayMs = 450) {
        if(flushTimer !== null || abortController.signal.aborted) return;
        flushTimer = setTimeout(() => {
            flushTimer = null;
            flushPendingTargets();
        }, delayMs);
    }

    function flushPendingTargets() {
        if(abortController.signal.aborted || !connectable.isConnected()) return;
        for(const [key, spec] of Object.entries(targetSpecs)) {
            if(equals(mode, spec.mode) && pendingTargets[key] !== null) {
                void sendTarget(key, pendingTargets[key]);
            }
        }
    }

    function sendTarget(key, value) {
        if(abortController.signal.aborted || !Number.isFinite(value)) return;
        const spec = targetSpecs[key];
        const version = ++targetVersions[key];
        pendingTargets[key] = value;
        if(!connectable.isConnected()) {
            emitTrainerMessage(`${spec.label} queued (not connected)`, 'warn');
            return;
        }
        if(!equals(mode, spec.mode)) {
            emitTrainerMessage(`${spec.label} queued (mode mismatch)`, 'warn');
            return;
        }

        const isCurrent = () => !abortController.signal.aborted &&
            version === targetVersions[key] &&
            equals(mode, spec.mode) && connectable.isConnected();

        // Serialize complete operations, including retries. New adjustments replace
        // older queued values so an old retry cannot overwrite the selected load.
        const operation = targetChain.then(async () => {
            if(!isCurrent()) return;
            let ok = false;
            try {
                ok = await retryWithProtocol(() => spec.send(value), isCurrent);
            } catch(e) {
                log.warn(`${spec.label} failed`, e);
            }
            if(!isCurrent()) return;
            if(ok) {
                pendingTargets[key] = null;
                if(key === 'slope') lastSlopeSent = value;
                emitTrainerMessage(`${spec.label} sent (${spec.format(value)})`, 'ok');
            } else {
                emitTrainerMessage(`${spec.label} failed (will retry): ${spec.format(value)}`, 'warn');
                scheduleFlushPendingTargets();
            }
        });
        targetChain = operation.catch((e) => log.warn('Trainer target queue failed', e));
        return operation;
    }

    function onPowerTarget(value) {
        return sendTarget('power', value);
    }

    function onResistanceTarget(value) {
        return sendTarget('resistance', value);
    }

    function onSlopeTarget(value) {
        return sendTarget('slope', value);
    }

    async function applyWind() {
        if(!connectable.isConnected()) return;
        const trainer = connectable.services?.trainer;
        if(!trainer) return;

        if(typeof trainer.setWindResistance === 'function') {
            const windKmh = mpsToKmh(currentWindMps);
            await trainer.setWindResistance({windSpeed: windKmh});
            emitTrainerMessage(`Wind sent (${windKmh.toFixed(1)} km/h)`, 'ok');
            return;
        }

        if(typeof trainer.setSimulation === 'function') {
            const grade = lastSlopeSent ?? pendingTargets.slope ?? 0;
            await trainer.setSimulation({grade, windSpeed: currentWindMps});
            emitTrainerMessage(`Wind sent (${currentWindMps.toFixed(1)} m/s)`, 'ok');
        }
    }

    function onWind(wind) {
        if(typeof wind !== 'number' || Number.isNaN(wind)) return;
        currentWindMps = wind;
        applyWind();
    }

    function onTrainerReset() {
        if(!connectable.isConnected() ||
           !exists(connectable.services?.trainer?.reset)) return;
        connectable.services.trainer.reset();
    }

    function start() {
        if(abortController && !abortController.signal.aborted) return;
        abortController = new AbortController();
        signal = { signal: abortController.signal };

        xf.sub(`ui:${getIdentifier()}:switch`, onSwitch, signal);

        if(equals(deviceType, Device.controllable)) {
            xf.sub('db:mode',             onMode, signal);
            xf.sub('db:weight',           onUserWeight, signal);
            xf.sub('db:powerTarget',      onPowerTarget, signal);
            xf.sub('db:resistanceTarget', onResistanceTarget, signal);
            xf.sub('db:slopeTarget',      onSlopeTarget, signal);
            xf.sub('db:wind',             onWind, signal);
            xf.sub('ui:trainer:reset',    onTrainerReset, signal);
        }
    }

    function stop() {
        abortController.abort();
        clearTimeout(flushTimer);
        flushTimer = null;
        for(const key of Object.keys(pendingTargets)) {
            targetVersions[key] += 1;
            pendingTargets[key] = null;
        }
    }

    start();

    return Object.freeze({
        getIdentifier,
        start,
        stop,
        ...connectable
    });
}

export default ReactiveConnectable;
