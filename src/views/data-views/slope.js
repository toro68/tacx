import { xf, exists, existance, validate, equals, isNumber, last, empty, avg, toFixed, formatDate } from '../../functions.js';
import { formatTime } from '../../utils.js';
import { models } from '../../models/models.js';
import { DialogMsg } from '../../models/enums.js';
import { DataView } from './base.js';
class SlopeTarget extends DataView {
    getDefaults() {
        return {
            prop: 'db:slopeTarget',
        };
    }
    transform(state) {
        return state.toFixed(1);
    }
}

customElements.define('slope-target', SlopeTarget);

export { SlopeTarget };
