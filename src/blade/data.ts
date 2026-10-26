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

export type ProviderService = Service & { is_active: boolean };
export type ProviderClient = Client & { is_blacklisted: boolean; unpaid_amount: number };
export type ProviderBooking = Booking & { client_id: string | null; city_normalized: string | null; client_phone: string; notes: string | null };
export type ProviderWork = { id: string; name: string; client_name: string | null; client_id: string | null; booking_id: string | null; amount: number; prestation_date: string; notes: string | null };
export type ProviderTemplate = { id: string; template_type: string; subject: string; html_content: string };
export type ProviderBundle = { provider_id: string; services: ProviderService[]; pricing: { id:string; setting_key:string; setting_value:number }[]; clients: ProviderClient[]; bookings: ProviderBooking[]; work: ProviderWork[]; templates: ProviderTemplate[]; merges: { merged_email:string; target_email:string; original_client_name:string }[] };
export function useProviderData(refresh = 0) {
  const { session, isAdmin, ready } = useSession();
  const state = useRead(async () => {
    if (!ready || !session || !isAdmin) return null;
    const { data, error } = await (supabase as SupabaseClient).rpc('blade_provider_bundle');
    if (error) throw new Error('Le rattachement de vos données n’est pas encore disponible. Il nécessite l’acceptation du brouillon et la vérification des anciennes lignes.');
    return data as ProviderBundle;
  }, [session?.user.id, isAdmin, ready, refresh]);
  return { ...state, ready, signedIn: Boolean(session), isAdmin };
}
export async function saveProviderRecord(providerId: string, entity: string, id: string | null, values: Record<string, unknown>) {
  const { error } = await (supabase as SupabaseClient).rpc('blade_save_record', { p_provider: providerId, p_entity: entity, p_id: id, p_values: values });
  if (error) throw new Error(error.message);
}
export function useProviderVehicle(refresh = 0) {
  const { session, isAdmin } = useSession();
  return useRead(async () => {
    if (!session || !isAdmin) return null;
    const vehicles = unwrap<import('@/lib/vehicle').Vehicle[]>(await supabase.from('vehicles').select('*').eq('owner_id', session.user.id).order('is_default', { ascending:false }));
    const ids = vehicles.map(v => v.id);
    if (!ids.length) return { vehicles, readings:[], rules:[], events:[] };
    const [readings,rules,events] = await Promise.all([
      supabase.from('odometer_readings').select('*').in('vehicle_id',ids).order('reading_date',{ascending:false}).then(unwrap<import('@/lib/vehicle').OdometerReading[]>),
      supabase.from('vehicle_maintenance_rules').select('*').in('vehicle_id',ids).eq('is_active',true).then(unwrap<import('@/lib/vehicle').MaintenanceRule[]>),
      supabase.from('vehicle_maintenance_events').select('*').in('vehicle_id',ids).order('event_date',{ascending:false}).then(unwrap<import('@/lib/vehicle').MaintenanceEvent[]>),
    ]);
    return { vehicles,readings,rules,events };
  }, [session?.user.id,isAdmin,refresh]);
}
export async function saveVehicleReading(vehicleId:string,value:number,unit:string,date:string) {
  if (!Number.isFinite(value) || value < 0) throw new Error('Kilométrage invalide.');
  const { error } = await supabase.from('odometer_readings').insert({vehicle_id:vehicleId,value,unit,reading_date:date,source:'manual',confirmed:true});
  if (error) throw new Error(error.message);
}
export async function saveVehicleMaintenance(values: import('@/integrations/supabase/types').TablesInsert<'vehicle_maintenance_events'>) {
  const {error} = await supabase.from('vehicle_maintenance_events').insert(values); if(error)throw new Error(error.message);
}
export async function sendProviderEmail(providerId:string,templateId:string,clientId:string,bookingId:string|null) {
  const {data,error}=await supabase.functions.invoke('blade-send-template',{body:{provider_id:providerId,template_id:templateId,client_id:clientId,booking_id:bookingId}});
  if(error)throw new Error('Envoi indisponible ou refusé. Aucun envoi confirmé.');
  if(!data?.sent)throw new Error('Envoi non confirmé.');
}
export async function geocodeProviderCity(city:string):Promise<{lat:number;lng:number}|null> {
  const {data,error}=await supabase.functions.invoke('geocode-city',{body:{city}});
  return !error&&Number.isFinite(data?.lat)&&Number.isFinite(data?.lng)?{lat:data.lat,lng:data.lng}:null;
}

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const apply = async (s: Session | null) => {
      // Resolve the role before exposing the session so space guards never see a mismatched state.
      let admin = false;
      if (s) { const { data } = await supabase.from('user_roles').select('role').eq('user_id', s.user.id).eq('role', 'admin'); admin = !!data?.length; }
      setSession(s); setIsAdmin(admin);
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
export const useReviews = () => useRead(async () => {
  try { return unwrap<Review[]>(await (supabase as SupabaseClient).rpc('get_public_reviews')); }
  catch { /* Public read is staged only. Admins can still read the base table directly. */ }
  return unwrap<Review[]>(await supabase.from('reviews').select('id,client_name,rating,comment,created_at').order('created_at', { ascending: false }).limit(50));
});
export const useClients = (enabled: boolean) => useRead(async () => enabled ? unwrap<Client[]>(await supabase.from('clients').select('id,name,email,phone,address').order('name').limit(500)) : [], [enabled]);

const bookingCols = 'id,client_name,client_email,appointment_date,appointment_time,status,total_price,client_address,services(name)';
/** Admin: all bookings in range. Client: RLS limits rows to the signed-in email. */
export const useBookings = (enabled: boolean, from?: string, to?: string, refresh = 0) => useRead(async () => {
  if (!enabled) return [] as Booking[];
  let q = supabase.from('bookings').select(bookingCols).order('appointment_date').order('appointment_time');
  if (from) q = q.gte('appointment_date', from);
  if (to) q = q.lte('appointment_date', to);
  return unwrap<Booking[]>(await q.limit(500) as never);
}, [enabled, from, to, refresh]);

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

export type PricingRules = { travel_free_minutes: number; travel_interval_minutes: number; travel_fee_per_interval: number; early_hour_threshold: number; early_hour_fee: number; late_hour_threshold: number; late_hour_fee: number; same_day_fee: number; sunday_fee: number };
const defaultPricing: PricingRules = { travel_free_minutes: 20, travel_interval_minutes: 20, travel_fee_per_interval: 10, early_hour_threshold: 10, early_hour_fee: 5, late_hour_threshold: 20, late_hour_fee: 5, same_day_fee: 5, sunday_fee: 10 };
export const usePricingRules = () => useRead(async () => {
  const rows = unwrap<{ setting_key: string; setting_value: number }[]>(await supabase.from('pricing_settings').select('setting_key,setting_value'));
  const rules: Record<string, number> = { ...defaultPricing };
  for (const r of rows) if (r.setting_key in rules) rules[r.setting_key] = Number(r.setting_value);
  return rules as unknown as PricingRules;
});

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
