import { parseTrainerMessage } from '../src/trainer-messages.js';

describe('parseTrainerMessage', () => {
    test('empty', () => {
        expect(parseTrainerMessage('')).toEqual({ kind: 'empty' });
    });

    test('power sent', () => {
        expect(parseTrainerMessage('Power target sent (245 W)')).toEqual({ kind: 'powerSent', watts: 245 });
    });

    test('power retry', () => {
        expect(parseTrainerMessage('Power target failed (will retry): 250 W')).toEqual({ kind: 'powerRetry', watts: 250 });
        expect(parseTrainerMessage('Power target error (will retry): 250 W')).toEqual({ kind: 'powerRetry', watts: 250 });
    });

    test('power queued reasons', () => {
        expect(parseTrainerMessage('Power target queued (not connected)')).toEqual({ kind: 'powerQueuedNotConnected' });
        expect(parseTrainerMessage('Power target queued (mode mismatch)')).toEqual({ kind: 'powerQueuedModeMismatch' });
    });

    test('grade sent', () => {
        expect(parseTrainerMessage('Grade sent (4%)')).toEqual({ kind: 'gradeSent', grade: 4 });
        expect(parseTrainerMessage('Grade sent (-2.5%)')).toEqual({ kind: 'gradeSent', grade: -2.5 });
    });

    test('grade queued reasons', () => {
        expect(parseTrainerMessage('Grade queued (not connected)')).toEqual({ kind: 'gradeQueuedNotConnected' });
        expect(parseTrainerMessage('Grade queued (mode mismatch)')).toEqual({ kind: 'gradeQueuedModeMismatch' });
    });

    test('grade retry', () => {
        expect(parseTrainerMessage('Grade failed (will retry): 4%')).toEqual({ kind: 'gradeRetry', grade: 4 });
        expect(parseTrainerMessage('Grade error (will retry): -2.5%')).toEqual({ kind: 'gradeRetry', grade: -2.5 });
    });

    test('resistance sent + retry', () => {
        expect(parseTrainerMessage('Resistance target sent (12)')).toEqual({ kind: 'resistanceSent', value: 12 });
        expect(parseTrainerMessage('Resistance target failed (will retry): 12')).toEqual({ kind: 'resistanceRetry', value: 12 });
        expect(parseTrainerMessage('Resistance target error (will retry): -7.5')).toEqual({ kind: 'resistanceRetry', value: -7.5 });
    });

    test('wind sent', () => {
        expect(parseTrainerMessage('Wind sent (12.5 km/h)')).toEqual({ kind: 'windSent', detail: '12.5 km/h' });
    });

    test('unknown returns original text', () => {
        expect(parseTrainerMessage('Trainer: ready')).toEqual({ kind: 'unknown', text: 'Trainer: ready' });
    });
});
