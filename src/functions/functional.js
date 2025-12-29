import { exists } from './core.js';

function compose2(f, g) {
    return function(...args) {
        return f(g(...args));
    };
}

function compose(...fns) {
    return fns.reduce(compose2);
}

function pipe(...fns) {
    return fns.reduceRight(compose2);
}

function repeat(n) {
    return function(f) {
        return function(x) {
            if (n > 0) {
                return repeat(n - 1)(f)(f(x));
            } else {
                return x;
            }
        };
    };
}

function curry2(fn) {
    return function(arg1, arg2) {
        if(exists(arg2)) {
            return fn(arg1, arg2);
        } else {
            return function(arg2) {
                return fn(arg1, arg2);
            };
        }
    };
}

function once(fn, context) {
    let result;
    return function() {
        if(fn) {
            result = fn.apply(context || this, arguments);
            fn = null;
        }
        return result;
    };
}

export {
    compose,
    compose2,
    pipe,
    repeat,
    curry2,
    once,
};

