import { xf, exists, existance, validate, equals, isNumber, last, empty, avg, toFixed, formatDate } from '../../functions.js';
import { formatTime } from '../../utils.js';
import { models } from '../../models/models.js';
import { DialogMsg } from '../../models/enums.js';
class ViewAction extends HTMLElement {
    constructor() {
        super();
    }
    connectedCallback() {
        const self = this;
        this.abortController = new AbortController();
        this.signal = { signal: self.abortController.signal };

        const action = this.getAttribute('action');
        const topic = this.getAttribute('topic') ?? '';
        const on = this.getAttribute('on') ?? 'pointerup';
        const stopPropagation = this.hasAttribute('stoppropagation');

        if(action === undefined || action === '') {
            throw Error(`need to setup action attribute on view-action `, self);
        }

        this.addEventListener(on, (e) => {
            if(stopPropagation) {
                e.stopPropagation();
            }
            // console.log(`action${topic}`, action, stopPropagation);
            xf.dispatch(`action${topic}`, action);
            this.postAction();
        }, this.signal);
    }
    disconnectedCallback() {
        this.abortController.abort();
    }
    postAction() {
    }
}

customElements.define('view-action', ViewAction);


class BatteryLevel extends HTMLElement {
    constructor() {
        super();
    }
    connectedCallback() {
        const self = this;
        this.abortController = new AbortController();
        this.signal = { signal: self.abortController.signal };

        this.for = this.getAttribute('for');
        this.$level = this.querySelector('.battery--level');

        xf.sub(`${this.for}:batteryLevel`, this.onUpdate.bind(this), this.signal);
    }
    disconnectedCallback() {
        this.abortController.abort();
    }
    onUpdate(level) {
        this.$level.style.width = `${level}%`;

        this.classList.remove('ok');
        this.classList.remove('low');
        this.classList.remove('critical');

        if(level < 11) {
            this.classList.add('critical');
            return;
        }
        if(level < 21) {
            this.classList.add('low');
            return;
        }
        this.classList.add('ok');
    }
}

customElements.define('battery-level', BatteryLevel);


class NavigationAction extends ViewAction {
    constructor() {
        super();
    }
    connectedCallback() {
        super.connectedCallback();
    }
    disconnectedCallback() {
        super.disconnectedCallback();
    }
    postAction() {
        // this.siblings = this.parentElement.querySelectorAll('navigation-action');
        // for(let sibling of this.siblings) {
        //     sibling.classList.remove('active');
        // }
        // this.classList.add('active');
    }
}

customElements.define('navigation-action', NavigationAction);

export { ViewAction, BatteryLevel };
