import { dataviewToArray } from '../../src/functions.js';
import { fit } from '../../src/fit/fit.js';
import { data } from './min-data.js';

describe('FIT core', () => {
    test('fileHeader decode (14 bytes)', () => {
        const headerBuffer = new Uint8Array([14, 32, 92, 8, 39, 0, 0, 0, 46, 70, 73, 84, 123, 197]).buffer;
        const view = new DataView(headerBuffer);

        expect(fit.fileHeader.decode(view)).toEqual({
            type: 'header',
            length: 14,
            headerSize: 14,
            protocolVersion: '2.0',
            profileVersion: '21.40',
            dataSize: 39,
            dataType: '.FIT',
            crc: 50555,
        });
    });

    test('fileHeader decode (12 bytes legacy)', () => {
        const headerBuffer = new Uint8Array([12, 16, 100, 0, 241, 118, 2, 0, 46, 70, 73, 84]).buffer;
        const view = new DataView(headerBuffer);

        expect(fit.fileHeader.decode(view)).toEqual({
            type: 'header',
            length: 12,
            headerSize: 12,
            protocolVersion: '1.0',
            profileVersion: '1.00',
            dataSize: 161521,
            dataType: '.FIT',
        });
    });

    test('fileHeader encode (14 bytes)', () => {
        const view = new DataView(new ArrayBuffer(14));
        fit.fileHeader.encode(
            {
                type: 'header',
                length: 14,
                headerSize: 14,
                protocolVersion: '2.0',
                profileVersion: '21.40',
                dataSize: 100,
                dataType: '.FIT',
            },
            view,
            0,
        );

        expect(dataviewToArray(view)).toEqual([14, 32, 92, 8, 100, 0, 0, 0, 46, 70, 73, 84, 63, 224]);
    });

    test('FITjs minimal decode/encode', () => {
        const bytes = new Uint8Array(data.minimal);
        const view = new DataView(bytes.buffer);

        expect(fit.FITjs.decode(view)).toEqual(data.minimalFITjs);
        expect(dataviewToArray(fit.FITjs.encode(data.minimalFITjs))).toEqual(data.minimal);
    });
});

