//
// A collection of common functions that makes JS more functional
//

import {
    hex,
    toNumber,
    toBool,
    toFixed,
    dataviewToArray,
    dataviewToString,
    arrayBufferToArray,
    stringToCharCodes,
    time,
    formatDate,
} from './functions/format.js';
import { print } from './functions/print.js';
import {
    empty,
    nth,
    first,
    second,
    third,
    last,
    map,
    traverse,
    getIn,
    set,
    setIn,
} from './functions/collections.js';
import { capitalize } from './functions/strings.js';
import { avg, mavg, max, sum, rand, clamp } from './functions/math.js';
import {
    nthBit,
    setBit,
    getBits,
    nthBitToBool,
    xor,
    setUint24LE,
    getUint24LE,
} from './functions/bits.js';
import { delay, wait } from './functions/async.js';
import { debounce } from './functions/debounce.js';
import { compose, compose2, pipe, repeat, curry2, once } from './functions/functional.js';
import { xf } from './functions/events.js';
import {
    equals,
    isNull,
    isUndefined,
    isFunction,
    isArray,
    isArrayBuffer,
    isDataView,
    isObject,
    isCollection,
    isString,
    isNumber,
    isAtomic,
    exists,
    existance,
    expect,
    validate,
} from './functions/core.js';
import { Spec } from './functions/specification.js';

export {
    // values
    equals,
    isNull,
    isUndefined,
    isFunction,
    exists,
    existance,
    expect,
    isArray,
    isArrayBuffer,
    isDataView,
    isObject,
    isString,
    isCollection,
    isNumber,
    isAtomic,
    validate,

    // collections
    first,
    second,
    third,
    last,
    empty,
    map,
    traverse,
    getIn,
    set,
    setIn,
    avg,
    mavg,
    max,
    sum,
    rand,
    capitalize,
    clamp,

    // functions
    compose,
    compose2,
    pipe,
    repeat,
    nth,
    curry2,
    once,
    debounce,

    // async
    delay,
    wait,

    // events
    xf,

    // format
    hex,
    toNumber,
    toFixed,
    toBool,
    dataviewToArray,
    dataviewToString,
    arrayBufferToArray,
    stringToCharCodes,
    time,
    formatDate,
    print,
    Spec,

    // bits
    nthBit,
    setBit,
    getBits,
    nthBitToBool,
    xor,
    setUint24LE,
    getUint24LE,
};
