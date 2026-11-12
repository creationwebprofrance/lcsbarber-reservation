// Pure BLADE booking rules shared by the browser (quotes, slot lists) and the
// blade-booking server function (authoritative checks). No runtime imports.

export type Mode = 'domicile' | 'deplacement';
export type Rule = { day_of_week: number; start_time: string; end_time: string; is_available: boolean; mode: string };
export type Override = { date: string; start_time: string | null; end_time: string | null; is_available: boolean; mode: string };
export type Pricing = {
  travel_free_minutes: number; travel_interval_minutes: number; travel_fee_per_interval: number;
  early_hour_threshold: number; early_hour_fee: number; late_hour_threshold: number; late_hour_fee: number;
  same_day_fee: number; sunday_fee: number;
};

export const DEFAULT_PRICING: Pricing = {
  travel_free_minutes: 20, travel_interval_minutes: 20, travel_fee_per_interval: 10,
  early_hour_threshold: 10, early_hour_fee: 5, late_hour_threshold: 20, late_hour_fee: 5, same_day_fee: 5, sunday_fee: 10,
};

/** "Le client se déplace" address and reduced prices of LCS Barber (no travel fee). */
export const DOMICILE_ADDRESS = 'Imp. des Hirondelles Prolongée, 95380 Puiseux-en-France';
export const DOMICILE_OFFERS: Record<string, { label: string; price: number }> = {
  'Contours': { label: 'Contours', price: 10 },
  'Coupe classique': { label: 'Coupe', price: 15 },
  'Coupe + barbe': { label: 'Coupe + barbe', price: 20 },
};
export const MODE_LABEL: Record<Mode, string> = { domicile: 'Le client se déplace', deplacement: 'LCS Barber se déplace' };

const fits = (ruleMode: string, mode: Mode) => ruleMode === 'both' || ruleMode === mode;
const toMin = (t: string) => { const [h, m] = t.slice(0, 5).split(':').map(Number); return h * 60 + m; };
const toTime = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Weekday (0 = Sunday) of an ISO date, independent of the runtime timezone. */
export const weekday = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();

/** 30-minute start times open on a date for a mode. Same semantics as the LCSBARBER slot picker:
 * a closed override without hours blocks the day; timed overrides replace the weekly rules; "00:00" end = midnight. */
export function slotsForDate(rules: Rule[], overrides: Override[], mode: Mode, iso: string): string[] {
  const day = overrides.filter(o => o.date === iso);
  if (day.some(o => !o.is_available && !o.start_time && fits(o.mode, mode))) return [];
  const timed = day.filter(o => o.is_available && o.start_time && o.end_time);
  const ranges: [string, string][] = timed.length
    ? timed.filter(o => fits(o.mode, mode)).map(o => [o.start_time!, o.end_time!])
    : rules.filter(r => r.is_available && r.day_of_week === weekday(iso) && fits(r.mode, mode)).map(r => [r.start_time, r.end_time]);
  const out = new Set<string>();
  for (const [s, e] of ranges) {
    const start = toMin(s); let end = toMin(e); if (end <= start) end = 1440;
    for (let m = start; m < end; m += 30) out.add(toTime(m));
  }
  return [...out].sort();
}

/** Slots still bookable: open, not taken, and (for today) not already past. */
export function bookableSlots(open: string[], taken: string[], iso: string, todayIso: string, nowMinutes: number): string[] {
  const busy = new Set(taken.map(t => t.slice(0, 5)));
  return open.filter(t => !busy.has(t) && (iso > todayIso || (iso === todayIso && toMin(t) > nowMinutes)));
}

export function travelFee(durationMinutes: number, p: Pricing): number {
  if (!durationMinutes || durationMinutes < p.travel_free_minutes) return 0;
  return Math.floor(durationMinutes / p.travel_interval_minutes) * p.travel_fee_per_interval;
}

/** Half of the total, 10 € minimum when the total is under 20 € (LCS Barber rule). */
export function depositFor(total: number): number {
  if (!total || total <= 0) return 0;
  if (total < 20) return 10;
  return Math.round((total / 2) * 100) / 100;
}

export type Quote = { label: string; base: number; hourly: number; sameDay: number; sunday: number; travel: number; total: number };

/** Price breakdown. "Le client se déplace": reduced price + hourly supplement only.
 * "LCS Barber se déplace": catalogue price + hourly, same-day, Sunday and travel fees. Returns null when the service is not offered in that mode. */
export function quote(service: { name: string; price: number }, mode: Mode, iso: string, time: string, todayIso: string, p: Pricing, travelMinutes = 0): Quote | null {
  const offer = mode === 'domicile' ? DOMICILE_OFFERS[service.name] : { label: service.name, price: Number(service.price) };
  if (!offer) return null;
  const hour = Number(time.slice(0, 2));
  let hourly = 0;
  if (hour < p.early_hour_threshold) hourly += (p.early_hour_threshold - hour) * p.early_hour_fee;
  if (hour >= p.late_hour_threshold) hourly += (hour - (p.late_hour_threshold - 1)) * p.late_hour_fee;
  const sameDay = mode === 'deplacement' && iso === todayIso ? p.same_day_fee : 0;
  const sunday = mode === 'deplacement' && weekday(iso) === 0 ? p.sunday_fee : 0;
  const travel = mode === 'deplacement' ? travelFee(travelMinutes, p) : 0;
  return { label: offer.label, base: offer.price, hourly, sameDay, sunday, travel, total: offer.price + hourly + sameDay + sunday + travel };
}

/** A BLADE booking waits for the provider's deposit confirmation only when the provider can collect it by link. */
export function initialStatus(p: { opt_payment_links: boolean; revolut_url: string | null; stripe_link_url: string | null }): 'pending' | 'confirmed' {
  return p.opt_payment_links && Boolean(p.revolut_url || p.stripe_link_url) ? 'pending' : 'confirmed';
}

export const PHONE_OK = (v: string) => v.replace(/\D/g, '').length >= 10 && v.replace(/\D/g, '').length <= 15;
