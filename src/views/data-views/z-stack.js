import { xf, exists, existance, validate, equals, isNumber, last, empty, avg, toFixed, formatDate } from '../../functions.js';
import { formatTime } from '../../utils.js';
import { models } from '../../models/models.js';
import { DialogMsg } from '../../models/enums.js';
class ZStack extends HTMLElement {
    constructor() {
        super();
        this.items = [];
        this.activeIndex = 0;
    }
    connectedCallback() {
        const self = this;
        this.abortController = new AbortController();
        this.signal = { signal: self.abortController.signal };

        this.$items = this.querySelectorAll('z-stack-item');
        this.key = this.dataset.key;
        this.persistance = exists(this.key) ? true : false;
        this.hasSwitchSub = exists(this.dataset.sub);

        if(this.hasSwitchSub) {
            xf.sub(this.$sub, this.onSwitch.bind(this), this.signal);
        } else {
            this.addEventListener(`pointerup`, this.onSwitch.bind(this), this.signal);
        }

        if(this.persistance) {
            xf.sub(`db:sources`, this.onSources.bind(this), this.signal);
        }
    }
    disconnectedCallback() {
        this.abortController.abort();
    }
    onSources(value) {
        const index = parseInt(value[this.key] ?? this.activeIndex);
        // console.log(`:onSources ${index} === ${this.activeIndex}`);
        if(index === this.activeIndex) return;
        this.activeIndex = index;
        this.render();
    }
    onSwitch() {
        this.incrementActive();
        this.render();

        if(this.persistance) {
            this.backup();
        }
    }
    backup() {
        const update = {};
        update[this.key] = this.activeIndex;
        xf.dispatch(`sources`, update);
    }
    incrementActive() {
        this.activeIndex = (this.activeIndex + 1) % Math.max(this.$items.length, 1);
    }
    render() {
        this.$items.forEach(($item, i) => {
            if(equals(i, this.activeIndex)) {
                $item.classList.add('active');
            } else {
                $item.classList.remove('active');
            }
        });
    }
}

customElements.define('z-stack', ZStack);


