// Pure helpers for blade-trip: privacy trim of the route start, simplification and site allow-list.
export type Pt = [number, number];

export function metersBetween(a: Pt, b: Pt): number {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad, dLng = (b[0] - a[0]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Drops the first `meters` of the line (interpolating the new first point). */
export function trimStart(coords: Pt[], meters: number): Pt[] {
  let walked = 0;
  for (let i = 1; i < coords.length; i++) {
    const seg = metersBetween(coords[i - 1], coords[i]);
    if (walked + seg >= meters) {
      const f = seg === 0 ? 1 : (meters - walked) / seg;
      const start: Pt = [coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * f, coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * f];
      return [start, ...coords.slice(i)];
    }
    walked += seg;
  }
  // Route shorter than the privacy distance: only reveal the destination end.
  const end = coords[coords.length - 1];
  return [end, end];
}

function perpDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = dx * dx + dy * dy;
  if (len === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function rdp(coords: Pt[], tol: number): Pt[] {
  if (coords.length <= 2) return coords;
  const keep = new Uint8Array(coords.length); keep[0] = keep[coords.length - 1] = 1;
  const stack: [number, number][] = [[0, coords.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let max = 0, idx = -1;
    for (let i = s + 1; i < e; i++) { const d = perpDist(coords[i], coords[s], coords[e]); if (d > max) { max = d; idx = i; } }
    if (idx > 0 && max > tol) { keep[idx] = 1; stack.push([s, idx], [idx, e]); }
  }
  return coords.filter((_, i) => keep[i]);
}

/** Simplifies to at most `max` points, always keeping both ends. */
export function simplify(coords: Pt[], max: number): Pt[] {
  if (coords.length <= max) return coords;
  let tol = 0.000005, out = coords;
  for (let i = 0; i < 24 && out.length > max; i++, tol *= 2) out = rdp(coords, tol);
  if (out.length > max) { // uniform fallback
    const step = (out.length - 1) / (max - 1);
    out = Array.from({ length: max }, (_, i) => out[Math.round(i * step)]);
  }
  return out;
}

export function publicRoute(coords: Pt[], hideMeters: number, maxPoints: number): Pt[] {
  return simplify(trimStart(coords, hideMeters), maxPoints).map(([lng, lat]) => [Number(lng.toFixed(6)), Number(lat.toFixed(6))] as Pt);
}

/** Email link origin: only BLADE's own hosts or a local dev server, otherwise the fallback. */
export function resolveSite(site: string | undefined, fallback: string): string {
  const s = (site ?? '').trim().replace(/\/+$/, '');
  if (/^https:\/\/([a-z0-9-]+\.)*lovable\.app$/i.test(s) && s.toLowerCase() !== 'https://lovable.app') return s;
  if (/^http:\/\/localhost:\d{1,5}$/i.test(s)) return s;
  return fallback;
}
