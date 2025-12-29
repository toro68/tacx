import { equals } from './core.js';
import { first, second } from './collections.js';

function XF(args = {}) {
    let data = {};
    let name = args.name || 'db';

    function create(obj) {
        data = proxify(obj);
    }

    function proxify(obj) {
        let handler = {
            set: (target, key, value) => {
                target[key] = value;
                dispatch(`${name}:${key}`, target);
                return true;
            }
        };
        return new Proxy(obj, handler);
    }

    function dispatch(eventType, value) {
        window.dispatchEvent(evt(eventType)(value));
    }

    function sub(eventType, handler, options = {}) {
        function handlerWraper(e) {
            if(isStoreSource(eventType)) {
                handler(e.detail.data[evtProp(eventType)]);
            } else {
                handler(e.detail.data);
            }
        }

        window.addEventListener(
            eventType, handlerWraper, Object.assign({capture: false}, options)
        );

        return handlerWraper;
    }

    function reg(eventType, handler, options = {}) {
        function handlerWraper(e) {
            return handler(e.detail.data, data);
        }

        window.addEventListener(
            eventType, handlerWraper, Object.assign({capture: false}, options)
        );

        return handlerWraper;
    }

    function unsub(eventType, handler, options = {}) {
        window.removeEventListener(eventType, handler, Object.assign({capture: false}, options));
    }

    function isStoreSource(eventType) {
        return equals(evtSource(eventType), name);
    }

    function evt(eventType) {
        return function(value) {
            return new CustomEvent(eventType, {detail: {data: value}});
        };
    }

    function evtProp(eventType) {
        return second(eventType.split(':'));
    }

    function evtSource(eventType) {
        return first(eventType.split(':'));
    }

    return Object.freeze({
        create,
        reg,
        sub,
        dispatch,
        unsub
    });
}

const xf = XF();

export { XF, xf };

