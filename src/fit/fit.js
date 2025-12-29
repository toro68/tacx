//
// FITjs
//

import { calculateCRC, typeToAccessor } from '../utils.js';
import { CRC } from './crc.js';
import { fileHeader } from './file-header.js';
import { recordHeader } from './record-header.js';
import { fieldDefinition } from './field-definition.js';
import { definitionRecord } from './definition-record.js';
import { dataRecord } from './data-record.js';
import { profiles } from './profiles/profiles.js';
import { fitRecord, FITjs } from './fitjs.js';

import { localActivity } from './local-activity.js';
import { localCourse } from './local-course.js';

function FIT(args = {}) {

    function legacyFileHeader() {
        function read(view) {
            const decoded = fileHeader.decode(view, 0);
            return {
                type: decoded.type,
                length: decoded.length,
                protocolVersion: decoded.protocolVersion,
                profileVersion: decoded.profileVersion,
                dataRecordsLength: decoded.dataSize,
                fileType: decoded.dataType,
                crc: decoded.crc ?? false,
            };
        }

        function encode(args = {}) {
            const headerSize = args.length ?? args.headerSize ?? (args.crc === false ? 12 : 14);
            const protocolVersionRaw = args.protocolVersion ?? '2.0';
            const protocolVersion = protocolVersionRaw === '1' ? '1.0' : protocolVersionRaw;
            const profileVersion = args.profileVersion ?? '21.40';
            const dataRecordsLength = args.dataRecordsLength ?? args.dataSize ?? 0;
            const fileType = args.fileType ?? args.dataType ?? '.FIT';

            const bytes = new Uint8Array(headerSize);
            const view = new DataView(bytes.buffer);

            view.setUint8(0, headerSize, true);
            view.setUint8(1, protocolVersion === '2.0' ? 32 : 16, true);
            view.setUint16(2, parseInt(parseFloat(profileVersion) * 100), true);
            view.setUint32(4, dataRecordsLength, true);
            for(let i = 0; i < 4; i += 1) {
                view.setUint8(8 + i, fileType.charCodeAt(i), true);
            }
            if(headerSize === 14) {
                const crc = calculateCRC(bytes, 0, 12);
                view.setUint16(12, crc, true);
            }

            return bytes;
        }

        return Object.freeze({
            read,
            encode,
        });
    }

    function legacyRecordHeader() {
        function read(byte) {
            return {
                type: ((byte >> 6) & 1) === 1 ? 'definition' : 'data',
                header_type: ((byte >> 7) & 1) === 1 ? 'timestamp' : 'normal',
                developer: ((byte >> 5) & 1) === 1,
                local_number: byte & 0b00001111,
            };
        }

        return Object.freeze({ read });
    }

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

            // FIT files always end with a 2-byte CRC.
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

    function legacySummary() {
        function isDataRecord(record) {
            return record?.type === 'data' && record?.message === 'record';
        }

        function getDataRecords(activity = []) {
            return activity.filter(isDataRecord);
        }

        function accumulations(dataRecords = []) {
            function avgMax(key) {
                const values = dataRecords.map((r) => r.fields?.[key]).filter((v) => v !== undefined);
                const sum = values.reduce((a, b) => a + b, 0);
                const avg = values.length ? Math.floor(sum / values.length) : 0;
                const max = values.reduce((a, b) => (b > a ? b : a), 0);
                return {avg, max};
            }

            return {
                power: avgMax('power'),
                cadence: avgMax('cadence'),
                speed: avgMax('speed'),
                heartRate: avgMax('heart_rate'),
            };
        }

        function calculate(activity = []) {
            const dataRecords = getDataRecords(activity);
            const acc = accumulations(dataRecords);
            const first = dataRecords[0]?.fields ?? {};
            const last = dataRecords[dataRecords.length - 1]?.fields ?? {};

            const timeStart = first.timestamp ?? 0;
            const timeEnd = last.timestamp ?? 0;

            return {
                ...acc,
                distance: last.distance ?? 0,
                timeStart,
                timeEnd,
                elapsed: timeEnd - timeStart,
            };
        }

        function toFooter(summary, crc = false) {
            return [
                {type: 'data', message: 'event', local_number: 2, fields: {}},
                {type: 'definition', message: 'lap', local_number: 4, fields: []},
                {type: 'data', message: 'lap', local_number: 4, fields: {}},
                {type: 'definition', message: 'session', local_number: 5, fields: []},
                {type: 'data', message: 'session', local_number: 5, fields: {}},
                {type: 'definition', message: 'activity', local_number: 6, fields: []},
                {type: 'data', message: 'activity', local_number: 6, fields: {}},
            ];
        }

        return Object.freeze({
            isDataRecord,
            getDataRecords,
            accumulations,
            calculate,
            toFooter,
        });
    }

    return {
        // Legacy API used by tests
        fileHeader: legacyFileHeader(),
        header: legacyRecordHeader(),
        definition: legacyDefinition(),
        data: legacyData(),
        activity: legacyActivity(),
        summary: legacySummary(),

        // Current/core modules
        fileHeaderCore: fileHeader,
        recordHeader,
        definitionRecord,
        dataRecord,
        fieldDefinition,
        CRC,
        profiles,
        fitRecord,
        FITjs,

        // remove those from the general library
        localActivity,
        localCourse,
    };
}

const fit = FIT();

export {
    FIT,
    fit,
};
