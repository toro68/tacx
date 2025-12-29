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

export { legacySummary };

