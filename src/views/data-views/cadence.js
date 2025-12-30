import { xf, exists, existance, validate, equals, isNumber, last, empty, avg, toFixed, formatDate } from '../../functions.js';
import { formatTime } from '../../utils.js';
import { models } from '../../models/models.js';
import { DialogMsg } from '../../models/enums.js';
import { DataView } from './base.js';
class CadenceValue extends DataView {
    getDefaults() {
        return {
            prop: 'db:cadence',
        };
    }
    transform(state) {
        return Math.round(state);
    }
}

customElements.define('cadence-value', CadenceValue);

class CadenceLapValue extends DataView {
    getDefaults() {
        return {
            prop: 'db:cadenceLap',
        };
    }
    transform(state) {
        return Math.round(state);
    }
}

customElements.define('cadence-lap-value', CadenceLapValue);

class CadenceAvgValue extends DataView {
    getDefaults() {
        return {
            prop: 'db:cadenceAvg',
        };
    }
    transform(state) {
        return Math.round(state);
    }
}

customElements.define('cadence-avg-value', CadenceAvgValue);


class CadenceTarget extends DataView {
    getDefaults() {
        return {
            prop: 'db:cadenceTarget',
        };
    }
    transform(state) {
        if(equals(state, 0)) {
            return '';
        }

        return state;
    }
}

customElements.define('cadence-target', CadenceTarget);


class CadenceGroup extends DataView {
    getDefaults() {
        return {
            prop: 'db:cadenceTarget',
        };
    }
    config() {
        this.$main = this.querySelector('cadence-value');
        this.$aux = this.querySelector('cadence-target');
    }
    render() {
        if(equals(this.state, 0)) {
            this.$main.classList.remove('active');
            this.$aux.classList.remove('active');
        } else {
            this.$main.classList.add('active');
            this.$aux.classList.add('active');
        }
    }
}

customElements.define('cadence-group', CadenceGroup);

export { CadenceValue, CadenceLapValue, CadenceAvgValue, CadenceTarget, CadenceGroup };
