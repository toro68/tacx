import {
    isUndefined,
    isNull,
    isObject,
    isArray,
    isString,
    exists,
} from './core.js';
import { curry2 } from './functional.js';

function empty(x) {
    if(isUndefined(x)) return true;
    if(isNull(x)) throw new Error(`empty called with null`);
    if(isObject(x)) return (Object.keys(x).length === 0);
    if(isArray(x) || isString(x)) return x.length === 0;
    if(ArrayBuffer.isView(x)) return x.byteLength === 0;
    throw new Error(`empty called with unsupported type`);
}

const nth = curry2(function(offset, xs) {
    let i = (offset < 0) ? (xs.length + offset) : (offset);
    if(isString(xs)) {
        return xs.charAt(i);
    }
    return xs[i];
});

function first(xs) {
    if(isUndefined(xs)) return undefined;
    if(isNull(xs)) throw new Error(`first called with null`);
    if(isArray(xs) || isString(xs)) return xs.at(0);
    throw new Error(`first called with unsupported type`);
}

function second(xs) {
    if(isUndefined(xs)) return undefined;
    if(isNull(xs)) throw new Error(`second called with null`);
    if(isArray(xs) || isString(xs)) return xs.at(1);
    throw new Error(`second called with unsupported type`);
}

function third(xs) {
    if(isUndefined(xs)) return undefined;
    if(isNull(xs)) throw new Error(`third called with null`);
    if(isArray(xs) || isString(xs)) return xs.at(2);
    throw new Error(`third called with unsupported type`);
}

function last(xs) {
    if(isUndefined(xs)) return undefined;
    if(isNull(xs)) throw new Error(`last called with null`);
    if(isArray(xs) || isString(xs)) return xs.at(-1);
    throw new Error(`last called with unsupported type`);
}

function map(coll, fn) {
    if(isArray(coll)) return coll.map(fn);
    if(isObject(coll)) {
        for (let prop in coll) {
            coll[prop] = fn(coll[prop]);
        }
        return coll;
    }
    if(isString(coll)) {
        return coll.split('').map(fn).join('');
    }
    throw new Error(`map called with unkown collection `, coll);
}

function traverse(obj, fn = ((x) => x), acc = []) {
    function recur(fn, obj, keys, acc) {
        if(empty(keys)) {
            return acc;
        } else {
            let [k, ...ks] = keys;
            let v = obj[k];

            if(isObject(v)) {
                acc = recur(fn, v, Object.keys(v), acc);
                return recur(fn, obj, ks, acc);
            } else {
                acc = fn(acc, k, v, obj);
                return recur(fn, obj, ks, acc);
            }
        }
    }
    return recur(fn, obj, Object.keys(obj), acc);
}

function getIn(...args) {
    let [collection, ...path] = args;
    return path.reduce((acc, key) => {
        if(exists(acc[key])) return acc[key];
        return undefined;
    }, collection);
}

function set(coll, k, v) {
    coll = (coll || {});
    coll[k] = v;
    return coll;
}

function setIn(coll = {}, [k, ...keys], v) {
    return keys.length ? set(coll, k, setIn(coll[k], keys, v)) : set(coll, k, v);
}

export {
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
};

