import { fileHeader } from '../file-header.js';
import { calculateCRC } from '../../utils.js';

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

export { legacyFileHeader };

