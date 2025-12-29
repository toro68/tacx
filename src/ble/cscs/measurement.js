//
// Backwards-compatible CSCS measurement helpers (used by tests).
//

import { equals, toFixed } from '../../functions.js';

const wheelDataPresent = (flags) => ((flags >> 0) & 1) === 1;
const crankDataPresent = (flags) => ((flags >> 1) & 1) === 1;

const _ = Object.freeze({
    flagsIndex: () => 0,

    cumulativeWheelRevolutionsIndex: (flags) => (wheelDataPresent(flags) ? 1 : undefined),
    lastWheelEventTimeIndex: (flags) => (wheelDataPresent(flags) ? 5 : undefined),

    cumulativeCrankRevolutionsIndex: (flags) => {
        if(!crankDataPresent(flags)) return undefined;
        return wheelDataPresent(flags) ? 7 : 1;
    },
    lastCrankEventTimeIndex: (flags) => {
        if(!crankDataPresent(flags)) return undefined;
        return wheelDataPresent(flags) ? 9 : 3;
    },

    readFlags: (view) => view.getUint8(0, true),

    readCumulativeWheelRevolutions: (view) => {
        const flags = _.readFlags(view);
        const i = _.cumulativeWheelRevolutionsIndex(flags);
        if(i === undefined) return undefined;
        return view.getUint32(i, true);
    },
    readLastWheelEventTime: (view) => {
        const flags = _.readFlags(view);
        const i = _.lastWheelEventTimeIndex(flags);
        if(i === undefined) return undefined;
        return view.getUint16(i, true);
    },
    readCumulativeCrankRevolutions: (view) => {
        const flags = _.readFlags(view);
        const i = _.cumulativeCrankRevolutionsIndex(flags);
        if(i === undefined) return undefined;
        return view.getUint16(i, true);
    },
    readLastCrankEventTime: (view) => {
        const flags = _.readFlags(view);
        const i = _.lastCrankEventTimeIndex(flags);
        if(i === undefined) return undefined;
        return view.getUint16(i, true);
    },
});

function RevsOverTime(args = {}) {
    const resolution = args.resolution;
    const maxRevs = args.maxRevs;
    const maxTime = args.maxTime;
    const format = args.format ?? ((x) => x);
    const rate = args.rate ?? (resolution / 2);

    let maxRateCount = args.maxRateCount ?? 3;
    let rateCount = 0;
    let revs_1 = -1;
    let time_1 = -1;
    let value = 0;

    const setRevs = (revs) => (revs_1 = revs);
    const setTime = (time) => (time_1 = time);
    const getRevs = () => revs_1;
    const getTime = () => time_1;
    const getRateCount = () => rateCount;

    function setMaxRateCount(maxCount) {
        maxRateCount = maxCount ?? 3;
        return maxRateCount;
    }

    function reset() {
        revs_1 = -1;
        time_1 = -1;
        value = 0;
        rateCount = 0;
        return {revs: revs_1, time: time_1};
    }

    function isRolloverTime(time_2) {
        return time_2 < getTime();
    }
    function isRolloverRevs(revs_2) {
        return revs_2 < getRevs();
    }
    function rollOverTime() {
        return getTime() - maxTime;
    }
    function rollOverRevs() {
        return getRevs() - maxRevs;
    }
    function stillRevs(revs_2) {
        return equals(getRevs(), revs_2);
    }

    function underRate(time_2) {
        if(equals(rateCount, maxRateCount)) {
            rateCount = 0;
            return false;
        }
        if(equals(getTime(), time_2)) {
            rateCount += 1;
            return true;
        }
        if((time_2 - getTime()) < rate) {
            rateCount += 1;
            return true;
        }
        rateCount = 0;
        return false;
    }

    function calculate(revs_2, time_2) {
        if(getRevs() < 0) setRevs(revs_2);
        if(getTime() < 0) setTime(time_2);

        if(underRate(time_2)) {
            return value;
        }

        if(stillRevs(revs_2)) {
            setTime(time_2);
            value = 0;
            return value;
        }

        if(isRolloverTime(time_2)) {
            setTime(rollOverTime());
        }
        if(isRolloverRevs(revs_2)) {
            setRevs(rollOverRevs());
        }

        value = format((revs_2 - getRevs()) / ((time_2 - getTime()) / resolution));
        setRevs(revs_2);
        setTime(time_2);
        return value;
    }

    return Object.freeze({
        reset,
        calculate,
        setMaxRateCount,
        getRateCount,
        getRevs,
        setRevs,
        getTime,
        setTime,
        rollOverTime,
        rollOverRevs,
    });
}

function Cadence() {
    return RevsOverTime({
        resolution: 1024,
        maxRevs: 2 ** 16,
        maxTime: 2 ** 16,
        format: (x) => Math.round(x * 60),
    });
}

function Speed(args = {}) {
    const wheelCircumference = args.wheelCircumference ?? 2.105;
    return RevsOverTime({
        resolution: 2048,
        maxRevs: 2 ** 32,
        maxTime: 2 ** 16,
        format: (x) => toFixed(x * wheelCircumference * 3.6, 2),
    });
}

function Measurement(args = {}) {
    const speed = Speed({wheelCircumference: args.wheelCircumference});
    const cadence = Cadence();

    function reset() {
        return {
            wheel: speed.reset(),
            crank: cadence.reset(),
        };
    }

    function decode(view) {
        const flags = _.readFlags(view);

        const wheelRevolutions = _.readCumulativeWheelRevolutions(view) ?? 0;
        const wheelEvent = _.readLastWheelEventTime(view) ?? 0;
        const crankRevolutions = _.readCumulativeCrankRevolutions(view) ?? 0;
        const crankEvent = _.readLastCrankEventTime(view) ?? 0;

        const decodedSpeed = wheelDataPresent(flags) ? speed.calculate(wheelRevolutions, wheelEvent) : 0;
        const decodedCadence = crankDataPresent(flags) ? cadence.calculate(crankRevolutions, crankEvent) : 0;

        return {
            wheelRevolutions,
            wheelEvent,
            speed: decodedSpeed,
            crankRevolutions,
            crankEvent,
            cadence: decodedCadence,
        };
    }

    return Object.freeze({
        speed,
        cadence,
        reset,
        decode,
    });
}

export {
    Measurement,
    Speed,
    Cadence,
    _,
};
