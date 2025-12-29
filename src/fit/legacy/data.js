import { typeToAccessor } from '../../utils.js';

function legacyData() {
    function baseTypeSize(base_type) {
        const accessor = typeToAccessor(base_type, 'get');
        if(accessor.endsWith('Uint64') || accessor.endsWith('Int64')) return 8;
        if(accessor.endsWith('Uint32') || accessor.endsWith('Int32') || accessor.endsWith('Float32')) return 4;
        if(accessor.endsWith('Uint16') || accessor.endsWith('Int16')) return 2;
        return 1;
    }

    function read(localMessageDefinition, view, start = 0) {
        const local_number = view.getUint8(start, true) & 0b00001111;
        const message = localMessageDefinition.message;

        let i = start + 1;
        const fields = {};

        for(const field of (localMessageDefinition.fields ?? [])) {
            const accessor = typeToAccessor(field.base_type, 'get');
            const step = baseTypeSize(field.base_type);

            if(field.base_type === 13 && field.size === 3) {
                fields[field.field] = view.getUint8(i, true);
            } else if(field.size > step) {
                const value = [];
                for(let j = 0; j < field.size; j += step) {
                    value.push(view[accessor](i + j, true));
                }
                fields[field.field] = value;
            } else {
                fields[field.field] = view[accessor](i, true);
            }
            i += field.size;
        }

        return {
            type: 'data',
            message,
            local_number,
            fields,
        };
    }

    function encode(localMessageDefinition, values = {}) {
        const local_number = localMessageDefinition.local_number ?? 0;
        const fields = localMessageDefinition.fields ?? [];
        const length = 1 + fields.reduce((acc, f) => acc + f.size, 0);

        const bytes = new Uint8Array(length);
        const view = new DataView(bytes.buffer);

        // normal header, data message
        view.setUint8(0, local_number & 0b00001111, true);

        let i = 1;
        for(const field of fields) {
            const accessor = typeToAccessor(field.base_type, 'set');
            const step = baseTypeSize(field.base_type);
            const value = values[field.field];

            if(field.base_type === 13 && field.size === 3) {
                const b = value ?? 0xFF;
                view.setUint8(i + 0, b, true);
                view.setUint8(i + 1, 0, true);
                view.setUint8(i + 2, 0xFF, true);
            } else if(field.size > step) {
                for(let j = 0, k = 0; j < field.size; j += step, k += 1) {
                    view[accessor](i + j, value?.[k] ?? 0, true);
                }
            } else {
                view[accessor](i, value ?? 0, true);
            }
            i += field.size;
        }

        return bytes;
    }

    return Object.freeze({
        read,
        encode,
    });
}

export { legacyData };

