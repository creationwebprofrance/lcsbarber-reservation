// Read-only views of the shared LCSBARBER data. No action here writes anything.
import { useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { LoaderCircle, Star } from 'lucide-react';
import { EmptyState, Icon, BladeButton, Tabs } from './common';
import { RequestSlot } from './requests';
import { canRequestSlot } from './request-model';
import { useServices, useReviews, useAvailability, useBookings, useClients, useSession, fmtDate, fmtPrice, statusLabel, isoDate, type Booking } from './data';

function Loading() { return <p className="blade-note" role="status"><LoaderCircle className="blade-spinner" size={16} /> Chargement…</p>; }
function Failed({ error }: { error: string }) { return <p className="blade-note blade-error" role="alert">Impossible de charger les données : {error}</p>; }
function Table({ columns, rows }: { columns: string[]; rows: (string | number)[][] }) {
  return <div className="blade-live-table" role="table"><div role="row" className="blade-live-row blade-live-head">{columns.map(c => <span role="columnheader" key={c}>{c}</span>)}</div>{rows.map((r, i) => <div role="row" className="blade-live-row" key={i}>{r.map((c, j) => <span role="cell" data-label={columns[j]} key={j}>{c}</span>)}</div>)}</div>;
}

export function LiveServices() {
  const { data, loading, error } = useServices();
  if (loading) return <Loading />; if (error) return <Failed error={error} />;
  if (!data?.length) return <EmptyState icon="scissors" title="Aucune prestation disponible" compact />;
  return <Table columns={['Prestation', 'Durée', 'Tarif']} rows={data.map(s => [s.name, `${s.duration_minutes} min`, fmtPrice(s.price)])} />;
}

export function LiveReviews() {
  const { data, loading, error } = useReviews();
  if (loading) return <Loading />; if (error) return <Failed error={error} />;
  if (!data?.length) return <EmptyState icon="message" title="Aucun avis" compact />;
  return <ul className="blade-live-reviews">{data.map(r => <li key={r.id}><div><strong>{r.client_name}</strong><span aria-label={`${r.rating} sur 5`}>{Array.from({ length: 5 }, (_, i) => <Star key={i} size={14} className={i < r.rating ? 'on' : ''} aria-hidden="true" />)}</span></div>{r.comment && <p>{r.comment}</p>}<small>{new Date(r.created_at).toLocaleDateString('fr-FR')}</small></li>)}</ul>;
}

const endOf = (t: string) => { const m = Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) + 30; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
export function LiveAvailability({ mode, limit = 7 }: { mode: 'domicile' | 'deplacement'; limit?: number }) {
  const { data, loading, error } = useAvailability(mode);
  if (loading) return <Loading />; if (error) return <Failed error={error} />;
  if (canRequestSlot(loading, error, data?.length ?? 0)) return <EmptyState title="Aucun créneau disponible pour le moment" action={<RequestSlot mode={mode}/>} compact />;
  return <ul className="blade-live-days">{data.slice(0, limit).map(d => <li key={d.date}><strong>{fmtDate(d.date)}</strong><span>{d.times[0]} – {endOf(d.times[d.times.length - 1])}</span><small>{d.times.length} créneaux</small></li>)}</ul>;
}

/** The single LCS Barber professional card shown on the search page. */
export function LiveProCard({ mode }: { mode: 'domicile' | 'deplacement' }) {
  const services = useServices();
  const min = services.data?.length ? Math.min(...services.data.map(s => Number(s.price))) : null;
  return <article className="blade-live-pro"><div className="blade-live-pro-head"><span className="blade-profile-placeholder"><Icon name="scissors" size={24} /></span><div><h3>LCS Barber</h3><RatingSummary /><p>{mode === 'deplacement' ? 'Se déplace chez vous · Puiseux-en-France et alentours' : 'Puiseux-en-France'}</p></div>{min !== null && <strong>dès {fmtPrice(min)}</strong>}</div><h4>Prochaines disponibilités</h4><LiveAvailability mode={mode} limit={3} /><BladeButton asChild variant="default"><Link to="/blade/client/profil-professionnel">Voir le profil</Link></BladeButton></article>;
}

function bookingRows(list: Booking[], admin: boolean) { return list.map(b => [fmtDate(b.appointment_date), b.appointment_time.slice(0, 5), admin ? b.client_name : 'LCS Barber', b.services?.name ?? '—', statusLabel[b.status] ?? b.status, fmtPrice(b.total_price)]); }

export function LiveMyBookings() {
  const { session, ready } = useSession(); const [tab, setTab] = useState('À venir'); const today = isoDate(new Date());
  const { data, loading, error } = useBookings(!!session);
  if (!ready) return <Loading />;
  if (!session) return <EmptyState icon="user" title="Connectez-vous pour voir vos rendez-vous" action={<BladeButton asChild variant="default"><Link to="/blade/connexion?espace=client">Se connecter</Link></BladeButton>} />;
  const list = (data ?? []).filter(b => tab === 'À venir' ? b.appointment_date >= today : b.appointment_date < today);
  return <><Tabs options={['À venir', 'Passés']} value={tab} onChange={setTab} />{loading ? <Loading /> : error ? <Failed error={error} /> : list.length ? <Table columns={['Date', 'Heure', 'Professionnel', 'Prestation', 'Statut', 'Total']} rows={bookingRows(tab === 'Passés' ? [...list].reverse() : list, false)} /> : <EmptyState title={tab === 'À venir' ? 'Aucun rendez-vous à venir' : 'Aucun rendez-vous passé'} compact />}</>;
}

function AdminGate({ children }: { children: (ok: boolean) => JSX.Element }) {
  const { session, isAdmin, ready } = useSession();
  if (!ready) return <Loading />;
  if (!session) return <EmptyState icon="user" title="Connexion professionnelle requise" action={<BladeButton asChild variant="default"><Link to="/blade/connexion?espace=pro">Se connecter</Link></BladeButton>} compact />;
  if (!isAdmin) return <EmptyState icon="user" title="Accès réservé au professionnel" description="Ce compte n’a pas l’accès administrateur LCS Barber." compact />;
  return children(true);
}

function AdminBookingsInner({ from, to, title }: { from: string; to?: string; title: string }) {
  const { data, loading, error } = useBookings(true, from, to);
  const active = (data ?? []).filter(b => b.status !== 'cancelled');
  if (loading) return <Loading />; if (error) return <Failed error={error} />;
  const total = active.reduce((s, b) => s + Number(b.total_price), 0);
  return <><p className="blade-note">{active.length} rendez-vous · {fmtPrice(total)} prévus</p>{data?.length ? <Table columns={['Date', 'Heure', 'Client', 'Prestation', 'Statut', 'Total']} rows={bookingRows(data, true)} /> : <EmptyState title={title} compact />}</>;
}
export function LiveAdminBookings({ days = 0, title = 'Aucun rendez-vous' }: { days?: number; title?: string }) {
  const range = useMemo(() => { const s = new Date(); const e = new Date(); e.setDate(e.getDate() + days); return [isoDate(s), isoDate(e)]; }, [days]);
  return <AdminGate>{() => <AdminBookingsInner from={range[0]} to={range[1]} title={title} />}</AdminGate>;
}

function ClientsInner() {
  const { data, loading, error } = useClients(true); const [q, setQ] = useState('');
  if (loading) return <Loading />; if (error) return <Failed error={error} />;
  const list = (data ?? []).filter(c => `${c.name} ${c.email}`.toLowerCase().includes(q.toLowerCase()));
  return <><label className="blade-search"><Icon name="search" size={18} /><input type="search" aria-label="Rechercher un client" placeholder="Rechercher un client" value={q} onChange={e => setQ(e.target.value)} /></label><p className="blade-note">{list.length} client{list.length > 1 ? 's' : ''}</p>{list.length ? <Table columns={['Client', 'E-mail', 'Téléphone', 'Adresse']} rows={list.map(c => [c.name, c.email, c.phone || '—', c.address || '—'])} /> : <EmptyState icon="users" title="Aucun client" compact />}</>;
}
export function LiveClients() { return <AdminGate>{() => <ClientsInner />}</AdminGate>; }

/** Google-Maps-style rating: average of all public reviews. */
export function RatingSummary() {
  const { data } = useReviews();
  if (!data?.length) return null;
  const avg = data.reduce((s, r) => s + r.rating, 0) / data.length;
  return <span className="blade-rating" aria-label={`Note ${avg.toFixed(1)} sur 5, ${data.length} avis`}><strong>{avg.toFixed(1).replace('.', ',')}</strong>{Array.from({ length: 5 }, (_, i) => <Star key={i} size={14} className={i < Math.round(avg) ? 'on' : ''} aria-hidden="true" />)}<small>({data.length})</small></span>;
}

function DayAgendaInner() {
  const [day, setDay] = useState(isoDate(new Date())); const [tick, setTick] = useState(0);
  const { data, loading, error } = useBookings(true, day, day + (tick ? '' : ''));
  const [start, setStart] = useState('09:00'); const [end, setEnd] = useState('12:00'); const [mode, setMode] = useState('both');
  const [msg, setMsg] = useState('');
  const addSlot = async () => {
    const { error } = await supabase.from('date_overrides').insert({ date: day, start_time: start, end_time: end, is_available: true, mode });
    setMsg(error ? `Erreur : ${error.message}` : `Disponibilité ajoutée le ${fmtDate(day)} de ${start} à ${end}.`);
  };
  const cancel = async (b: Booking) => {
    if (!confirm(`Annuler le rendez-vous de ${b.client_name} à ${b.appointment_time.slice(0, 5)} ?`)) return;
    const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', b.id);
    setMsg(error ? `Erreur : ${error.message}` : 'Rendez-vous annulé.'); setTick(t => t + 1);
  };
  return <div className="blade-day-agenda">
    <label className="blade-field"><span>Date</span><input type="date" value={day} onChange={e => setDay(e.target.value)} /></label>
    <h4>Rendez-vous du {fmtDate(day)}</h4>
    {loading ? <Loading /> : error ? <Failed error={error} /> : data?.length ? <ul className="blade-slot-requests">{data.map(b => <li key={b.id}><header><strong>{b.appointment_time.slice(0, 5)} · {b.client_name}</strong><span>{statusLabel[b.status] ?? b.status}</span></header><p>{b.services?.name ?? '—'} · {fmtPrice(b.total_price)}</p>{b.status !== 'cancelled' && <BladeButton onClick={() => cancel(b)}>Annuler le rendez-vous</BladeButton>}</li>)}</ul> : <EmptyState title="Aucun rendez-vous ce jour" compact />}
    <h4>Ajouter une disponibilité</h4>
    <div className="blade-toolbar">
      <label className="blade-field"><span>Début</span><input type="time" value={start} onChange={e => setStart(e.target.value)} /></label>
      <label className="blade-field"><span>Fin</span><input type="time" value={end} onChange={e => setEnd(e.target.value)} /></label>
      <label className="blade-field"><span>Mode</span><select value={mode} onChange={e => setMode(e.target.value)}><option value="both">Les deux</option><option value="deplacement">Chez vous (je me déplace)</option><option value="domicile">Près de vous (le client vient)</option></select></label>
    </div>
    <BladeButton variant="default" onClick={addSlot}>Ajouter la disponibilité</BladeButton>
    {msg && <p className="blade-note" role="status">{msg}</p>}
  </div>;
}
export function LiveDayAgenda() { return <AdminGate>{() => <DayAgendaInner />}</AdminGate>; }
