import { expect } from './core.js';
import { curry2 } from './functional.js';
import { clamp } from './math.js';

function Spec(args = {}) {
    const definitions = expect(args.definitions);

    const applyResolution = curry2((prop, value) => {
        return value / definitions[prop].resolution;
    });

    const removeResolution = curry2((prop, value) => {
        return value * definitions[prop].resolution;
    });

    function encodeField(prop, input, transform = applyResolution(prop)) {
        const fallback = definitions[prop].default;
        const min = applyResolution(definitions[prop].min);
        const max = applyResolution(definitions[prop].max);
        const value = input ?? fallback;

        return Math.floor(clamp(min, max, transform(value)));
    }

    function decodeField(prop, input, transform = removeResolution) {
        return transform(prop, input);
    }

    return {
        definitions,
        applyResolution,
        removeResolution,
        encodeField,
        decodeField,
    };
}

export { Spec };

