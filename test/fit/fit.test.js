// import { describe, expect, test } from 'vitest';

import { dataviewToArray } from '../../src/functions.js';
import { fit } from '../../src/fit/fit.js';
import { appData } from './data.js';

describe('AppData', () => {

    test('toFITjs', () => {
        const res = fit.localActivity.toFITjs({
            records: appData.records,
            laps: appData.laps,
        });

        const header = res[0];
        expect(header.type).toBe('header');
        expect(header.dataType).toBe('.FIT');

        const totalLength = res.reduce((acc, r) => acc + (r?.length ?? 0), 0);
        expect(header.dataSize).toBe(totalLength - (header.length + fit.CRC.size));

        const recordMsgs = res.filter((r) => r.type === 'data' && r.name === 'record');
        expect(recordMsgs.length).toBe(appData.records.length);
        expect(recordMsgs[0].fields.timestamp).toBe(appData.records[0].timestamp);
        expect(recordMsgs[0].fields.power).toBe(appData.records[0].power);
    });

    test('encode', () => {
        // res: Dataview
        const res = fit.localActivity.encode({
            records: appData.records,
            laps: appData.laps,
        });
        // resArray: [Int]
        const resArray = dataviewToArray(res);

        // basic integrity: header.dataSize matches byteLength
        const header = fit.fileHeader.decode(res);
        expect(res.byteLength).toBe(header.length + header.dataSize + fit.CRC.size);

        // check CRC
        const expectedHeaderCRC = fit.CRC.calculateCRC(new DataView(res.buffer), 0, 11);
        const expectedFileCRC = fit.CRC.calculateCRC(
            new DataView(res.buffer),
            0,
            (resArray.length - 1) - fit.CRC.size,
        );

        expect(fit.CRC.getHeaderCRC(res).number).toEqual(expectedHeaderCRC);
        expect(fit.CRC.getFileCRC(res).number).toEqual(expectedFileCRC);
    });

    test('decode', () => {
        const encoded = fit.localActivity.encode({
            records: appData.records,
            laps: appData.laps,
        });

        const decoded = fit.FITjs.decode(new DataView(encoded.buffer));
        const recordMsgs = decoded.filter((r) => r.type === 'data' && r.name === 'record');
        expect(recordMsgs.length).toBe(appData.records.length);
        expect(recordMsgs[0].fields.timestamp).toBe(appData.records[0].timestamp);
    });
});
