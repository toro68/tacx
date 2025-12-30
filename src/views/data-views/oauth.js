import { xf, exists, existance, validate, equals, isNumber, last, empty, avg, toFixed, formatDate } from '../../functions.js';
import { formatTime } from '../../utils.js';
import { models } from '../../models/models.js';
import { DialogMsg } from '../../models/enums.js';
class OAuth extends HTMLElement {
    constructor() {
        super();
    }
    connectedCallback() {
        const self = this;
        this.abortController = new AbortController();
        this.signal = { signal: self.abortController.signal };
        this.services = {strava: false, intervals: false};

        this.$stravaButton = self.querySelector('#strava--connect--button');
        this.$intervalsButton = self.querySelector('#intervals--connect--button');
        this.$tpButton = self.querySelector('#tp--connect--button');

        xf.sub('action:oauth', self.onAction.bind(this), this.signal);
        xf.sub('db:services', self.onServices.bind(this), this.signal);
    }
    disconnectedCallback() {
        this.abortController.abort();
    }
    onServices(value) {
        this.services = value;
        this.render(this.services);
    }
    onAction(action) {
        const self = this;
        console.log(action);

        let service = action.split(':')[1];

        if(service === 'strava' ||
           service === 'intervals' ||
           service === 'trainingPeaks') {

            console.log(this.services[service]);
            if(this.services[service]) {
                models.api[service].disconnect();
            } else {
                models.api[service].connect();
            }
            return;
        }
    }
    render(services) {
        if(exists(this.$stravaButton)) {
            this.$stravaButton.textContent = services.strava ? 'Disconnect' : 'Connect';
        }
        if(exists(this.$intervalsButton)) {
            this.$intervalsButton.textContent = services.intervals ? 'Disconnect' : 'Connect';
        }
        if(exists(this.$tpButton)) {
            this.$tpButton.textContent = services.tp ? 'Disconnect' : 'Connect';
        }
    }
}

customElements.define('o-auth', OAuth);


