import { toNumber, toBool } from './format.js';
import { isFunction, isUndefined, exists, existance } from './core.js';

//
// Copied from lodash.js
//
function debounce(func, wait, options = {}) {
    const root = window;
    let lastArgs,
        lastThis,
        maxWait,
        result,
        timerId,
        lastCallTime;

    let lastInvokeTime = 0;
    let leading = false;
    let maxing = false;
    let trailing = true;

    // Bypass `requestAnimationFrame` by explicitly setting `wait=0`.
    const useRAF = (!wait && wait !== 0 && typeof root.requestAnimationFrame === 'function');

    if(!isFunction(func)) {
        throw new TypeError('debounce expectes a function');
    }

    wait = existance(toNumber(wait), 0);

    leading = toBool(options.leading);
    maxing = exists(options.maxWait);
    maxWait = maxing ? Math.max(existance(toNumber(options.maxWait), 0), wait) : maxWait;
    trailing = exists(options.trailing) ? toBool(options.trailing) : trailing;

    function invokeFunc(time) {
        const args = lastArgs;
        const thisArg = lastThis;

        lastArgs = lastThis = undefined;
        lastInvokeTime = time;
        result = func.apply(thisArg, args);
        return result;
    }

    function startTimer(pendingFunc, wait) {
        if (useRAF) {
            root.cancelAnimationFrame(timerId);
            return root.requestAnimationFrame(pendingFunc);
        }
        return setTimeout(pendingFunc, wait);
    }

    function cancelTimer(id) {
        if (useRAF) {
            return root.cancelAnimationFrame(id);
        }
        return clearTimeout(id);
    }

    function leadingEdge(time) {
        lastInvokeTime = time;
        timerId = startTimer(timerExpired, wait);
        return leading ? invokeFunc(time) : result;
    }

    function remainingWait(time) {
        const timeSinceLastCall = time - lastCallTime;
        const timeSinceLastInvoke = time - lastInvokeTime;
        const timeWaiting = wait - timeSinceLastCall;

        return maxing
            ? Math.min(timeWaiting, maxWait - timeSinceLastInvoke)
            : timeWaiting;
    }

    function shouldInvoke(time) {
        const timeSinceLastCall = time - lastCallTime;
        const timeSinceLastInvoke = time - lastInvokeTime;

        return (lastCallTime === undefined || (timeSinceLastCall >= wait) ||
               (timeSinceLastCall < 0) || (maxing && timeSinceLastInvoke >= maxWait));
    }

    function timerExpired() {
        const time = Date.now();
        if (shouldInvoke(time)) {
            return trailingEdge(time);
        }
        timerId = startTimer(timerExpired, remainingWait(time));
        return timerId;
    }

    function trailingEdge(time) {
        timerId = undefined;

        if (trailing && lastArgs) {
            return invokeFunc(time);
        }
        lastArgs = lastThis = undefined;
        return result;
    }

    function cancel() {
        if (timerId !== undefined) {
            cancelTimer(timerId);
        }
        lastInvokeTime = 0;
        lastArgs = lastCallTime = lastThis = timerId = undefined;
    }

    function flush() {
        return isUndefined(timerId) ? result : trailingEdge(Date.now());
    }

    function pending() {
        return !isUndefined(timerId);
    }

    function debounced(...args) {
        const time = Date.now();
        const isInvoking = shouldInvoke(time);

        lastArgs = args;
        lastThis = this;
        lastCallTime = time;

        if(isInvoking) {
            if(isUndefined(timerId)) {
                return leadingEdge(lastCallTime);
            }
            if(maxing) {
                timerId = startTimer(timerExpired, wait);
                return invokeFunc(lastCallTime);
            }
        }
        if(isUndefined(timerId)) {
            timerId = startTimer(timerExpired, wait);
        }
        return result;
    }

    debounced.cancel = cancel;
    debounced.flush = flush;
    debounced.pending = pending;
    return debounced;
}

export { debounce };

