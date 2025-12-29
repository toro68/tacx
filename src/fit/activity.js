// Backwards-compatible API for tests/older imports.
import { profiles } from './profiles/profiles.js';
import { toFitTimestamp } from '../utils.js';

function FileId(args = {}) {
    return {
        type: 'data',
        message: 'file_id',
        local_number: 0,
        fields: {
            time_created: toFitTimestamp(args.time_created ?? Date.now()),
            manufacturer: 255,
            product: 0,
            number: 0,
            type: 4,
        },
    };
}

function Event(args = {}) {
    return {
        type: 'data',
        message: 'event',
        local_number: 2,
        fields: {
            timestamp: toFitTimestamp(args.timestamp),
            event: 0,
            event_type: args.event_type ?? 0,
            event_group: 0,
        },
    };
}

function Activity(args = {}) {
    const type = profiles?.types?.activity?.values?.manual ?? 0;
    const event = profiles?.types?.event?.values?.activity ?? 26;
    const event_type = profiles?.types?.event_type?.values?.stop ?? 1;
    return {
        type: 'data',
        message: 'activity',
        local_number: 6,
        fields: {
            timestamp: toFitTimestamp(args.timestamp),
            local_timestamp: 0,
            num_sessions: 1,
            type,
            event,
            event_type,
        },
    };
}

export const activity = Object.freeze({
    toFitTimestamp,
    FileId,
    Event,
    Activity,
});

