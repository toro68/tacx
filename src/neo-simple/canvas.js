export function prepareCanvas(canvas, context) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, Math.round((window.devicePixelRatio || 1) * 100) / 100);
    const cssW = Math.max(1, Math.round(rect.width));
    const cssH = Math.max(1, Math.round(rect.height));
    const pxW = Math.max(1, Math.round(cssW * dpr));
    const pxH = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== pxW) canvas.width = pxW;
    if (canvas.height !== pxH) canvas.height = pxH;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: cssW, h: cssH, dpr };
}
