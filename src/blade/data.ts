// BLADE read-only data layer: reads the shared LCSBARBER database. Never writes.
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js';
import type { SlotRequestInput } from './request-model';
import { supabase } from '@/integrations/supabase/client';

export type Service = { id: string; name: string; description: string | null; price: number; duration_minutes: number };
export type Review = { id: string; client_name: string; rating: number; comment: string | null; created_at: string };
export type Booking = { id: string; client_name: string; client_email: string; appointment_date: string; appointment_time: string; status: string; total_price: number; client_address: string | null; services: { name: string } | null };
export type Client = { id: string; name: string; email: string; phone: string | null; address: string | null };
type Rule = { day_of_week: number; start_time: string; end_time: string; is_available: boolean; mode: string };
type Override = { date: string; start_time: string | null; end_time: string | null; is_available: boolean; mode: string };

type State<T> = { data: T | null; loading: boolean; error: string | null };
function useRead<T>(load: () => Promise<T>, deps: unknown[] = []): State<T> {
  const [state, setState] = useState<State<T>>({ data: null, loading: true, error: null });
  useEffect(() => {
    let alive = true;
    setState(s => ({ ...s, loading: true }));
    load().then(data => alive && setState({ data, loading: false, error: null }))
      .catch(e => alive && setState({ data: null, loading: false, error: e?.message || 'Erreur de chargement' }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
const unwrap = <T,>({ data, error }: { data: T | null; error: { message: string } | null }) => { if (error) throw new Error(error.message); return (data ?? []) as T; };

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const apply = async (s: Session | null) => {
      setSession(s);
      if (s) { const { data } = await supabase.from('user_roles').select('role').eq('user_id', s.user.id).eq('role', 'admin'); setIsAdmin(!!data?.length); } else setIsAdmin(false);
      setReady(true);
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => { setTimeout(() => apply(s), 0); });
    supabase.auth.getSession().then(({ data }) => apply(data.session));
    return () => subscription.unsubscribe();
  }, []);
  const meta = session?.user.user_metadata ?? {};
  const fullName: string = meta.full_name || meta.name || '';
  const firstName = fullName.split(' ')[0] || '';
  return { session, isAdmin, ready, firstName, email: session?.user.email ?? '' };
}

export const useServices = () => useRead(async () => unwrap<Service[]>(await supabase.from('services').select('id,name,description,price,duration_minutes').eq('is_active', true).order('price')));
export const useReviews = () => useRead(async () => unwrap<Review[]>(await supabase.from('public_reviews').select('*').order('created_at', { ascending: false }).limit(12)));
export const useClients = (enabled: boolean) => useRead(async () => enabled ? unwrap<Client[]>(await supabase.from('clients').select('id,name,email,phone,address').order('name').limit(500)) : [], [enabled]);

const bookingCols = 'id,client_name,client_email,appointment_date,appointment_time,status,total_price,client_address,services(name)';
/** Admin: all bookings in range. Client: RLS limits rows to the signed-in email. */
export const useBookings = (enabled: boolean, from?: string, to?: string) => useRead(async () => {
  if (!enabled) return [] as Booking[];
  let q = supabase.from('bookings').select(bookingCols).order('appointment_date').order('appointment_time');
  if (from) q = q.gte('appointment_date', from);
  if (to) q = q.lte('appointment_date', to);
  return unwrap<Booking[]>(await q.limit(500) as never);
}, [enabled, from, to]);

export const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Opening slots (30 min) for the next `days` days, from calendar_settings + date_overrides. "00:00" end = midnight (24h). */
export function computeSlots(rules: Rule[], overrides: Override[], mode: 'domicile' | 'deplacement', start: Date, days: number) {
  const out: { date: string; times: string[] }[] = [];
  const fits = (m: string) => m === 'both' || m === mode;
  for (let i = 0; i < days; i++) {
    const d = new Date(start); d.setDate(d.getDate() + i);
    const iso = isoDate(d);
    const ov = overrides.filter(o => o.date === iso && fits(o.mode));
    const ranges = ov.length ? ov.filter(o => o.is_available && o.start_time && o.end_time).map(o => [o.start_time!, o.end_time!])
      : rules.filter(r => r.day_of_week === d.getDay() && r.is_available && fits(r.mode)).map(r => [r.start_time, r.end_time]);
    const times = new Set<string>();
    for (const [s, e] of ranges) { const end = toMin(e) === 0 ? 1440 : toMin(e); for (let m = toMin(s); m + 30 <= end; m += 30) times.add(toTime(m)); }
    if (times.size) out.push({ date: iso, times: [...times].sort() });
  }
  return out;
}
export const useAvailability = (mode: 'domicile' | 'deplacement') => useRead(async () => {
  const today = new Date();
  const [rules, overrides] = await Promise.all([
    supabase.from('calendar_settings').select('day_of_week,start_time,end_time,is_available,mode').then(unwrap<Rule[]>),
    supabase.from('date_overrides').select('date,start_time,end_time,is_available,mode').gte('date', isoDate(today)).then(unwrap<Override[]>),
  ]);
  return computeSlots(rules, overrides, mode, today, 21);
}, [mode]);

export const fmtDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
export const fmtPrice = (n: number) => `${Number(n).toLocaleString('fr-FR')} €`;
export const statusLabel: Record<string, string> = { confirmed: 'Confirmé', pending: 'En attente', cancelled: 'Annulé', completed: 'Terminé' };

type SlotRequest = Omit<SlotRequestInput, 'request_id'> & { id: string; created_at: string };
// The staged table is intentionally not present in generated live schema types yet.
export const useSlotRequests = () => useRead(async () => unwrap<SlotRequest[]>(await (supabase as SupabaseClient).from('slot_requests').select('id,client_name,client_email,mode,requested_date,requested_time,message,created_at').order('created_at', { ascending: false }).limit(500)));
export async function submitSlotRequest(input: SlotRequestInput): Promise<{ email_sent: boolean }> {
  const { data, error } = await supabase.functions.invoke('create-slot-request', { body: input });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const details = await error.context.json().catch(() => null);
      throw new Error(details?.error ?? 'Demande non envoyée. Réessayez.');
    }
    throw new Error(error.message);
  }
  if (!data?.id) throw new Error('La demande n’a pas été enregistrée.');
  return { email_sent: data.email_sent === true };
}
