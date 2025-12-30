import { xf, exists, existance, validate, equals, isNumber, last, empty, avg, toFixed, formatDate } from '../../functions.js';
import { formatTime } from '../../utils.js';
import { models } from '../../models/models.js';
import { DialogMsg } from '../../models/enums.js';
import { DataView } from './base.js';
class MeasurementUnit extends DataView {
    getDefaults() {
        return {
            state: models.measurement.default,
            prop: 'db:measurement',
        };
    }
    formatUnit(measurement = models.measurement.default) {
        if(measurement === 'imperial') {
            return `lbs`;
        } else {
            return `kg`;
        }
    }
    transform(state) {
        return this.formatUnit(state);
    }
}

customElements.define('measurement-unit', MeasurementUnit);

class ThemeValue extends DataView {
    getDefaults() {
        return {
            prop: 'db:theme',
        };
    }
}

customElements.define('theme-value', ThemeValue);

class MeasurementValue extends DataView {
    getDefaults() {
        return {
            prop: 'db:measurement',
        };
    }
}

customElements.define('measurement-value', MeasurementValue);


class VirtualStateSource extends DataView {
    postInit() {
        this.sources = ['power', 'speed'];
        this.source  = 'power';
        this.effect  = 'sources';
        this.state   = { virtualState: 'power' };
    }
    getDefaults() {
        return {
            prop: 'db:sources',
            effect: 'sources'
        };
    }
    subs() {
        xf.sub(`${this.prop}`, this.onUpdate.bind(this), this.signal);
        this.addEventListener('pointerup', this.onEffect.bind(this), this.signal);
    }
    onUpdate(value) {
        this.state = value.virtualState;
        this.render();
    }
    onEffect() {
        if(equals(this.state, 'power')) {
            xf.dispatch(`${this.effect}`, {virtualState: 'speed'});
        } else {
            xf.dispatch(`${this.effect}`, {virtualState: 'power'});
        }
    }
    render() {
        this.textContent = this.state;
    }
}

customElements.define('virtual-state-source', VirtualStateSource);

export { MeasurementUnit, ThemeValue, MeasurementValue };
