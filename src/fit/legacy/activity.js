import { CRC } from '../crc.js';
import { legacyFileHeader } from './file-header.js';
import { legacyRecordHeader } from './record-header.js';
import { legacyDefinition } from './definition.js';
import { legacyData } from './data.js';

function legacyActivity() {
    function toDefinitions(activity = []) {
        return activity.reduce((acc, record) => {
            if(record?.type === 'definition') {
                acc[record.local_number] = record;
            }
            return acc;
        }, {});
    }

    function toFileLength(activity = [], definitions = {}) {
        const sum = activity.reduce((acc, record) => {
            if(record?.type === 'header') return acc + (record.length ?? 0);
            if(record?.type === 'definition') return acc + (record.length ?? 0);
            if(record?.type === 'data') return acc + (definitions[record.local_number]?.data_msg_length ?? 0);
            return acc;
        }, 0);

        return sum + 2;
    }

    function read(view) {
        const activity = [];
        const definitions = {};

        let i = 0;

        const header = legacyFileHeader().read(view);
        activity.push(header);
        i += header.length;

        while(i < view.byteLength) {
            if(view.byteLength - i === 2) {
                activity.push({type: 'crc', value: view.getUint16(i, true)});
                break;
            }

            const h = legacyRecordHeader().read(view.getUint8(i, true));
            if(h.type === 'definition') {
                const def = legacyDefinition().read(view, i);
                definitions[def.local_number] = def;
                activity.push(def);
                i += def.length;
            } else {
                const def = definitions[h.local_number];
                const data = legacyData().read(def, view, i);
                activity.push(data);
                i += def.data_msg_length;
            }
        }

        return activity;
    }

    function encode(activity = []) {
        const definitions = toDefinitions(activity);

        const hasCRC = activity.some((r) => r?.type === 'crc');
        const activityWithCRC = hasCRC ? activity : activity.concat([{type: 'crc'}]);
        const fileLength = toFileLength(activityWithCRC, definitions);

        const bytes = new Uint8Array(fileLength);
        const view = new DataView(bytes.buffer);

        let i = 0;
        for(const record of activityWithCRC) {
            if(record.type === 'header') {
                const headerBytes = legacyFileHeader().encode(record);
                bytes.set(headerBytes, i);
                i += headerBytes.length;
                continue;
            }
            if(record.type === 'definition') {
                const defBytes = legacyDefinition().encode(record);
                bytes.set(defBytes, i);
                i += defBytes.length;
                continue;
            }
            if(record.type === 'data') {
                const def = definitions[record.local_number];
                const dataBytes = legacyData().encode(def, record.fields);
                bytes.set(dataBytes, i);
                i += dataBytes.length;
                continue;
            }
            if(record.type === 'crc') {
                const crcValue = record.value ?? CRC.calculateCRC(new DataView(bytes.buffer), 0, bytes.length - 3);
                view.setUint16(i, crcValue, true);
                i += 2;
                continue;
            }
        }

        return bytes;
    }

    return Object.freeze({
        read,
        encode,
        toDefinitions,
        toFileLength,
    });
}

export { legacyActivity };

