import { z } from 'zod';
export const positiveInterval = z.coerce.number().int().positive();
export const serviceSchema = z.object({ name: z.string().trim().min(2).max(150), description: z.string().max(2000).nullable(), price: z.coerce.number().finite().nonnegative(), duration_minutes: z.coerce.number().int().positive().max(1440), is_active: z.boolean() });
export type RevenueBooking = { id: string; appointment_date: string; total_price: number; status: string; city_normalized?: string | null; client_address?: string | null };
export type RevenueWork = { id: string; prestation_date: string; amount: number; booking_id: string | null };
export function revenueByMonth(bookings: RevenueBooking[], work: RevenueWork[], year: number) {
  const months = Array.from({ length: 12 }, (_, i) => ({ month: new Date(year, i, 1).toLocaleDateString('fr-FR', { month: 'short' }), cents: 0, bookings: 0 }));
  const included = bookings.filter(b => ['confirmed', 'completed'].includes(b.status));
  const ids = new Set(bookings.map(b => b.id));
  for (const b of included) if (b.appointment_date.startsWith(`${year}-`)) { const m = months[Number(b.appointment_date.slice(5, 7)) - 1]; if (m) { m.cents += Math.round(Number(b.total_price) * 100); m.bookings++; } }
  // A linked realization never creates additional turnover, even for another year/status.
  for (const w of work) if (!w.booking_id && !ids.has(w.id) && w.prestation_date.startsWith(`${year}-`)) { const m = months[Number(w.prestation_date.slice(5, 7)) - 1]; if (m) m.cents += Math.round(Number(w.amount) * 100); }
  return { months: months.map(m => ({ ...m, revenue: m.cents / 100 })), total: months.reduce((n, m) => n + m.cents, 0) / 100 };
}
export function normalizedCity(address: string | null | undefined) {
  const match = address?.match(/\b\d{5}\s+([^,]+)(?:,|$)/);
  return match?.[1]?.trim() || null;
}
export function cityVisits(bookings: RevenueBooking[], from: string, to: string, today: string) {
  const cities = new Map<string, { city: string; count: number; proxy: number }>();
  for (const b of bookings) {
    if (b.appointment_date < from || b.appointment_date > to || b.appointment_date >= today || !['completed', 'confirmed'].includes(b.status)) continue;
    const city = b.city_normalized || normalizedCity(b.client_address);
    if (!city) continue;
    const key = city.toLocaleLowerCase('fr'); const row = cities.get(key) || { city, count: 0, proxy: 0 }; row.count++; if (b.status === 'confirmed') row.proxy++; cities.set(key, row);
  }
  return [...cities.values()].sort((a, b) => b.count - a.count);
}

// Régularité des clients : calculée à partir des rendez-vous honorés (confirmés ou terminés, date passée).
export type ClientTier = 'regulier' | 'nouveau' | 'occasionnel' | 'a_relancer' | 'jamais';
export const CLIENT_TIERS: Record<ClientTier, { label: string; hint: string }> = {
  regulier: { label: 'Régulier', hint: 'Au moins 3 visites sur 12 mois, la dernière il y a moins de 60 jours' },
  nouveau: { label: 'Nouveau', hint: 'Première visite il y a moins de 60 jours' },
  occasionnel: { label: 'Occasionnel', hint: 'Dernière visite il y a moins de 4 mois' },
  a_relancer: { label: 'À relancer', hint: 'Pas venu depuis plus de 4 mois' },
  jamais: { label: 'Jamais venu', hint: 'Aucun rendez-vous honoré' },
};
export const CLIENT_TIER_ORDER: ClientTier[] = ['regulier', 'nouveau', 'occasionnel', 'a_relancer', 'jamais'];
export type ClientStats = { visits: number; lastVisit: string | null; spent: number; avgBasket: number | null; tier: ClientTier };
type StatBooking = { client_id: string | null; client_email?: string | null; appointment_date: string; status: string; total_price: number };
const HONORED = new Set(['confirmed', 'completed']);
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);

/** Statistiques d'un client : visites honorées, dernière visite, panier moyen et niveau de régularité. */
export function clientStats(client: { id: string; email?: string | null }, bookings: StatBooking[], today: string): ClientStats {
  const email = client.email?.trim().toLowerCase();
  const mine = bookings.filter(b => HONORED.has(b.status) && b.appointment_date <= today
    && (b.client_id ? b.client_id === client.id : !!email && b.client_email?.trim().toLowerCase() === email));
  const visits = mine.length;
  const spent = Math.round(mine.reduce((s, b) => s + Number(b.total_price || 0), 0) * 100) / 100;
  const lastVisit = mine.reduce<string | null>((m, b) => (!m || b.appointment_date > m ? b.appointment_date : m), null);
  const avgBasket = visits ? Math.round((spent / visits) * 100) / 100 : null;
  let tier: ClientTier = 'jamais';
  if (lastVisit) {
    const since = daysBetween(lastVisit, today);
    const lastYear = mine.filter(b => daysBetween(b.appointment_date, today) <= 365).length;
    tier = since <= 60 && lastYear >= 3 ? 'regulier' : since <= 60 && visits === 1 ? 'nouveau' : since <= 120 ? 'occasionnel' : 'a_relancer';
  }
  return { visits, lastVisit, spent, avgBasket, tier };
}
