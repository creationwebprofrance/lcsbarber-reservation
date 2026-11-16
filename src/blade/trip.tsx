// « Trajet estimé » : le barber appuie sur « Je pars », l'itinéraire est calculé une fois,
// puis le client voit une animation estimée (jamais présentée comme une position GPS réelle).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { SupabaseClient } from '@supabase/supabase-js';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Car, CheckCircle2, Clock, Copy, Info, MapPin, Navigation, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { BladeButton, EmptyState, Section } from './common';
import { Status } from './provider';
import type { ProviderBundle } from './data';
import { PlanGate } from './plan';
import { cumulative, estimatedProgress, etaMs, minutesLeft, pointAt, type LngLat, type TripStatus } from './trip-model';

export type PublicTrip = {
  status: TripStatus; started_at: string; duration_s: number; distance_m: number; delay_min: number; arrived_at: string | null;
  route: LngLat[]; dest: LngLat; provider_name: string | null; appointment_date: string; appointment_time: string; server_now: string;
};
const db = supabase as unknown as SupabaseClient;
const hm = (ms: number) => new Date(ms).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });

async function tripAction(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('blade-trip', { body: { ...body, site: window.location.origin } });
  if (error) {
    let message = 'Le service de trajet ne répond pas. Réessaie dans un instant.';
    try { const d = await (error as { context?: Response }).context?.json(); if (d?.error) message = d.error; } catch { /* réponse non JSON */ }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
// Démo (/blade/trajet/demo) : trajet fictif Bastille → République, pour présenter la fonction.
const DEMO_ROUTE: LngLat[] = [[2.3692, 48.8532], [2.3699, 48.8556], [2.3703, 48.8581], [2.3709, 48.8606], [2.3712, 48.8627], [2.3694, 48.8650], [2.3668, 48.8664], [2.3637, 48.8675]];
let demoStart = 0;
function demoTrip(): PublicTrip {
  if (!demoStart) demoStart = Date.now() - 4 * 60000;
  return { status: 'en_route', started_at: new Date(demoStart).toISOString(), duration_s: 12 * 60, distance_m: 1700, delay_min: 0, arrived_at: null,
    route: DEMO_ROUTE, dest: [2.3637, 48.8675], provider_name: 'Ton barber (démo)', appointment_date: '', appointment_time: '', server_now: new Date().toISOString() };
}

async function publicTrip(token: string): Promise<PublicTrip | null> {
  if (token === 'demo') return demoTrip();
  const { data, error } = await db.rpc('blade_trip_public', { p_token: token });
  if (error) throw error;
  return (data as PublicTrip | null) ?? null;
}
export async function myTrips(): Promise<{ booking_id: string; token: string; status: TripStatus }[]> {
  const { data, error } = await db.rpc('blade_my_trips');
  if (error) throw error;
  return (data as { booking_id: string; token: string; status: TripStatus }[] | null) ?? [];
}

function useInterval(fn: () => void, ms: number) {
  const ref = useRef(fn); ref.current = fn;
  useEffect(() => { const id = window.setInterval(() => ref.current(), ms); return () => window.clearInterval(id); }, [ms]);
}

/* ---------------- Carte animée ---------------- */
function TripMap({ trip, clockOffset }: { trip: PublicTrip; clockOffset: number }) {
  const box = useRef<HTMLDivElement>(null);
  const parts = useRef<{ map: L.Map; done: L.Polyline; car: L.Marker } | null>(null);
  const route = trip.route; const cum = useMemo(() => cumulative(route), [route]);
  const latlngs = useMemo(() => route.map(([lng, lat]) => [lat, lng] as L.LatLngTuple), [route]);

  useEffect(() => {
    if (!box.current || !route.length) return;
    const map = L.map(box.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
    L.polyline(latlngs, { color: '#8a6a55', weight: 5, opacity: .85, dashArray: '2 9', lineCap: 'round' }).addTo(map);
    const done = L.polyline([], { color: '#4a2f22', weight: 6 }).addTo(map);
    L.marker([trip.dest[1], trip.dest[0]], { icon: L.divIcon({ className: 'blade-trip-pin', html: '<span>🏠</span>', iconSize: [34, 34], iconAnchor: [17, 30] }), keyboard: false }).addTo(map);
    const car = L.marker(latlngs[0], { icon: L.divIcon({ className: 'blade-trip-car', html: '<span>✂️</span>', iconSize: [40, 40], iconAnchor: [20, 20] }), keyboard: false }).addTo(map);
    map.fitBounds(L.latLngBounds(latlngs).extend([trip.dest[1], trip.dest[0]]), { padding: [36, 36] });
    parts.current = { map, done, car };
    return () => { map.remove(); parts.current = null; };
  }, [latlngs, route.length, trip.dest]);

  // Animation fluide : on recalcule la position estimée à chaque image.
  useEffect(() => {
    let frame = 0;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let last = 0;
    const tick = (t: number) => {
      frame = requestAnimationFrame(tick);
      if (reduce && t - last < 5000) return; last = t;
      const p = parts.current; if (!p || !route.length) return;
      const f = estimatedProgress(trip, Date.now() + clockOffset);
      const { point, index } = pointAt(route, f, cum);
      const here: L.LatLngTuple = [point[1], point[0]];
      p.car.setLatLng(here);
      p.done.setLatLngs([...latlngs.slice(0, index + 1), here]);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [trip, clockOffset, route, cum, latlngs]);

  return <div ref={box} className="blade-trip-map" role="img" aria-label="Carte du trajet estimé de ton barber" />;
}

/* ---------------- Page client publique : /blade/trajet/:token ---------------- */
export function TripPage() {
  const { token = '' } = useParams();
  const [trip, setTrip] = useState<PublicTrip | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'error'>('loading');
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(Date.now());
  const load = async () => {
    try {
      const t = await publicTrip(token);
      if (!t) { setState('missing'); return; }
      setOffset(Date.parse(t.server_now) - Date.now()); setTrip(t); setState('ok');
    } catch { setState(s => (s === 'ok' ? 'ok' : 'error')); }
  };
  useEffect(() => { void load(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  useInterval(() => { if (trip?.status === 'en_route') void load(); }, 20000);
  useInterval(() => setNow(Date.now()), 15000);

  const t = now + offset;
  const name = trip?.provider_name || 'Ton barber';
  return <div className="blade-app blade-trip-page"><main className="blade-main">
    <p className="blade-eyebrow"><Link to="/blade">BLADE</Link> <span>/</span> Trajet</p>
    {state === 'loading' && <p role="status">Chargement du trajet…</p>}
    {state === 'missing' && <EmptyState icon="pin" title="Trajet introuvable" description="Ce lien n’est plus valable. Le trajet apparaîtra ici dès que ton barber sera parti." />}
    {state === 'error' && <EmptyState icon="pin" title="Trajet indisponible" description="Impossible de charger le trajet pour le moment. Réessaie dans un instant." action={<BladeButton onClick={() => { setState('loading'); void load(); }}>Réessayer</BladeButton>} />}
    {state === 'ok' && trip && <>
      {token === 'demo' && <p className="blade-trip-demo" role="note">Démonstration : trajet fictif pour montrer ce que voit le client.</p>}
      <header className="blade-trip-head">
        <div>
          <h1>{trip.status === 'arrived' ? `${name} est arrivé` : trip.status === 'cancelled' ? 'Trajet annulé' : `${name} est en route`}</h1>
          {trip.status === 'en_route' && <p className="blade-trip-eta"><Clock size={18} aria-hidden="true" />Arrivée estimée vers <strong>{hm(etaMs(trip))}</strong>{minutesLeft(trip, t) > 0 ? ` · environ ${minutesLeft(trip, t)} min` : ' · arrivée imminente'}</p>}
          {trip.status === 'arrived' && trip.arrived_at && <p className="blade-trip-eta"><CheckCircle2 size={18} aria-hidden="true" />Arrivé à {hm(Date.parse(trip.arrived_at))}</p>}
          {trip.delay_min > 0 && trip.status === 'en_route' && <p className="blade-trip-delay">Retard signalé par ton barber : {trip.delay_min} min</p>}
        </div>
        <span className="blade-trip-tag"><Navigation size={14} aria-hidden="true" />Position estimée</span>
      </header>
      {trip.status !== 'cancelled' && <TripMap trip={trip} clockOffset={offset} />}
      {trip.status === 'en_route' && <div className="blade-trip-progress" role="progressbar" aria-label="Avancement estimé du trajet" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(estimatedProgress(trip, t) * 100)}><span style={{ width: `${Math.round(estimatedProgress(trip, t) * 100)}%` }} /></div>}
      <p className="blade-trip-note"><Info size={16} aria-hidden="true" />Position estimée à partir de l’itinéraire et du trafic au moment du départ ({(trip.distance_m / 1000).toFixed(1).replace('.', ',')} km). Elle n’est pas transmise en direct par GPS : ton barber met à jour son retard et confirme son arrivée.</p>
    </>}
  </main></div>;
}

/* ---------------- Côté barber : rendez-vous à domicile du jour ---------------- */
type TripState = { token: string; status: TripStatus; eta?: string };
function currentPosition(): Promise<{ lng: number; lat: number }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) { reject(new Error('Ce téléphone ne permet pas la localisation.')); return; }
    navigator.geolocation.getCurrentPosition(p => resolve({ lng: p.coords.longitude, lat: p.coords.latitude }),
      e => reject(new Error(e.code === 1 ? 'Autorise la localisation pour calculer ton trajet (une seule fois, au départ).' : 'Position introuvable. Réessaie à l’extérieur.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  });
}

function TripRow({ booking, initial }: { booking: ProviderBundle['bookings'][number]; initial: TripState | null }) {
  const [trip, setTrip] = useState<TripState | null>(initial);
  useEffect(() => { if (initial) setTrip(initial); }, [initial]);
  const [busy, setBusy] = useState(''); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const run = async (key: string, fn: () => Promise<void>) => { setBusy(key); setError(''); setMessage(''); try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); } finally { setBusy(''); } };
  const link = trip ? `${window.location.origin}/blade/trajet/${trip.token}` : '';
  return <li className="blade-trip-row">
    <div className="blade-trip-row-head"><strong>{booking.appointment_time.slice(0, 5)} · {booking.client_name}</strong><span><MapPin size={14} aria-hidden="true" />{booking.client_address}</span></div>
    <div className="blade-inline">
      {(!trip || trip.status === 'cancelled') && <BladeButton variant="default" disabled={!!busy} onClick={() => run('start', async () => {
        const origin = await currentPosition();
        const r = await tripAction({ action: 'start', booking_id: booking.id, origin });
        setTrip({ token: r.token, status: 'en_route', eta: r.eta });
        setMessage(`C’est parti : ${booking.client_name} a reçu le lien du trajet. Arrivée estimée vers ${hm(Date.parse(r.eta))}.`);
      })}><Car size={16} aria-hidden="true" />{busy === 'start' ? 'Calcul du trajet…' : 'Je pars'}</BladeButton>}
      {trip?.status === 'en_route' && <>
        <BladeButton disabled={!!busy} onClick={() => run('delay', async () => { await tripAction({ action: 'delay', booking_id: booking.id, minutes: 10 }); setMessage('Retard de 10 min signalé au client.'); })}><Plus size={16} aria-hidden="true" />10 min de retard</BladeButton>
        <BladeButton variant="default" disabled={!!busy} onClick={() => run('arrived', async () => { await tripAction({ action: 'arrived', booking_id: booking.id }); setTrip({ ...trip, status: 'arrived' }); setMessage('Arrivée confirmée au client.'); })}><CheckCircle2 size={16} aria-hidden="true" />Je suis arrivé</BladeButton>
      </>}
      {trip && trip.status !== 'cancelled' && <BladeButton onClick={async () => { try { await navigator.clipboard.writeText(link); setMessage('Lien du trajet copié.'); } catch { setMessage(link); } }}><Copy size={16} aria-hidden="true" />Copier le lien client</BladeButton>}
    </div>
    <Status error={error} message={message} />
  </li>;
}

export function ProTrips({ data }: { data: ProviderBundle }) {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
  const list = data.bookings.filter(b => b.appointment_date === today && b.client_address && !/annul|cancel/i.test(b.status))
    .sort((a, b) => a.appointment_time.localeCompare(b.appointment_time));
  // Trajets déjà lancés aujourd’hui (le barber peut recharger la page sans perdre son trajet).
  const ids = list.map(b => b.id).join(',');
  const [existing, setExisting] = useState<Record<string, TripState>>({});
  useEffect(() => {
    if (!ids) return;
    db.from('blade_trips').select('booking_id,token,status').in('booking_id', ids.split(','))
      .then(({ data }) => setExisting(Object.fromEntries((data ?? []).map((t: { booking_id: string; token: string; status: TripStatus }) => [t.booking_id, { token: t.token, status: t.status }]))));
  }, [ids]);
  return <Section title="Trajets à domicile du jour">
    <PlanGate need="premium" feature="Le trajet estimé">
      {list.length ? <ul className="blade-trip-list">{list.map(b => <TripRow key={b.id} booking={b} initial={existing[b.id] ?? null} />)}</ul>
        : <p className="blade-note">Aucun rendez-vous à domicile aujourd’hui. Quand tu en auras un, appuie sur « Je pars » : ton client recevra un lien pour suivre ton trajet estimé.</p>}
    </PlanGate>
  </Section>;
}

/* ---------------- Côté client : lien vers le trajet dans « Mes rendez-vous » ---------------- */
export function MyTripLinks() {
  const [trips, setTrips] = useState<{ booking_id: string; token: string; status: TripStatus }[]>([]);
  useEffect(() => { myTrips().then(setTrips).catch(() => setTrips([])); }, []);
  const live = trips.filter(t => t.status !== 'cancelled');
  if (!live.length) return null;
  return <div className="blade-trip-banner" role="status">
    <Car size={20} aria-hidden="true" />
    <span>{live.some(t => t.status === 'en_route') ? 'Ton barber est en route.' : 'Ton barber est arrivé.'}</span>
    <BladeButton asChild variant="default"><Link to={`/blade/trajet/${live[0].token}`}>Suivre le trajet</Link></BladeButton>
  </div>;
}
