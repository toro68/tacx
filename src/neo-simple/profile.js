import { prepareCanvas } from './canvas.js';
import { elevationAt } from './routes.js';

function clamp(x, min, max) {
    return Math.min(max, Math.max(min, x));
}

export function drawRouteProfile({ canvas, ctx, route, totalDistanceM }) {
    const { w, h } = prepareCanvas(canvas, ctx);
    ctx.clearRect(0, 0, w, h);

    const pts = route?.points ?? [];
    const lengthM = route?.lengthM ?? 0;
    if (!pts.length || lengthM <= 0) return;

    let minE = Infinity;
    let maxE = -Infinity;
    for (const p of pts) {
        minE = Math.min(minE, p.e);
        maxE = Math.max(maxE, p.e);
    }
    const pad = 12;
    const innerW = w - pad * 2;
    const innerH = h - pad * 2;
    const eRange = Math.max(1, maxE - minE);

    ctx.lineWidth = 2;

    ctx.beginPath();
    for (let i = 0; i < pts.length; i += 1) {
        const x = pad + (pts[i].d / lengthM) * innerW;
        const y = pad + (1 - (pts[i].e - minE) / eRange) * innerH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.lineTo(pad + innerW, pad + innerH);
    ctx.lineTo(pad, pad + innerH);
    ctx.closePath();
    ctx.fillStyle = 'rgba(76,154,255,0.10)';
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.beginPath();
    for (let i = 0; i < pts.length; i += 1) {
        const x = pad + (pts[i].d / lengthM) * innerW;
        const y = pad + (1 - (pts[i].e - minE) / eRange) * innerH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();

    const wrappedDistance = lengthM > 0 ? totalDistanceM % lengthM : totalDistanceM;
    const progressX = pad + (clamp(wrappedDistance, 0, lengthM) / lengthM) * innerW;
    const riderE = elevationAt(route, wrappedDistance);
    const riderY = pad + (1 - (riderE - minE) / eRange) * innerH;

    ctx.fillStyle = 'rgba(76,154,255,0.95)';
    ctx.beginPath();
    ctx.arc(progressX, riderY, 5.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.fillText(`${route?.name ?? ''}`, pad, 14);
}
