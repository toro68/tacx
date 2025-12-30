import { xf, exists, existance, validate, equals, isNumber, last, empty, avg, toFixed, formatDate } from '../../functions.js';
import { formatTime } from '../../utils.js';
import { models } from '../../models/models.js';
import { DialogMsg } from '../../models/enums.js';
import { DataView } from './base.js';
class WorkoutName extends DataView {
    getDefaults() {
        return {
            prop: 'db:workout',
        };
    }
    getValue(propValue) {
        return propValue.meta.name;
    }
}

customElements.define('workout-name', WorkoutName);


class PowerTarget extends DataView {
    getDefaults() {
        return {
            prop: 'db:powerTarget',
        };
    }
}

customElements.define('power-target', PowerTarget);

class PowerTargetFTP extends DataView {
    getDefaults() {
        return {
            prop: 'db:powerTarget',
        };
    }
    subs() {
        xf.sub(`${this.prop}`, this.onUpdate.bind(this), this.signal);
        xf.sub(`db:ftp`,       this.onFTP.bind(this), this.signal);
    }
    onFTP(ftp) {
        this.ftp = ftp;
    }
    toPercentage(state, ftp) {
        return Math.round((state * 100) / ftp);
    }
    transform(state) {
        return `${this.toPercentage(state, this.ftp)}%`;
    }
}

customElements.define('power-target-ftp', PowerTargetFTP);

class CompanionGroup extends DataView {
    getDefaults() {
        return {
            prop: '',
            active: false,
        };
    }
    config() {
        this.$main = this.querySelector('.companion-main');
        this.$aux = this.querySelector('.companion-aux');
    }
    subs() {
        this.addEventListener(`pointerup`, this.onPointerup.bind(this), this.signal);
    }
    onPointerup() {
        this.active = !this.active;
        this.render();
    }
    render() {
        if(this.active) {
            this.$main.classList.add('active');
            this.$aux.classList.add('active');
        } else {
            this.$main.classList.remove('active');
            this.$aux.classList.remove('active');
        }
    }
}

customElements.define('companion-group', CompanionGroup);

export { WorkoutName, PowerTarget };
