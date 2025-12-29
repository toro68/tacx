// Backwards-compatible re-export for tests/older imports.
import { profiles, Profiles } from './profiles/profiles.js';

const appTypes = profiles.types;

export {
    Profiles,
    profiles,
    appTypes,
};
