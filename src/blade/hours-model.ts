// Pro opening hours: pure helpers shared by the "Mes horaires" screen and its tests.
export type HoursMode = 'both' | 'domicile' | 'deplacement';
export type HoursRange = { start_time: string; end_time: string; mode: HoursMode };
export type HoursRule = HoursRange & { day_of_week: number };
/** Week as shown to the pro, Monday first. Index = day_of_week (0 = Sunday). */
export type Week = Record<number, HoursRange[]>;

export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
export const MODE_LABELS: Record<HoursMode, string> = { both: 'Sur place et à domicile', domicile: 'Sur place seulement', deplacement: 'À domicile seulement' };
export const MAX_RANGES = 42;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const toMin = (t: string) => { const [h, m] = t.slice(0, 5).split(':').map(Number); return h * 60 + m; };
/** End minute, "00:00" meaning midnight. */
const endMin = (t: string) => toMin(t) === 0 ? 1440 : toMin(t);
const isMode = (v: unknown): v is HoursMode => v === 'both' || v === 'domicile' || v === 'deplacement';

export function emptyWeek(): Week { return { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }; }

export function weekFromRules(rules: { day_of_week: number; start_time: string; end_time: string; mode: string }[]): Week {
  const week = emptyWeek();
  for (const r of rules) {
    if (!(r.day_of_week in week)) continue;
    week[r.day_of_week].push({ start_time: String(r.start_time).slice(0, 5), end_time: String(r.end_time).slice(0, 5), mode: isMode(r.mode) ? r.mode : 'both' });
  }
  for (const d of WEEK_ORDER) week[d].sort((a, b) => toMin(a.start_time) - toMin(b.start_time));
  return week;
}

export function rulesFromWeek(week: Week): HoursRule[] {
  return WEEK_ORDER.flatMap(d => (week[d] ?? []).map(r => ({ day_of_week: d, ...r })));
}

/** First problem in a range, or '' when valid. */
export function rangeError(r: HoursRange): string {
  if (!TIME.test(r.start_time) || !TIME.test(r.end_time)) return 'Indique une heure de début et de fin';
  if (toMin(r.start_time) % 30 || toMin(r.end_time) % 30) return 'Choisis des heures à la demi-heure (09:00, 09:30…)';
  if (endMin(r.end_time) <= toMin(r.start_time)) return 'L’heure de fin doit être après l’heure de début';
  if (endMin(r.end_time) - toMin(r.start_time) < 30) return 'Une plage dure au moins 30 minutes';
  return '';
}

/** First problem in the whole week, or '' when it can be saved. */
export function weekError(week: Week): string {
  const all = rulesFromWeek(week);
  if (all.length > MAX_RANGES) return `${MAX_RANGES} plages au maximum`;
  for (const d of WEEK_ORDER) {
    const day = week[d] ?? [];
    for (const r of day) { const e = rangeError(r); if (e) return `${DAY_NAMES[d]} : ${e}`; }
    const sorted = [...day].sort((a, b) => toMin(a.start_time) - toMin(b.start_time));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1], cur = sorted[i];
      const sameAudience = prev.mode === 'both' || cur.mode === 'both' || prev.mode === cur.mode;
      if (sameAudience && toMin(cur.start_time) < endMin(prev.end_time)) return `${DAY_NAMES[d]} : deux plages se chevauchent`;
    }
  }
  return '';
}

/** Short summary of a day, e.g. "09:00–12:00, 14:00–19:00" or "Fermé". */
export function daySummary(ranges: HoursRange[]): string {
  return ranges.length ? ranges.map(r => `${r.start_time}–${r.end_time}`).join(', ') : 'Fermé';
}
