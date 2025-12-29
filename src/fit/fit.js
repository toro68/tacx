//
// FITjs
//

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

import { legacyFileHeader } from './legacy/file-header.js';
import { legacyRecordHeader } from './legacy/record-header.js';
import { legacyDefinition } from './legacy/definition.js';
import { legacyData } from './legacy/data.js';
import { legacyActivity } from './legacy/activity.js';
import { legacySummary } from './legacy/summary.js';

function FIT(args = {}) {
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
