import { profiles } from '../profiles/profiles.js';

function legacyDefinition() {
    function read(view, start = 0) {
        const headerByte = view.getUint8(start, true);
        const local_number = headerByte & 0b00001111;
        const architecture = view.getUint8(start + 2, true);
        const messageNumber = view.getUint16(start + 3, true);
        const message = profiles.numberToMessageName(messageNumber);
        const numberOfFields = view.getUint8(start + 5, true);

        let i = start + 6;
        const fields = [];
        let data_msg_length = 1;

        for(let f = 0; f < numberOfFields; f += 1) {
            const number = view.getUint8(i + 0, true);
            const size = view.getUint8(i + 1, true);
            const base_type = view.getUint8(i + 2, true);
            const field = profiles.numberToField(message, number).name;
            fields.push({ field, number, size, base_type });
            data_msg_length += size;
            i += 3;
        }

        return {
            type: 'definition',
            message,
            architecture,
            local_number,
            length: i - start,
            data_msg_length,
            fields,
        };
    }

    function encode(localMessageDefinition) {
        const local_number = localMessageDefinition.local_number ?? 0;
        const message = localMessageDefinition.message;
        const fields = localMessageDefinition.fields ?? [];
        const globalNumber = profiles.messageNameToNumber(message);

        const length = 6 + (fields.length * 3);
        const bytes = new Uint8Array(length);
        const view = new DataView(bytes.buffer);

        // normal header, definition message
        view.setUint8(0, 0b01000000 + (local_number & 0b00001111), true);
        view.setUint8(1, 0, true);
        view.setUint8(2, 0, true);
        view.setUint16(3, globalNumber, true);
        view.setUint8(5, fields.length, true);

        let i = 6;
        for(const field of fields) {
            view.setUint8(i + 0, field.number, true);
            view.setUint8(i + 1, field.size, true);
            view.setUint8(i + 2, field.base_type, true);
            i += 3;
        }

        return bytes;
    }

    return Object.freeze({
        read,
        encode,
    });
}

export { legacyDefinition };

