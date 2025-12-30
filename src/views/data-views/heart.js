import { xf, exists, existance, validate, equals, isNumber, last, empty, avg, toFixed, formatDate } from '../../functions.js';
import { formatTime } from '../../utils.js';
import { models } from '../../models/models.js';
import { DialogMsg } from '../../models/enums.js';
import { DataView } from './base.js';
class HeartRateValue extends DataView {
    getDefaults() {
        return {
            prop: 'db:heartRate',
        };
    }
    transform(state) {
        this.style = 'color: #FE340B';
        return Math.round(state);
    }
}

customElements.define('heart-rate-value', HeartRateValue);

class HeartRateLapValue extends DataView {
    getDefaults() {
        return {
            prop: 'db:heartRateLap',
        };
    }
    transform(state) {
        return Math.round(state);
    }
}

customElements.define('heart-rate-lap-value', HeartRateLapValue);

class HeartRateAvgValue extends DataView {
    getDefaults() {
        return {
            prop: 'db:heartRateAvg',
        };
    }
    transform(state) {
        return Math.round(state);
    }
}

customElements.define('heart-rate-avg-value', HeartRateAvgValue);

class HeartRateMaxValue extends DataView {
    getDefaults() {
        return {
            prop: 'db:heartRateMax',
        };
    }
    transform(state) {
        return Math.round(state);
    }
}

customElements.define('heart-rate-max-value', HeartRateMaxValue);

export { HeartRateValue, HeartRateLapValue, HeartRateAvgValue };
