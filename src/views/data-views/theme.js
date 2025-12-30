import { xf, exists, existance, validate, equals, isNumber, last, empty, avg, toFixed, formatDate } from '../../functions.js';
import { formatTime } from '../../utils.js';
import { models } from '../../models/models.js';
import { DialogMsg } from '../../models/enums.js';
import { DataView } from './base.js';
class Theme extends DataView {
    postInit() {
        this.effect  = 'sources';
        this.state   = { theme: 'DARK' };
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
        this.state = value.theme;
        this.render();
    }
    onEffect() {
        if(equals(this.state, 'DARK')) {
            xf.dispatch(`${this.effect}`, {theme: 'WHITE'});
        }else if (equals(this.state, 'WHITE')) {
            xf.dispatch(`${this.effect}`, {theme: 'AUTO'});
        } else {
            xf.dispatch(`${this.effect}`, {theme: 'DARK'});
        }
    }
    render() {
        this.textContent = equals(this.state, 'DARK') ? 'DARK' : equals(this.state, 'WHITE') ? 'WHITE' : 'AUTO';
        document.body.className =  equals(this.state, 'DARK') ? 'dark-theme' : equals(this.state, 'WHITE') ? 'white-theme' : 'auto-theme';
    }
}

customElements.define('theme-layout', Theme);

