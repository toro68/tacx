import { logger } from '../functions/logger.js';

const log = logger('persistence');

export function loadSettings() {
    try {
        const raw = localStorage.getItem('neoSimple:settings');
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return typeof parsed === 'object' && parsed ? parsed : {};
    } catch (e) {
        log.warn('Failed to load settings from localStorage', e);
        return {};
    }
}

export function saveSettings(next) {
    try {
        localStorage.setItem('neoSimple:settings', JSON.stringify(next));
    } catch (e) {
        log.warn('Failed to save settings to localStorage', e);
    }
}

export function loadZwoLibrary() {
    try {
        const raw = localStorage.getItem('neoSimple:zwoLibrary');
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((x) => x && typeof x === 'object');
    } catch (e) {
        log.warn('Failed to load ZWO library from localStorage', e);
        return [];
    }
}

export function saveZwoLibrary(list) {
    try {
        localStorage.setItem('neoSimple:zwoLibrary', JSON.stringify(list));
    } catch (e) {
        log.warn('Failed to save ZWO library to localStorage', e);
    }
}

export function storeZwoWorkout({ id, name, text }) {
    const entry = {
        id: typeof id === 'string' ? id : '',
        name: typeof name === 'string' ? name : '',
        text: typeof text === 'string' ? text : '',
        savedAt: Date.now(),
    };
    if (!entry.id || !entry.text) return;

    const lib = loadZwoLibrary();
    const next = [entry, ...lib.filter((x) => x?.id !== entry.id)];
    saveZwoLibrary(next.slice(0, 12));
}
