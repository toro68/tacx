import { xf, exists, existance, validate, equals, isNumber, last, empty, avg, toFixed, formatDate } from '../../functions.js';
import { formatTime } from '../../utils.js';
import { models } from '../../models/models.js';
import { DialogMsg } from '../../models/enums.js';
class AutoStartCounter extends HTMLElement {
    constructor() {
        super();
        this.isVisible = false;
    }
    connectedCallback() {
        const self = this;
        this.abortController = new AbortController();
        this.signal = { signal: self.abortController.signal };

        xf.sub('ui:autoStartCounter', this.onUpdate.bind(this), this.signal);
    }
    disconnectedCallback() {
        this.abortController.abort();
    }
    onUpdate(value) {
        if(value === -1) {
            this.hide();
        } else {
            if(!this.isVisible) {
                this.show();
            }
            this.render(value);
        }
    }
    show() {
        this.classList.add('active');
    }
    hide() {
        this.classList.remove('active');
    }
    render(value) {
        this.textContent = value;
    }
}

customElements.define('auto-start-counter', AutoStartCounter);

class ModeLockToggle extends HTMLElement {
    constructor() {
        super();
        this.isOn = false;
    }
    connectedCallback() {
        const self = this;
        this.abortController = new AbortController();
        this.signal = { signal: self.abortController.signal };
        this.$icon = this.querySelector('.mode-lock--toggle--icon');
        this.$use = this.querySelector('use');

        this.addEventListener('pointerup', this.onPointerup.bind(this), this.signal);
        xf.sub('db:lock', this.onUpdate.bind(this), this.signal);
    }
    disconnectedCallback() {
        this.abortController.abort();
    }
    onUpdate(value) {
        this.isOn = value;
        this.render();
    }
    onPointerup() {
        xf.dispatch('ui:lock-set');
    }
    render() {
        if(this.isOn) {
            this.$use.setAttribute('href', '#icon--lock--close');
        } else {
            this.$use.setAttribute('href', '#icon--lock--open');
        }
    }
}

customElements.define('mode-lock-toggle', ModeLockToggle);


