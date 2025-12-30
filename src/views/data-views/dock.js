import { xf, exists, existance, validate, equals, isNumber, last, empty, avg, toFixed, formatDate } from '../../functions.js';
import { formatTime } from '../../utils.js';
import { models } from '../../models/models.js';
import { DialogMsg } from '../../models/enums.js';
import { DataView } from './base.js';
class DockModeDefault extends DataView {
    postInit() {
        this.effect  = 'dockMode';
        this.state   = false;
    }
    getDefaults() {
        return {
            prop: 'db:dockMode',
            effect: 'dockMode'
        };
    }
    subs() {
        xf.sub(`${this.prop}`, this.onUpdate.bind(this), this.signal);
        this.addEventListener('pointerup', this.onEffect.bind(this), this.signal);
    }
    onUpdate(value) {
        this.state = value;
        this.render();
    }
    onEffect() {
        if(equals(this.state, true)) {
            xf.dispatch(`${this.effect}`, false);
        } else {
            xf.dispatch(`${this.effect}`, true);
        }
    }
    render() {
        this.textContent = equals(this.state, true) ? 'ON' : 'OFF';
    }
}

customElements.define('dock-mode-default', DockModeDefault);

class DockModeBtn extends DataView {
    subs() {
        this.addEventListener('pointerup', this.onSwitch.bind(this), this.signal);
    }
    onSwitch() {
        models.dockMode.open();
    }
}

customElements.define('dock-mode-btn', DockModeBtn);

export { DockModeBtn };
