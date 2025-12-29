function equals(a, b) {
    return Object.is(a, b);
}

function isNull(x) {
    return Object.is(x, null);
}

function isUndefined(x) {
    return Object.is(x, undefined);
}

function isFunction(x) {
    return equals(typeof x, 'function');
}

function isArray(x) {
    return Array.isArray(x);
}

function isArrayBuffer(x) {
    return x instanceof ArrayBuffer;
}

function isDataView(x) {
    return x instanceof DataView;
}

function exists(x) {
    if(isNull(x) || isUndefined(x)) { return false; }
    return true;
}

function isObject(x) {
    return exists(x) && equals(typeof x, 'object') && !(isArray(x));
}

function isCollection(x) {
    return isArray(x) || isObject(x);
}

function isString(x) {
    return equals(typeof x, 'string');
}

function isNumber(x) {
    if(isNaN(x)) return false;
    return equals(typeof x, 'number');
}

function isAtomic(x) {
    return isNumber(x) || isString(x);
}

function existance(value, fallback) {
    if(exists(value)) return value;
    if(exists(fallback)) return fallback;
    throw new Error(`existance needs a fallback value `, value);
}

function expect(x, msg = 'expected value here') {
    if(exists(x)) return x;
    throw new Error(msg);
}

function validate(predicates = [], value, fallback = undefined) {
    if(predicates.reduce((acc, p) => acc && p(value), true)) return value;
    if(exists(fallback)) return fallback;
    throw new Error(`validate needs a fallback value with `, value);
}

export {
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
};

