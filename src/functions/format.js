function hex(n) {
    return '0x' + parseInt(n).toString(16).toUpperCase().padStart(2, '0');
}

function toNumber(value) {
    return +value;
}

function toBool(value) {
    return !!(value);
}

function toFixed(x, points = 2, fallback = 0) {
    if(typeof x !== 'number' || Number.isNaN(x)) return fallback;
    const precision = 10 ** points;
    return Math.round(x * precision) / precision;
}

function dataviewToArray(dataview) {
    return Array.from(new Uint8Array(dataview.buffer));
}

function dataviewToString(dataview) {
    let utf8decoder = new TextDecoder('utf-8');
    return utf8decoder.decode(dataview.buffer);
}

function arrayBufferToArray(buffer) {
    return Array.from(new Uint8Array(buffer));
}

function stringToCharCodes(str) {
    return str.split('').map((c) => c.charCodeAt(0));
}

function time() {
    const d = new Date();
    const mm = (d.getMinutes()).toString().padStart(2, '0');
    const ss = (d.getSeconds()).toString().padStart(2, '0');
    const mmmm = (d.getMilliseconds()).toString().padStart(4, '0');
    return `${mm}:${ss}:${mmmm}`;
}

function formatDate(args = {}) {
    const date = args.date ?? new Date();
    const s = args.separator ?? '/';
    const showYear = args.year ?? true;

    const day = (date.getDate()).toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString();

    return `${day}${s}${month}${showYear ? s : ''}${showYear ? year : ''}`;
}

export {
    hex,
    toNumber,
    toBool,
    toFixed,
    dataviewToArray,
    dataviewToString,
    arrayBufferToArray,
    stringToCharCodes,
    time,
    formatDate,
};

