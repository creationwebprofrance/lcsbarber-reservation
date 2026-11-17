// « Trajet estimé » : le barber appuie sur « Je pars », l'itinéraire est calculé une fois,
// puis le client voit une animation estimée (jamais présentée comme une position GPS réelle).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { SupabaseClient } from '@supabase/supabase-js';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Car, CheckCircle2, Clock, Copy, Crosshair, Info, MapPin, Maximize2, Navigation, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { BladeButton, EmptyState, Section } from './common';
import { Status } from './provider';
import type { ProviderBundle } from './data';
import { PlanGate } from './plan';
import { bearing, cumulative, haversine, estimatedProgress, etaMs, minutesLeft, pointAt, pointAtTime, type LngLat, type TripStatus } from './trip-model';
import { MAPBOX_PUBLIC_TOKEN as MAPBOX_TOKEN } from '@/lib/mapbox';
import { DEMO_DISTANCE_M, DEMO_DURATION_S, DEMO_ROUTE, DEMO_TIMES } from './demo-route';

export type PublicTrip = {
  status: TripStatus; started_at: string; duration_s: number; distance_m: number; delay_min: number; arrived_at: string | null;
  route: LngLat[]; dest: LngLat; provider_name: string | null; appointment_date: string; appointment_time: string; server_now: string;
};
const db = supabase as unknown as SupabaseClient;
const hm = (ms: number) => new Date(ms).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
const km = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : `${Math.max(0, Math.round(m / 50) * 50)} m`);

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
async function publicTrip(token: string): Promise<PublicTrip | null> {
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

/* ---------------- État du trajet à un instant donné ---------------- */
type Live = { status: TripStatus; fraction: number; point: LngLat; index: number; heading: number; eta: number; startedAt: number; minutes: number; remainingM: number; arrivedAt: number | null };

function liveFromTrip(trip: PublicTrip, cum: number[], now: number): Live {
  const fraction = estimatedProgress(trip, now);
  const { point, index } = pointAt(trip.route, fraction, cum);
  const next = trip.route[Math.min(index + 1, trip.route.length - 1)];
  return { status: trip.status, fraction, point, index, heading: bearing(trip.route[index], next), eta: etaMs(trip), startedAt: Date.parse(trip.started_at),
    minutes: minutesLeft(trip, now), remainingM: (1 - fraction) * trip.distance_m, arrivedAt: trip.arrived_at ? Date.parse(trip.arrived_at) : null };
}

// Démo : vrai itinéraire routier parisien, vitesse variable selon chaque tronçon, en boucle.
const DEMO_START_AT = DEMO_DURATION_S * 0.18; // on arrive alors que le barber est parti depuis ~2-3 min
const DEMO_PAUSE_S = 25;                     // le barber reste « arrivé » avant de recommencer
const DEMO_CUM = cumulative(DEMO_ROUTE);
const DEMO_TOTAL_M = DEMO_CUM[DEMO_CUM.length - 1];
function demoTrip(): PublicTrip {
  return { status: 'en_route', started_at: new Date().toISOString(), duration_s: DEMO_DURATION_S, distance_m: DEMO_DISTANCE_M, delay_min: 0, arrived_at: null,
    route: DEMO_ROUTE, dest: DEMO_ROUTE[DEMO_ROUTE.length - 1], provider_name: 'Ton barber', appointment_date: '', appointment_time: '', server_now: new Date().toISOString() };
}
function liveFromDemo(t0: number, speed: number, now: number): Live {
  const cycle = DEMO_DURATION_S + DEMO_PAUSE_S;
  const elapsed = (DEMO_START_AT + ((now - t0) / 1000) * speed) % cycle;
  const startedAt = t0 - (DEMO_START_AT * 1000) / speed;
  const arrived = elapsed >= DEMO_DURATION_S;
  const s = Math.min(elapsed, DEMO_DURATION_S);
  const { point, index, heading } = pointAtTime(DEMO_ROUTE, DEMO_TIMES, s);
  const done = DEMO_CUM[index] + haversine(DEMO_ROUTE[index], point);
  const fraction = arrived ? 1 : Math.min(1, done / DEMO_TOTAL_M);
  return { status: arrived ? 'arrived' : 'en_route', fraction, point, index, heading, eta: t0 + ((DEMO_DURATION_S - DEMO_START_AT) * 1000),
    startedAt, minutes: arrived ? 0 : Math.max(1, Math.ceil((DEMO_DURATION_S - s) / 60)), remainingM: Math.max(0, DEMO_TOTAL_M - done), arrivedAt: arrived ? now : null };
}

/* ---------------- Carte animée ---------------- */
const CAR_SVG = '<svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true"><ellipse cx="20" cy="21" rx="11" ry="16" fill="rgba(0,0,0,.18)"/><rect x="10" y="4" width="20" height="32" rx="8" fill="#4a2f22" stroke="#fff" stroke-width="2.5"/><rect x="13" y="10" width="14" height="7" rx="2.5" fill="#f2d6bb"/><rect x="13" y="25" width="14" height="5" rx="2" fill="#c9a68a"/><circle cx="14" cy="6.5" r="1.6" fill="#ffe9a8"/><circle cx="26" cy="6.5" r="1.6" fill="#ffe9a8"/></svg>';
const PIN_SVG = '<svg viewBox="0 0 36 46" width="36" height="46" aria-hidden="true"><path d="M18 45s15-15.6 15-27A15 15 0 0 0 3 18c0 11.4 15 27 15 27z" fill="#4a2f22" stroke="#fff" stroke-width="2.5"/><path d="M11 20.5 18 14l7 6.5V27h-4.5v-4.5h-5V27H11z" fill="#fff"/></svg>';

// Fond de carte style « navigation » (Mapbox, clé publique déjà utilisée par le site), OpenStreetMap en secours.
function baseLayer(): L.TileLayer {
  const dark = document.documentElement.dataset.bladeTheme === 'dark';
  const style = dark ? 'navigation-night-v1' : 'navigation-day-v1';
  const layer = L.tileLayer(`https://api.mapbox.com/styles/v1/mapbox/${style}/tiles/512/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`, {
    tileSize: 512, zoomOffset: -1, maxZoom: 20,
    attribution: '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  });
  let failed = 0;
  layer.on('tileerror', () => {
    if (++failed !== 3) return;
    const map = (layer as unknown as { _map?: L.Map })._map; if (!map) return;
    map.removeLayer(layer);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map).bringToBack();
  });
  return layer;
}

function TripMap({ route, dest, getLive }: { route: LngLat[]; dest: LngLat; getLive: (now: number) => Live }) {
  const box = useRef<HTMLDivElement>(null);
  const parts = useRef<{ map: L.Map; ahead: L.Polyline; behind: L.Polyline; car: L.Marker } | null>(null);
  const [follow, setFollow] = useState(true);
  const followRef = useRef(follow); followRef.current = follow;
  const latlngs = useMemo(() => route.map(([lng, lat]) => [lat, lng] as L.LatLngTuple), [route]);

  const showAll = useCallback(() => { const p = parts.current; if (!p) return; setFollow(false); p.map.fitBounds(L.latLngBounds(latlngs).extend([dest[1], dest[0]]), { padding: [48, 48] }); }, [latlngs, dest]);

  useEffect(() => {
    if (!box.current || !route.length) return;
    const map = L.map(box.current, { zoomControl: false, attributionControl: true, scrollWheelZoom: false });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    baseLayer().addTo(map);
    L.polyline(latlngs, { color: '#ffffff', weight: 11, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }).addTo(map);
    const behind = L.polyline([], { color: '#b8aca3', weight: 6, lineCap: 'round', lineJoin: 'round' }).addTo(map);
    const ahead = L.polyline(latlngs, { color: '#4a2f22', weight: 6, lineCap: 'round', lineJoin: 'round' }).addTo(map);
    L.marker([dest[1], dest[0]], { icon: L.divIcon({ className: 'blade-trip-dest', html: `${PIN_SVG}<span>Ton adresse</span>`, iconSize: [36, 46], iconAnchor: [18, 44] }), keyboard: false }).addTo(map);
    const car = L.marker(latlngs[0], { icon: L.divIcon({ className: 'blade-trip-vehicle', html: `<span class="blade-trip-halo"></span><span class="blade-trip-body">${CAR_SVG}</span>`, iconSize: [40, 40], iconAnchor: [20, 20] }), keyboard: false, zIndexOffset: 1000 }).addTo(map);
    map.fitBounds(L.latLngBounds(latlngs).extend([dest[1], dest[0]]), { padding: [48, 48] });
    map.on('dragstart', () => setFollow(false));
    parts.current = { map, ahead, behind, car };
    return () => { map.remove(); parts.current = null; };
  }, [latlngs, route.length, dest]);

  // Animation : position recalculée à chaque image, la carte suit doucement le véhicule.
  useEffect(() => {
    let frame = 0; let lastPan = 0; let zoomed = false;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let last = 0;
    const tick = (t: number) => {
      frame = requestAnimationFrame(tick);
      if (reduce && t - last < 1000) return; last = t;
      const p = parts.current; if (!p) return;
      const live = getLive(Date.now());
      const here: L.LatLngTuple = [live.point[1], live.point[0]];
      p.car.setLatLng(here);
      const body = (p.car.getElement()?.querySelector('.blade-trip-body') as HTMLElement | null);
      if (body) body.style.transform = `rotate(${live.heading}deg)`;
      p.behind.setLatLngs([...latlngs.slice(0, live.index + 1), here]);
      p.ahead.setLatLngs([here, ...latlngs.slice(live.index + 1)]);
      p.car.getElement()?.classList.toggle('is-arrived', live.status === 'arrived');
      if (followRef.current && t - lastPan > 900) {
        lastPan = t;
        if (!zoomed) { zoomed = true; p.map.setView(here, 16, { animate: true }); }
        else p.map.panTo(here, { animate: true, duration: 0.9, easeLinearity: 0.5 });
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [getLive, latlngs]);

  return <div className="blade-trip-mapwrap">
    <div ref={box} className="blade-trip-map" role="img" aria-label="Carte du trajet estimé de ton barber" />
    <div className="blade-trip-mapbtns">
      {follow ? <button type="button" onClick={showAll}><Maximize2 size={16} aria-hidden="true" />Tout le trajet</button>
        : <button type="button" onClick={() => setFollow(true)}><Crosshair size={16} aria-hidden="true" />Suivre</button>}
    </div>
  </div>;
}

/* ---------------- Étapes du trajet ---------------- */
function TripSteps({ live }: { live: Live }) {
  const step = live.status === 'arrived' ? 3 : live.minutes <= 2 ? 2 : 1;
  const items = [`Parti à ${hm(live.startedAt)}`, 'En route', 'Arrivée imminente', 'Arrivé'];
  return <ol className="blade-trip-steps" aria-label="Étapes du trajet">
    {items.map((label, i) => <li key={label} className={i < step ? 'is-done' : i === step ? 'is-now' : ''}><span aria-hidden="true" />{label}</li>)}
  </ol>;
}

/* ---------------- Page client publique : /blade/trajet/:token ---------------- */
export function TripPage() {
  const { token = '' } = useParams();
  const demo = token === 'demo';
  const [trip, setTrip] = useState<PublicTrip | null>(demo ? demoTrip() : null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'error'>(demo ? 'ok' : 'loading');
  const [offset, setOffset] = useState(0);
  const [speed, setSpeed] = useState(8);
  const [, setTick] = useState(0);
  const t0 = useRef(Date.now());
  const cum = useMemo(() => (trip ? cumulative(trip.route) : [0]), [trip]);

  const load = async () => {
    if (demo) return;
    try {
      const t = await publicTrip(token);
      if (!t) { setState('missing'); return; }
      setOffset(Date.parse(t.server_now) - Date.now()); setTrip(t); setState('ok');
    } catch { setState(s => (s === 'ok' ? 'ok' : 'error')); }
  };
  useEffect(() => { void load(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  useInterval(() => { if (!demo && trip?.status === 'en_route') void load(); }, 20000);
  useInterval(() => setTick(n => n + 1), 1000);

  const changeSpeed = (s: number) => {
    // garde la même position en changeant de vitesse
    const now = Date.now(); const elapsed = ((now - t0.current) / 1000) * speed;
    t0.current = now - (elapsed * 1000) / s; setSpeed(s);
  };
  const getLive = useCallback((now: number): Live => (demo ? liveFromDemo(t0.current, speed, now) : liveFromTrip(trip!, cum, now + offset)), [demo, speed, trip, cum, offset]);

  const name = trip?.provider_name || 'Ton barber';
  const live = trip ? getLive(Date.now()) : null;
  return <div className="blade-app blade-trip-page"><main className="blade-main">
    <p className="blade-eyebrow"><Link to="/blade">BLADE</Link> <span>/</span> Trajet</p>
    {state === 'loading' && <p role="status">Chargement du trajet…</p>}
    {state === 'missing' && <EmptyState icon="pin" title="Trajet introuvable" description="Ce lien n’est plus valable. Le trajet apparaîtra ici dès que ton barber sera parti." />}
    {state === 'error' && <EmptyState icon="pin" title="Trajet indisponible" description="Impossible de charger le trajet pour le moment. Réessaie dans un instant." action={<BladeButton onClick={() => { setState('loading'); void load(); }}>Réessayer</BladeButton>} />}
    {state === 'ok' && trip && live && <>
      {demo && <div className="blade-trip-demo" role="note">
        <span>Démo : vrai itinéraire dans Paris (gare de l’Est → Paris 11ᵉ), barber fictif.</span>
        <span className="blade-trip-speed" role="group" aria-label="Vitesse de la démo">
          <button type="button" aria-pressed={speed !== 1} onClick={() => changeSpeed(8)}>Accélérée ×8</button>
          <button type="button" aria-pressed={speed === 1} onClick={() => changeSpeed(1)}>Vitesse réelle</button>
        </span>
      </div>}
      <header className="blade-trip-head">
        <div>
          <h1>{live.status === 'arrived' ? `${name} est arrivé` : trip.status === 'cancelled' ? 'Trajet annulé' : `${name} est en route`}</h1>
          {live.status === 'en_route' && <p className="blade-trip-eta"><Clock size={18} aria-hidden="true" />Arrivée vers <strong>{hm(live.eta)}</strong> · {live.minutes > 0 ? `${live.minutes} min` : 'imminente'} · encore {km(live.remainingM)}</p>}
          {live.status === 'arrived' && <p className="blade-trip-eta"><CheckCircle2 size={18} aria-hidden="true" />Arrivé{live.arrivedAt ? ` à ${hm(live.arrivedAt)}` : ''} · il sonne bientôt à ta porte</p>}
          {trip.delay_min > 0 && live.status === 'en_route' && <p className="blade-trip-delay">Retard signalé par ton barber : {trip.delay_min} min</p>}
        </div>
        <span className="blade-trip-tag"><Navigation size={14} aria-hidden="true" />Position estimée</span>
      </header>
      {trip.status !== 'cancelled' && <>
        <TripMap route={trip.route} dest={trip.dest} getLive={getLive} />
        <div className="blade-trip-driver">
          <span className="blade-trip-avatar" aria-hidden="true">✂️</span>
          <div><strong>{name}</strong><small>En voiture · {km(trip.distance_m)} au départ</small></div>
          <div className="blade-trip-progress" role="progressbar" aria-label="Avancement estimé du trajet" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(live.fraction * 100)}><span style={{ width: `${Math.round(live.fraction * 100)}%` }} /></div>
        </div>
        <TripSteps live={live} />
      </>}
      <p className="blade-trip-note"><Info size={16} aria-hidden="true" />{demo
        ? 'Démo : le trajet suit de vraies rues avec des vitesses variables selon le trafic. Pour un vrai rendez-vous, la position est estimée à partir de l’itinéraire et du trafic au départ, puis mise à jour par ton barber (retard, arrivée).'
        : `Position estimée à partir de l’itinéraire et du trafic au moment du départ (${km(trip.distance_m)}). Elle n’est pas transmise en direct par GPS : ton barber met à jour son retard et confirme son arrivée.`}</p>
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
