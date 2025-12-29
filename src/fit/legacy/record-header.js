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

export { legacyRecordHeader };

