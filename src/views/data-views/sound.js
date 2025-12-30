import { xf, exists, existance, validate, equals, isNumber, last, empty, avg, toFixed, formatDate } from '../../functions.js';
import { formatTime } from '../../utils.js';
import { models } from '../../models/models.js';
import { DialogMsg } from '../../models/enums.js';
import { DataView } from './base.js';
class SoundControl extends DataView {
    postInit() {
        this.volume = 100;
        this.selectors = {
            mute:    '#sound--mute',
            down:    '#sound--down',
            up:      '#sound--up',
            volume:  '#sound--volume',
        };
    }
    getDefaults() {
        return { prop: 'db:volume', };
    }
    config() {
        this.$mute   = this.querySelector(this.selectors.mute);
        this.$down   = this.querySelector(this.selectors.down);
        this.$up     = this.querySelector(this.selectors.up);
        this.$volume = this.querySelector(this.selectors.volume);
    }
    subs() {
        this.$mute.addEventListener(`pointerup`, this.onMute.bind(this), this.signal);
        this.$down.addEventListener(`pointerup`, this.onDown.bind(this), this.signal);
        this.$up.addEventListener(`pointerup`, this.onUp.bind(this), this.signal);
        xf.sub(`${this.prop}`, this.onUpdate.bind(this), this.signal);
    }
    onMute() {
        xf.dispatch(`ui:volume-mute`);
    }
    onDown() {
        xf.dispatch(`ui:volume-down`);
    }
    onUp() {
        xf.dispatch(`ui:volume-up`);
    }
    render() {
        this.$volume.textContent = `${this.state}%`;
    }
}

customElements.define('sound-control', SoundControl);

