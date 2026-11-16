// Calculs du « trajet estimé » : aucune position GPS en continu, seulement
// l'itinéraire calculé au départ, la durée de route et les retards signalés.

export type LngLat = [number, number];
export type TripStatus = 'en_route' | 'arrived' | 'cancelled';

/** Part maximale affichée tant que le barber n'a pas confirmé son arrivée. */
export const MAX_ESTIMATED_PROGRESS = 0.97;

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Distance en mètres entre deux points [lng, lat]. */
export function haversine(a: LngLat, b: LngLat): number {
  const dLat = rad(b[1] - a[1]); const dLng = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Distances cumulées le long du tracé (premier élément = 0). */
export function cumulative(route: LngLat[]): number[] {
  const out = [0];
  for (let i = 1; i < route.length; i++) out.push(out[i - 1] + haversine(route[i - 1], route[i]));
  return out;
}

/** Point situé à la fraction `f` (0 à 1) de la longueur du tracé, et l'index du segment. */
export function pointAt(route: LngLat[], f: number, cum = cumulative(route)): { point: LngLat; index: number } {
  if (!route.length) throw new Error('Tracé vide');
  if (route.length === 1) return { point: route[0], index: 0 };
  const total = cum[cum.length - 1];
  const target = Math.max(0, Math.min(1, f)) * total;
  let i = 1;
  while (i < cum.length - 1 && cum[i] < target) i++;
  const seg = cum[i] - cum[i - 1];
  const t = seg > 0 ? (target - cum[i - 1]) / seg : 0;
  const [a, b] = [route[i - 1], route[i]];
  return { point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], index: i - 1 };
}

export type TripTiming = { status: TripStatus; started_at: string; duration_s: number; delay_min: number };

/** Heure d'arrivée estimée (ms) : départ + durée de route + retards signalés. */
export const etaMs = (t: TripTiming) => Date.parse(t.started_at) + t.duration_s * 1000 + t.delay_min * 60000;

/**
 * Avancement estimé (0 à 1). Tant que le barber n'a pas confirmé son arrivée, on ne montre
 * jamais le marqueur arrivé : on plafonne à MAX_ESTIMATED_PROGRESS (« arrivée imminente »).
 */
export function estimatedProgress(t: TripTiming, nowMs: number): number {
  if (t.status === 'arrived') return 1;
  const start = Date.parse(t.started_at);
  const total = Math.max(1, etaMs(t) - start);
  const raw = (nowMs - start) / total;
  return Math.max(0, Math.min(MAX_ESTIMATED_PROGRESS, raw));
}

/** Minutes restantes estimées (arrondies au-dessus, jamais négatives). */
export function minutesLeft(t: TripTiming, nowMs: number): number {
  if (t.status !== 'en_route') return 0;
  return Math.max(0, Math.ceil((etaMs(t) - nowMs) / 60000));
}
