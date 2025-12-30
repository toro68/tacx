import { xf, exists, existance, validate, equals, isNumber, last, empty, avg, toFixed, formatDate } from '../../functions.js';
import { formatTime } from '../../utils.js';
import { models } from '../../models/models.js';
import { DialogMsg } from '../../models/enums.js';
class ModalError extends HTMLElement {
    constructor() {
        super();
    }
    connectedCallback() {
        const self = this;
        this.abortController = new AbortController();
        this.signal = { signal: self.abortController.signal };

        this.$dialog = this.querySelector(`dialog`);
        this.$dismissBtn = this.querySelector(`.dialog--dismiss--btn`);
        this.$message = this.querySelector(`.dialog--message`);

        xf.sub(`ui:modal:error:open`, this.onOpen.bind(this), this.signal);
        this.$dismissBtn.addEventListener('pointerup', this.onClose.bind(this), this.signal);
    }
    disconnectedCallback() {
        this.abortController.abort();
    }
    onOpen(msg) {
        this.$dialog.showModal();
        this.$message.innerHTML = this.message(msg);
    }
    onClose(result) {
        this.$dialog.close();
    }
    message(msg) {
        if(msg === DialogMsg.noAuth) {
            return `Your session is over. You need to login again.`;
        };
        return '';
    }
}

customElements.define('modal-error', ModalError);


