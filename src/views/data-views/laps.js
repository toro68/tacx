import { xf, exists, existance, validate, equals, isNumber, last, empty, avg, toFixed, formatDate } from '../../functions.js';
import { formatTime } from '../../utils.js';
import { models } from '../../models/models.js';
import { DialogMsg } from '../../models/enums.js';
import { DataView } from './base.js';
class LapsList extends DataView {
    postInit() {
        this.isEmpty = true;
    }
    getDefaults() {
        return { prop: 'db:lap', };
    }
    config() {
        this.$lapsCont = this.querySelector('.laps--cont');
    }
    subs() {
        xf.reg(`${this.prop}`, this.onUpdate.bind(this), this.signal);
    }
    toLap(lap, index) {
        const duration = lap.totalElapsedTime;
        const powerLap = validate(
            [exists, isNumber],
            toFixed(lap.avgPower, 0),
            0,
        );
        const cadenceLap = validate(
            [exists, isNumber],
            toFixed(lap.avgCadence, 0),
            0,
        );
        const heartRateLap = validate(
            [exists, isNumber],
            toFixed(lap.avgHeartRate, 0),
            0,
        );
        const zone = models.ftp.powerToZone(powerLap).name;

        const smo2Lap = validate([exists, isNumber], lap.saturated_hemoglobin_percent, 0);
        const thbLap  = validate([exists, isNumber], lap.total_hemoglobin_conc, 0);
        const coreTemperatureLap = validate(
            [exists, isNumber],
            lap.core_temperature,
            0,
        );
        const skinTemperatureLap = validate(
            [exists, isNumber],
            lap.skin_temperature,
            0,
        );

        return `<div class="lap--item">
                    <div class="lap--item--inner">
                        <div class="lap--value lap--index">${index}</div>
                        <div class="lap--value lap--duration">${formatTime({value: duration, format: 'mm:ss'})}</div>
                        <div class="lap--value lap--power zone-${zone}-color">${powerLap} W</div>
                        <div class="lap--value lap--cadence">${cadenceLap}</div>
                        <div class="lap--value lap--heart-rate">${heartRateLap}</div>
                        <div class="lap--value lap--smo2">${smo2Lap.toFixed(2)}</div>
                        <div class="lap--value lap--thb">${thbLap.toFixed(2)}</div>
                        <div class="lap--value lap--core-temperature">${coreTemperatureLap.toFixed(2)}</div>
                        <div class="lap--value lap--skin-temperature">${skinTemperatureLap.toFixed(2)}</div>
                    </div>
                </div>`;
    }
    restore(laps) {
        this.state = laps;
        laps.forEach((lap, index) => this.render(lap, index+1));
    }
    onUpdate(propValue, db) {
        if(empty(db.laps)) {
            return;
        } else if(this.isEmpty) {
            this.restore(db.laps);
            this.isEmpty = false;
        } else {
            this.updateState(db.laps);
            this.render(last(db.laps), this.state.length);
        }

    }
    render(lap, i) {
        this.$lapsCont.insertAdjacentHTML('afterbegin', this.toLap(lap, i));
    }
}

customElements.define('laps-list', LapsList);

