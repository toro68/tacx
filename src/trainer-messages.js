export function parseTrainerMessage(text) {
    const t = String(text ?? '').trim();
    if (!t) return { kind: 'empty' };
    let m = null;

    m = /^Power target sent \((\d+)\s*W\)$/i.exec(t);
    if (m) return { kind: 'powerSent', watts: Number(m[1]) };
    m = /^Power target (?:failed|error) \(will retry\):\s*(\d+)\s*W$/i.exec(t);
    if (m) return { kind: 'powerRetry', watts: Number(m[1]) };
    if (/^Power target queued \(not connected\)$/i.test(t)) return { kind: 'powerQueuedNotConnected' };
    if (/^Power target queued \(mode mismatch\)$/i.test(t)) return { kind: 'powerQueuedModeMismatch' };

    m = /^Grade sent \((-?\d+(?:\.\d+)?)%\)$/i.exec(t);
    if (m) return { kind: 'gradeSent', grade: Number(m[1]) };
    m = /^Grade (?:failed|error) \(will retry\):\s*(-?\d+(?:\.\d+)?)%$/i.exec(t);
    if (m) return { kind: 'gradeRetry', grade: Number(m[1]) };
    if (/^Grade queued \(not connected\)$/i.test(t)) return { kind: 'gradeQueuedNotConnected' };
    if (/^Grade queued \(mode mismatch\)$/i.test(t)) return { kind: 'gradeQueuedModeMismatch' };

    m = /^Resistance target sent \((-?\d+(?:\.\d+)?)\)$/i.exec(t);
    if (m) return { kind: 'resistanceSent', value: Number(m[1]) };
    m = /^Resistance target (?:failed|error) \(will retry\):\s*(-?\d+(?:\.\d+)?)$/i.exec(t);
    if (m) return { kind: 'resistanceRetry', value: Number(m[1]) };
    if (/^Resistance target queued \(not connected\)$/i.test(t)) return { kind: 'resistanceQueuedNotConnected' };
    if (/^Resistance target queued \(mode mismatch\)$/i.test(t)) return { kind: 'resistanceQueuedModeMismatch' };

    m = /^Wind sent \((.+)\)$/i.exec(t);
    if (m) return { kind: 'windSent', detail: m[1].trim() };

    return { kind: 'unknown', text: t };
}
