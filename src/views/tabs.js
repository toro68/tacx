import { xf } from '../functions.js';

class TabBtn extends HTMLElement {
    constructor() {
        super();
    }
    connectedCallback() {
        this.state = '';
        this.effect = this.getAttribute('effect') || '';
        this.param = this.getAttribute('param') || '';
        this.prop = this.getAttribute('prop') || false;
        if(!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '0');
        if(!this.hasAttribute('role')) this.setAttribute('role', 'button');
        this._onEffect = this.onEffect.bind(this);
        this._onKeyDown = this.onKeyDown.bind(this);
        this.addEventListener('click', this._onEffect);
        this.addEventListener('keydown', this._onKeyDown);

        if(this.prop) {
            xf.sub(`db:${this.prop}`, this.onUpdate.bind(this));
            document.removeEventListener(`db:${this.prop}`, this.onUpdate);
        }
    }
    disconnectedCallback() {
        this.removeEventListener('click', this._onEffect);
        this.removeEventListener('keydown', this._onKeyDown);
    }
    onEffect(e) {
        xf.dispatch(`ui:${this.effect}`, this.param);
    }
    onKeyDown(e) {
        if(e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.onEffect(e);
        }
    }
    onUpdate(state) {
        this.state = state;
        if(this.state === this.param) {
            this.classList.remove('active');
            this.classList.add('active');
        } else {
            this.classList.remove('active');
        }
    }
}

class TabGroup extends HTMLElement {
    constructor() {
        super();
        this.tabClass = this.defaultTabSelector();
        this.tabAttr = this.defaultTabAttr();
        this.prop = this.getAttribute('prop') || '';
        this.tabs = this.querySelectorAll(this.tabClass);
    }
    defaultTabSelector() { return '.tab'; }
    defaultTabAttr() { return 'tab'; }
    connectedCallback() {
        xf.sub(`db:${this.prop}`, this.onUpdate.bind(this));
    }
    disconnectedCallback() {
        document.removeEventListener(`db:${this.prop}`, this.onUpdate);
    }
    onUpdate(param) {
        this.tabs.forEach(tab => {
            if(this.getId(tab) === param) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
    }
    getId(tab) {
        return tab.getAttribute(this.tabAttr);
    }
}

customElements.define('tab-btn', TabBtn);
customElements.define('tab-group', TabGroup);



class PageBtn extends TabBtn {}
class PageGroup extends TabGroup {
    defaultTabSelector() { return '.page'; }
    defaultTabAttr() { return 'page'; }
}

customElements.define('page-btn', PageBtn);
customElements.define('page-group', PageGroup);

export { TabBtn, TabGroup };
