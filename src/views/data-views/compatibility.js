import { xf, exists, existance, validate, equals, isNumber, last, empty, avg, toFixed, formatDate } from '../../functions.js';
import { formatTime } from '../../utils.js';
import { models } from '../../models/models.js';
import { DialogMsg } from '../../models/enums.js';
class CompatibilityCheck extends HTMLElement {
    constructor() {
        super();
    }
    connectedCallback() {
        const self = this;
        this.abortController = new AbortController();
        this.signal = { signal: self.abortController.signal };

        if(!self.compatible()) {
            self.show();
        }
    }
    disconnectedCallback() {
        this.abortController.abort();
    }
    compatible() {
        return 'bluetooth' in navigator;
    }
    show() {
        const self = this;
        this.innerHTML =
        `<div id="compatibility--cont">
             <p>This browser is NOT supported. Please open the app with </p>
             <a href="https://www.google.com/chrome/" target="_blank">Chrome</a> or
             <a href="https://www.microsoft.com/edge" target="_blank">Edge</a>
             <p>Please note that <b>iOS</b> is NOT supported at all, regardless of browser.</p>
             <p>For more information visit the project <a href="https://github.com/dvmarinoff/Flux" target="_blank">Page.</a></p>
         </div>`;
    }
    hide() {
        const self = this;
        this.innerHTML = '';
    }
}


customElements.define('compatibility-check', CompatibilityCheck);


