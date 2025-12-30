import { xf, exists, existance, validate, equals, isNumber, last, empty, avg, toFixed, formatDate } from '../../functions.js';
import { formatTime } from '../../utils.js';
import { models } from '../../models/models.js';
import { DialogMsg } from '../../models/enums.js';
import { DataView } from './base.js';
class AutoPause extends DataView {
    postInit() {
        this.effect  = 'sources';
        this.key     = 'autoPause';
        this.state   = { autoPause: false };
        this.values  = {on: {autoPause: true}, off: {autoPause: false}};
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
        this.state = value[this.key];
        this.render();
    }
    onEffect() {
        if(equals(this.state, true)) {
            xf.dispatch(`${this.effect}`, this.values.off);
        } else {
            xf.dispatch(`${this.effect}`, this.values.on);
        }
    }
    render() {
        this.textContent = this.state ? 'On' : 'Off';
    }
}

customElements.define('auto-pause', AutoPause);

class AutoStart extends AutoPause {
    postInit() {
        this.effect  = 'sources';
        this.key     = 'autoStart';
        this.state   = { autoStart: true };
        this.values  = {on: {autoStart: true}, off: {autoStart: false}};
    }
}

customElements.define('auto-start', AutoStart);

