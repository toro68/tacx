function clamp(x, min, max) {
    return Math.min(max, Math.max(min, x));
}

export function hashSeed(str) {
    const s = String(str ?? '');
    let h = 2166136261;
    for (let i = 0; i < s.length; i += 1) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function normalizeElevationLoop(points) {
    if (!points.length) return points;
    const endD = points[points.length - 1]?.d ?? 0;
    if (endD <= 0) return points;
    const endE = points[points.length - 1]?.e ?? 0;
    if (!endE) return points;
    return points.map((p) => {
        const t = p.d / endD;
        return { d: p.d, e: p.e - endE * t };
    });
}

export function buildElevationPointsFromGradeSegments(segments) {
    const points = [{ d: 0, e: 0 }];
    let d = 0;
    let e = 0;
    for (const seg of segments) {
        const len = Math.max(1, Number(seg.lengthM) || 0);
        const grade = Number(seg.grade) || 0;
        d += len;
        e += (grade / 100) * len;
        points.push({ d, e });
    }
    return normalizeElevationLoop(points);
}

export function buildMiniHillsRoute() {
    const pts = [
        [0, 0],
        [200, 2],
        [450, 14],
        [650, 10],
        [950, 25],
        [1200, 18],
        [1500, 6],
        [1750, 2],
        [2100, 8],
        [2500, 22],
        [2850, 28],
        [3200, 20],
        [3600, 10],
        [4100, 6],
        [4700, 2],
        [5200, 0],
    ].map(([d, e]) => ({ d, e }));
    return { name: 'Mini Hills', points: normalizeElevationLoop(pts) };
}

export function buildPresetRoute(key) {
    if (key === 'flat') {
        const segments = [
            { lengthM: 800, grade: 0 },
            { lengthM: 900, grade: 0.5 },
            { lengthM: 800, grade: -0.5 },
            { lengthM: 900, grade: 0.3 },
            { lengthM: 900, grade: -0.3 },
            { lengthM: 900, grade: 0 },
        ];
        return { name: 'Flat Loop', points: buildElevationPointsFromGradeSegments(segments) };
    }
    if (key === 'rolling') {
        const segments = [
            { lengthM: 600, grade: 2 },
            { lengthM: 600, grade: -2 },
            { lengthM: 500, grade: 4 },
            { lengthM: 500, grade: -3 },
            { lengthM: 700, grade: 3 },
            { lengthM: 700, grade: -2 },
            { lengthM: 600, grade: 5 },
            { lengthM: 600, grade: -4 },
            { lengthM: 800, grade: 1 },
        ];
        return { name: 'Rolling Hills', points: buildElevationPointsFromGradeSegments(segments) };
    }
    if (key === 'climb') {
        const segments = [
            { lengthM: 800, grade: 1 },
            { lengthM: 2400, grade: 4 },
            { lengthM: 600, grade: 6 },
            { lengthM: 400, grade: 2 },
            { lengthM: 2400, grade: -4.5 },
            { lengthM: 400, grade: -1 },
        ];
        return { name: 'Long Climb', points: buildElevationPointsFromGradeSegments(segments) };
    }
    if (key === 'punchy') {
        const segments = [
            { lengthM: 500, grade: 0 },
            { lengthM: 250, grade: 10 },
            { lengthM: 450, grade: -6 },
            { lengthM: 250, grade: 12 },
            { lengthM: 450, grade: -7 },
            { lengthM: 250, grade: 9 },
            { lengthM: 450, grade: -5 },
            { lengthM: 250, grade: 11 },
            { lengthM: 700, grade: 0 },
        ];
        return { name: 'Punchy Repeats', points: buildElevationPointsFromGradeSegments(segments) };
    }
    return null;
}

export function buildRandomRoute({ seedStr, lengthM, maxGrade, gradeMin = -40, gradeMax = 40 }) {
    const seed = hashSeed(seedStr);
    const rnd = mulberry32(seed);
    const len = clamp(Number(lengthM) || 5200, 1000, 50000);
    const maxMagnitude = Math.max(1, Math.min(Math.abs(gradeMin), gradeMax));
    const gMax = clamp(Math.abs(Number(maxGrade) || 18), 1, maxMagnitude);
    const segmentsCount = clamp(Math.round(len / 220), 6, 120);
    const segLen = len / segmentsCount;

    let g = 0;
    const segments = [];
    for (let i = 0; i < segmentsCount; i += 1) {
        const delta = (rnd() * 2 - 1) * gMax * 0.35;
        g = clamp(g + delta, -gMax, gMax);
        g = Math.round(g * 0.85 * 10) / 10;
        segments.push({ lengthM: segLen, grade: g });
    }

    return {
        name: `Random (${seedStr || seed})`,
        points: buildElevationPointsFromGradeSegments(segments),
    };
}

export function elevationAt({ points, lengthM }, distanceM) {
    const pts = points || [];
    if (!pts.length || !lengthM) return 0;
    const d = clamp(distanceM, 0, lengthM);
    let i = 1;
    while (i < pts.length && pts[i].d < d) i += 1;
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i)];
    if (a.d === b.d) return a.e;
    const t = (d - a.d) / (b.d - a.d);
    return a.e + (b.e - a.e) * t;
}

export function gradeAt(route, distanceM) {
    const lengthM = route?.lengthM || 0;
    if (!lengthM) return 0;
    const d0 = clamp(distanceM, 0, lengthM);
    const d1 = clamp(d0 + 10, 0, lengthM);
    if (d1 === d0) return 0;
    const e0 = elevationAt(route, d0);
    const e1 = elevationAt(route, d1);
    return ((e1 - e0) / (d1 - d0)) * 100;
}
