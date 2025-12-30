import { xf, exists, existance, validate, equals, isNumber, last, empty, avg, toFixed, formatDate } from '../../functions.js';
import { formatTime } from '../../utils.js';
import { models } from '../../models/models.js';
import { DialogMsg } from '../../models/enums.js';
class SwitchGroup extends HTMLElement {
    constructor() {
        super();
        this.state = 0;
        this.postInit();
    }
    connectedCallback() {
        const self = this;
        this.abortController = new AbortController();
        this.signal = { signal: self.abortController.signal };

        this.$switchList = this.querySelectorAll('.switch-item');
        this.config();

        xf.sub(`db:${this.prop}`, this.onState.bind(this), this.signal);
        this.addEventListener('pointerup', this.onSwitch.bind(this), this.signal);
    }
    disconnectedCallback() {
        this.abortController.abort();
    }
    eventOwner(e) {
        const path = e.composedPath();
        const pathLength = path.length;

        for(let i = 0; i < pathLength; i++) {
            if(exists(path[i].hasAttribute) &&
               path[i].hasAttribute('index')) {
                return path[i];
            }
        }

        return e.path[0];
    }
    onSwitch(e) {
        const element = this.eventOwner(e);

        if(exists(element.attributes.index)) {

            const id = parseInt(element.attributes.index.value) || 0;

            if(equals(id, this.state)) {
                return;
            } else {
                xf.dispatch(`${this.effect}`, id);
            }
        }
    }
    onState(state) {
        this.state = state;
        this.setSwitch(this.state);
        this.renderEffect(this.state);
    }
    setSwitch(state) {
        this.$switchList.forEach(function(s, i) {
            if(equals(i, state)) {
                s.classList.add('active');
            } else {
                s.classList.remove('active');
            }
        });
    }
    // overwrite the rest to augment behavior
    postInit() {
        this.prop = '';
    }
    config() {
    }
    renderEffect(state) {
        return state;
    }
}

class DataTileSwitchGroup extends SwitchGroup {
    postInit() {
        this.prop = 'dataTileSwitch';
        this.effect = 'ui:data-tile-switch-set';
    }
    config() {
        this.$speed    = document.querySelector('#data-tile--speed');     // tab 0
        this.$distance = document.querySelector('#data-tile--distance');  // tab 0
        this.$powerAvg = document.querySelector('#data-tile--power-avg'); // tab 1
        this.$slope    = document.querySelector('#data-tile--slope');     // tab 1
        this.$smo2     = document.querySelector('#data-tile--smo2');      // tab 2
        this.$thb      = document.querySelector('#data-tile--thb');       // tab 2
        this.$coreBodyTemperature =
            document.querySelector('#data-tile--core-body-temperature');  // tab 3
        this.$skinTemperature =
            document.querySelector('#data-tile--skin-temperature');       // tab 3

        this.renderEffect(this.state);
    }
    renderEffect(state) {
        if(equals(state, 0)) {
            this.$speed.classList.add('active');
            this.$distance.classList.add('active');
            this.$slope.classList.add('active');
            this.$powerAvg.classList.add('active');

            this.$smo2.classList.remove('active');
            this.$thb.classList.remove('active');
            this.$coreBodyTemperature.classList.remove('active');
            this.$skinTemperature.classList.remove('active');
        }
        if(equals(state, 1)) {
            this.$smo2.classList.add('active');
            this.$thb.classList.add('active');
            this.$coreBodyTemperature.classList.add('active');
            this.$skinTemperature.classList.add('active');

            this.$speed.classList.remove('active');
            this.$distance.classList.remove('active');
            this.$powerAvg.classList.remove('active');
            this.$slope.classList.remove('active');
        }
        return;
    }
}

customElements.define('data-tile-switch-group', DataTileSwitchGroup);

export { SwitchGroup, DataTileSwitchGroup };
