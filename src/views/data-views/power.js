import { xf, exists, existance, validate, equals, isNumber, last, empty, avg, toFixed, formatDate } from '../../functions.js';
import { formatTime } from '../../utils.js';
import { models } from '../../models/models.js';
import { DialogMsg } from '../../models/enums.js';
import { DataView } from './base.js';
class PowerValue extends DataView {
    getDefaults() {
        return {
            prop: 'db:power',
        };
    }
    subs() {
        xf.sub(`${this.prop}`, this.onUpdate.bind(this), this.signal);
    }
    transform(state) {
        this.style = 'color: #F8C73A';
        return Math.round(state);
    }
}

customElements.define('power-value', PowerValue);

class PowerAvg extends DataView {
    getDefaults() {
        return {
            prop: 'db:powerAvg',
        };
    }
    subs() {
        xf.sub(`${this.prop}`, this.onUpdate.bind(this), this.signal);
    }
    transform(state) {
        return Math.ceil(state);
    }
}

customElements.define('power-avg', PowerAvg);

class PowerLap extends DataView {
    getDefaults() {
        return {
            prop: 'db:powerLap',
        };
    }
    subs() {
        xf.sub(`${this.prop}`, this.onUpdate.bind(this), this.signal);
    }
    transform(state) {
        return Math.ceil(state);
    }
}

customElements.define('power-lap', PowerLap);

class KcalAvg extends DataView {
    getDefaults() {
        return {
            prop: 'db:kcal',
        };
    }
    subs() {
        xf.sub(`${this.prop}`, this.onUpdate.bind(this), this.signal);
    }
    transform(state) {
        return Math.round(state);
    }
}

customElements.define('kcal-avg', KcalAvg);

class PowerInZone extends HTMLElement {
    constructor() {
        super();
        this.state = [[0,0],[0,0],[0,0],[0,0], [0,0],[0,0],[0,0]];
        this.selectors = {
            values: '.power--zone-value',
            bars: '.power--zone-bar',
            btn: '.power--unit',
        };
        this.format = 'percentage';
        this.prop = 'db:powerInZone';
    }
    connectedCallback() {
        const self = this;
        this.abortController = new AbortController();
        this.signal = { signal: self.abortController.signal };

        this.$values = this.querySelectorAll(this.selectors.values);
        this.$bars = this.querySelectorAll(this.selectors.bars);
        this.$btn = this.querySelector(this.selectors.btn);

        this.$btn.addEventListener('pointerup', this.onSwitch.bind(this), this.signal);

        xf.sub(`${this.prop}`, this.onUpdate.bind(this), this.signal);
    }
    disconnectedCallback() {
        this.abortController.abort();
    }
    onUpdate(propValue) {
        this.state = propValue;
        this.render();
    }
    onSwitch() {
        if(equals(this.format, 'time')) {
            this.format = 'percentage';
            this.$btn.textContent = '%';
            this.render();
        } else {
            this.format = 'time';
            this.$btn.textContent = 'min';
            this.render();
        }
    }
    render() {
        for(let i=0; i < this.state.length; i++) {
            let text;
            if(equals(this.format, 'percentage')) {
                 text = Math.round(this.state[i][0]*100);
            } else {
                 text = formatTime({value:Math.round(this.state[i][1]), format: 'mm:ss'});
            }
            const height = `${this.state[i][0]*100}%`;

            this.$values[i].textContent = text;
            this.$bars[i].style.height = height;
        }
    }
}

customElements.define('power-in-zone', PowerInZone);

export { PowerValue, PowerAvg };
