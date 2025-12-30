import { xf, exists, existance, validate, equals, isNumber, last, empty, avg, toFixed, formatDate } from '../../functions.js';
import { formatTime } from '../../utils.js';
import { models } from '../../models/models.js';
import { DialogMsg } from '../../models/enums.js';
import { DataView } from './base.js';
class SmO2Value extends DataView {
    getDefaults() {
        return {
            prop: 'db:smo2',
        };
    }
    subs() {
        xf.sub(`${this.prop}`, this.onUpdate.bind(this), this.signal);
    }

    // this.style = 'color: #2A5F97';
    // this.style = 'color: #278B65';
    // this.style = 'color: #D72A1C';
    transform(state) {
        // if(state < models.smo2.zones.one) {
        //     this.style = 'color: #328AFF';
        // } else if(state < models.smo2.zones.two) {
        //     this.style = 'color: #56C057';
        // } else {
        //     this.style = 'color: #FE340B';
        // }
        this.style = 'color: #56C057';
        return toFixed(state, 1);
    }
}

customElements.define('smo2-value', SmO2Value);


class THbValue extends DataView {
    getDefaults() {
        return {
            prop: 'db:thb',
        };
    }
    subs() {
        xf.sub(`${this.prop}`, this.onUpdate.bind(this), this.signal);
    }
    transform(state) {
        this.style = 'color: #FF663A';
        return toFixed(state, 2);
    }
}

customElements.define('thb-value', THbValue);


class CoreBodyTemperatureValue extends DataView {
    postInit() {
        this.measurement = this.getDefaults().measurement;
    }
    getDefaults() {
        return {
            prop: 'db:coreBodyTemperature',
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
    celsiusToFahrenheit(celsius) {
        return Math.round(((celsius * 9/5) + 32) * 100) / 100;
    }
    format(temperature, measurement = 'metric') {
        if(equals(measurement, 'imperial')) {
            return this.celsiusToFahrenheit(temperature);
        }

        if(equals(measurement, 'metric')) {
            return toFixed(temperature);
        }

        return toFixed(temperature);
    }
    transform(state) {
        return this.format(state, this.measurement);
    }
}

customElements.define('core-body-temperature-value', CoreBodyTemperatureValue);


class SkinTemperatureValue extends DataView {
    getDefaults() {
        return {
            prop: 'db:skinTemperature',
        };
    }
    subs() {
        xf.sub(`${this.prop}`, this.onUpdate.bind(this), this.signal);
    }
    transform(state) {
        return toFixed(state, 2);
    }
}

customElements.define('skin-temperature-value', SkinTemperatureValue);

export { SmO2Value, THbValue };
