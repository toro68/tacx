import { toBool } from './format.js';

function nthBit(field, bit) {
    return (field >> bit) & 1;
}

function setBit(i, n) {
    return n |= (1 << i);
}

function getBits(start, end, value) {
    return (value >> start) & ((1 << (end - start)) - 1);
}

function nthBitToBool(field, bit) {
    return toBool(nthBit(field, bit));
}

function xor(view, start = 0, end = view.byteLength) {
    let cs = 0;
    const length = (end < 0) ? (view.byteLength + end) : end;
    for (let i = start; i < length; i++) {
        cs ^= view.getUint8(i);
    }
    return cs;
}

function setUint24LE(dataview, index, value) {
    dataview.setUint8(index, value & 0xFF, true); // LSB
    dataview.setUint8(index + 1, (value >> 8) & 0xFF, true);
    dataview.setUint8(index + 2, value >> 16, true); // MSB
    return dataview;
}

function getUint24LE(dataview, index = 0) {
    const LSB = dataview.getUint8(index, true); // LSB
    const MB = dataview.getUint8(index + 1, true);
    const MSB = dataview.getUint8(index + 2, true); // MSB

    return (MSB << 16) + (MB << 8) + LSB;
}

export {
    nthBit,
    setBit,
    getBits,
    nthBitToBool,
    xor,
    setUint24LE,
    getUint24LE,
};

