import { dataviewToArray } from '../../src/functions.js';
import { fit } from '../../src/fit/fit.js';
import { appData, FITjs, fitBinary, flatFitBinary, } from './hrv-data.js';

describe('AppData', () => {

    test('DefinitionRecord.toFITjs', () => {
        const res = fit.definitionRecord.toFITjs(
            ['file_id', [
                'time_created',
                'manufacturer',
                'product',
                'serial_number',
                'number',
                'type',
            ], 0],
        );

        expect(res).toEqual({
            type: 'definition',
            name: 'file_id',
            architecture: 0,
            local_number: 0,
            length: 24,
            data_record_length: 16,
            fields: [
                {number: 4, size: 4, base_type: 'uint32'},
                {number: 1, size: 2, base_type: 'uint16'},
                {number: 2, size: 2, base_type: 'uint16'},
                {number: 3, size: 4, base_type: 'uint32z'},
                {number: 5, size: 2, base_type: 'uint16'},
                {number: 0, size: 1, base_type: 'enum'},
            ],
        });
    });

    test('DefinitionRecord.toFITjs Array', () => {
        const res = fit.definitionRecord.toFITjs(
            ['hrv', [['time', 10],], 4],
        );

        expect(res).toEqual({
            type: 'definition',
            name: 'hrv',
            architecture: 0,
            local_number: 4,
            length: 9,
            data_record_length: 11,
            fields: [
                {number: 0, size: 10, base_type: 'uint16'}, // time
            ],
        });
    });

    test('DataRecord.encode Array', () => {
        const view = new DataView(new ArrayBuffer(11));
        const definition = {
            type: 'definition',
            name: 'hrv',
            architecture: 0,
            local_number: 4,
            length: 9,
            data_record_length: 11,
            fields: [
                {number: 0, size: 10, base_type: 'uint16'}, // time
            ],
        };
        const data = {time: [0.882, 0.906, 0xFFFF, 0xFFFF, 0xFFFF],};
        const arrayT = [4, 114,3, 138,3, 255,255, 255,255, 255,255]; // true
        const arrayF = [4, 3,114, 3,138, 255,255, 255,255, 255,255]; // false
        const expected = {
            type: 'data',
            name: 'hrv',
            local_number: 4,
            length: 11,
            fields: {time: [0.882, 0.906, 0xFFFF, 0xFFFF, 0xFFFF],}
        };

        const encoded = fit.dataRecord.encode(definition, data, view, 0);
        const decoded = fit.dataRecord.decode(definition, view, 0);

        expect(dataviewToArray(encoded)).toEqual(arrayT);
        expect(decoded).toEqual(expected);
    });

    test('toFITjs', () => {
        const res = fit.localActivity.toFITjs({
            records: appData.records,
            laps: appData.laps,
            events: appData.events,
        });

        const header = res[0];
        expect(header.type).toBe('header');
        expect(header.dataType).toBe('.FIT');

        const totalLength = res.reduce((acc, r) => acc + (r?.length ?? 0), 0);
        expect(header.dataSize).toBe(totalLength - (header.length + fit.CRC.size));

        const hrvMsgs = res.filter((r) => r.type === 'data' && r.name === 'hrv');
        expect(hrvMsgs.length).toBe(1);
        expect(hrvMsgs[0].fields.time).toEqual(appData.records.find((r) => r.time)?.time);
    });
});
