import { xf, exists, existance, validate, equals, isNumber, last, empty, avg, toFixed, formatDate } from '../../functions.js';
import { formatTime } from '../../utils.js';
import { models } from '../../models/models.js';
import { DialogMsg } from '../../models/enums.js';
import { DataView } from './base.js';
class SpeedValue extends DataView {
    postInit() {
        this.measurement = this.getDefaults().measurement;
    }
    getDefaults() {
        return {
            prop: 'db:speed',
            measurement: 'metric',
        };
    }
    subs() {
        xf.sub(`${this.prop}`, this.onUpdate.bind(this), this.signal);
        xf.sub(`db:measurement`, this.onMeasurement.bind(this), this.signal);
    }
    onMeasurement(measurement) {
        this.measurement = measurement;
    }
    format(value, measurement = 'metric') {
        if(equals(measurement, 'imperial')) {
            value = `${models.speed.mpsToMph(value).toFixed(1)}`;
        } else {
            value = `${(models.speed.mpsToKmh(value)).toFixed(1)}`;
        }
        return value;
    }
    transform(state) {
        return this.format(state, this.measurement);
    }
}

customElements.define('speed-value', SpeedValue);

class SpeedVirtual extends SpeedValue {
    getDefaults() {
        return {
            prop: 'db:speedVirtual',
            measurement: 'metric',
        };
    }
}

customElements.define('speed-virtual', SpeedVirtual);

class SpeedSwitch extends SpeedValue {
    postInit() {
        this.measurement = this.getDefaults().measurement;
    }
    getDefaults() {
        return {
            prop: '',
            measurement: 'metric',
        };
    }
    subs() {
        xf.sub(`db:speed`,        this.onSpeed.bind(this), this.signal);
        xf.sub(`db:speedVirtual`, this.onSpeedVirtual.bind(this), this.signal);
        xf.sub(`db:measurement`,  this.onMeasurement.bind(this), this.signal);
        xf.sub(`db:sources`,      this.onSources.bind(this), this.signal);
    }
    onSpeed(value) {
        if(equals(this.source, 'speed')) this.onUpdate(value);
    }
    onSpeedVirtual(value) {
        if(equals(this.source, 'power')) this.onUpdate(value);
    }
    onSources(sources) {
        this.source = sources.virtualState;
    }
}

customElements.define('speed-switch', SpeedSwitch);


class DistanceValue extends DataView {
    postInit() {
        this.measurement = this.getDefaults().measurement;
    }
    getDefaults() {
        return {
            prop: 'db:distance',
            measurement: 'metric',
        };
    }
    subs() {
        xf.sub(`${this.prop}`, this.onUpdate.bind(this), this.signal);
        xf.sub(`db:measurement`, this.onMeasurement.bind(this), this.signal);
    }
    onMeasurement(measurement) {
        this.measurement = measurement;
    }
    metersToYards(meters) {
        return 1.09361 * meters;
    }
    format(meters, measurement = 'metric') {
        let value   = `0`;
        const km    = (meters / 1000);
        const miles = (meters / 1609.34);
        const yards = this.metersToYards(meters);

        if(equals(measurement, 'imperial')) {
            const yardsTemplate = `${(this.metersToYards(meters)).toFixed(0)}`;
            const milesTemplate = `${miles.toFixed(2)}`;
            return value = (yards < 1609.34) ? yardsTemplate : milesTemplate;
        } else {
            const metersTemplate = `${meters.toFixed(0)}`;
            const kmTemplate = `${km.toFixed(2)}`;
            return value = (meters < 1000) ? metersTemplate : kmTemplate;
        }
    }
    transform(state) {
        return this.format(state, this.measurement);
    }
}

customElements.define('distance-value', DistanceValue);


class AltitudeValue extends DataView {
    getDefaults() {
        return {
            prop: 'db:altitude',
        };
    }
    transform(state) {
        return (state).toFixed(1);
    }
}

customElements.define('altitude-value', AltitudeValue);


class AscentValue extends DataView {
    getDefaults() {
        return {
            prop: 'db:ascent',
        };
    }
    transform(state) {
        return (state).toFixed(1);
    }
}

customElements.define('ascent-value', AscentValue);

export { SpeedValue, DistanceValue };
