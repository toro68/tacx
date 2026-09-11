export function clamp(x, min, max) {
  return Math.min(max, Math.max(min, x));
}

export function toInt(value, fallback = 0) {
  const x = Number.parseInt(String(value), 10);
  return Number.isFinite(x) ? x : fallback;
}

export function toFloat(value, fallback = 0) {
  const x = Number.parseFloat(String(value));
  return Number.isFinite(x) ? x : fallback;
}

export function pad2(n) {
  return String(n).padStart(2, '0');
}

export function formatRemaining(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '--';
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${pad2(r)}`;
}

export function formatElapsed(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '--';
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}:${pad2(m)}:${pad2(r)}`;
  return `${m}:${pad2(r)}`;
}

export function uid() {
  return Math.random().toString(16).slice(2);
}

export function createWarnOnce() {
  const seen = new Set();
  return function warnOnce(key, message) {
    if (seen.has(key)) return;
    seen.add(key);
    console.warn(message);
  };
}
