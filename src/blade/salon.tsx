// Fiches « Salon » : les pros de la coiffure qui ont déjà un salon (et parfois déjà un outil de
// réservation) le référencent sur BLADE. Le bouton « Réserver » mène vers leur propre outil.
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { SupabaseClient } from '@supabase/supabase-js';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowRight, CalendarCheck, Camera, Clock, Copy, ExternalLink, Eye, Globe, Instagram, MapPin, Navigation, Phone, Store } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { BladeButton, EmptyState, Section } from './common';
import { Field, ProviderPage, Status } from './provider';
import { uploadMedia, useMediaUrls } from './customization-data';
import { VerifiedBadge } from './plan';
import { searchPlaces, type Place } from './trip-sim';

const db = supabase as unknown as SupabaseClient;

export type Platform = 'planity' | 'treatwell' | 'site' | 'instagram' | 'autre';
export const PLATFORMS: Record<Platform, string> = { planity: 'Planity', treatwell: 'Treatwell', site: 'Mon site', instagram: 'Instagram', autre: 'Autre outil' };
export const SPECIALTIES = ['Coupe homme', 'Dégradés', 'Barbe', 'Coupe femme', 'Brushing', 'Coloration', 'Cheveux afro & bouclés', 'Locks', 'Tresses', 'Extensions', 'Soins', 'Enfants'];

export type Salon = {
  id: string; provider_id: string; slug: string; name: string; address: string; city: string | null; postal_code: string | null; lat: number | null; lng: number | null;
  phone: string | null; instagram: string | null; website: string | null; booking_url: string | null; booking_platform: Platform | null;
  specialties: string[]; description: string | null; price_from: number | null; hours: string | null; cover_path: string | null; gallery_paths: string[];
  status: 'draft' | 'published' | 'hidden'; is_premium?: boolean;
};
type SalonCard = Pick<Salon, 'id' | 'slug' | 'name' | 'address' | 'city' | 'postal_code' | 'lat' | 'lng' | 'specialties' | 'price_from' | 'cover_path' | 'booking_platform' | 'booking_url'> & { is_premium: boolean };

export async function publicSalons(): Promise<SalonCard[]> {
  const { data, error } = await db.rpc('blade_public_salons'); if (error) throw error; return (data as SalonCard[]) ?? [];
}
async function salonBySlug(slug: string): Promise<Salon | null> {
  const { data, error } = await db.rpc('blade_salon_public', { p_slug: slug }); if (error) throw error; return (data as Salon | null) ?? null;
}
export function trackSalon(id: string, kind: 'booking' | 'phone' | 'instagram' | 'website' | 'directions' | 'view') {
  // La requête Supabase ne part que lorsqu'on attend sa réponse : on l'attend sans bloquer la page.
  db.rpc('blade_salon_click', { p_salon: id, p_kind: kind }).then(() => {}, () => {});
}
const euros = (n: number | null) => (n == null ? '' : `${Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €`);
const directions = (s: Pick<Salon, 'lat' | 'lng' | 'address'>) => s.lat != null && s.lng != null ? `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}` : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(s.address)}`;

/* ---------------- Carte de salon (liste) ---------------- */
/** Ouvre directement l'outil de réservation du salon (compté comme clic « Réserver »). */
export function bookSalon(salon: { id: string; booking_url: string | null }) {
  if (!salon.booking_url) return;
  trackSalon(salon.id, 'booking');
  window.open(salon.booking_url, '_blank', 'noopener');
}

export function SalonCardView({ salon, cover }: { salon: SalonCard; cover?: string }) {
  return <article className="blade-salon-card">
    <Link to={`/blade/salon/${salon.slug}`} className="blade-salon-card-link">
      <span className="blade-salon-card-img">{cover ? <img src={cover} alt="" loading="lazy" /> : <Store size={30} aria-hidden="true" />}</span>
      <span className="blade-salon-card-body">
        <strong>{salon.name}{salon.is_premium && <VerifiedBadge />}</strong>
        <small><MapPin size={14} aria-hidden="true" />{salon.city || salon.address}</small>
        {salon.specialties.length > 0 && <span className="blade-salon-tags">{salon.specialties.slice(0, 3).map(t => <em key={t}>{t}</em>)}</span>}
        {salon.price_from != null && <span className="blade-salon-card-foot">À partir de <b>{euros(salon.price_from)}</b></span>}
      </span>
    </Link>
    <div className="blade-salon-card-actions">
      {salon.booking_url && <BladeButton variant="default" onClick={() => bookSalon(salon)}><CalendarCheck size={16} aria-hidden="true" />Réserver{salon.booking_platform && salon.booking_platform !== 'autre' ? ` sur ${PLATFORMS[salon.booking_platform]}` : ''}<ExternalLink size={13} aria-hidden="true" /></BladeButton>}
      <BladeButton asChild><Link to={`/blade/salon/${salon.slug}`}>Voir le salon <ArrowRight size={15} aria-hidden="true" /></Link></BladeButton>
    </div>
  </article>;
}

/* ---------------- Lien direct : /blade/r/:slug → outil de réservation du salon ---------------- */
export function SalonRedirect() {
  const { slug = '' } = useParams();
  const [state, setState] = useState<'go' | 'missing'>('go');
  const [salon, setSalon] = useState<Salon | null>(null);
  useEffect(() => {
    salonBySlug(slug).then(s => {
      if (!s?.booking_url) { setSalon(s); setState('missing'); return; }
      setSalon(s);
      db.rpc('blade_salon_click', { p_salon: s.id, p_kind: 'booking' }).then(() => window.location.replace(s.booking_url!), () => window.location.replace(s.booking_url!));
    }).catch(() => setState('missing'));
  }, [slug]);
  return <div className="blade-app"><main className="blade-main blade-salon-redirect">
    {state === 'go' ? <p role="status"><Store size={22} aria-hidden="true" />{salon ? `Redirection vers la réservation de ${salon.name}…` : 'Redirection…'}</p>
      : <EmptyState icon="pin" title="Lien indisponible" description="Ce salon n’a pas (ou plus) de lien de réservation sur BLADE." action={<BladeButton asChild><Link to={salon ? `/blade/salon/${salon.slug}` : '/blade/client'}>{salon ? 'Voir le salon' : 'Trouver un professionnel'}</Link></BladeButton>} />}
  </main></div>;
}

/** Liste des salons pour la recherche client (filtrée par ville / code postal / adresse si fournis). */
export function SalonsNearby({ place }: { place?: string }) {
  const [salons, setSalons] = useState<SalonCard[]>([]);
  useEffect(() => { publicSalons().then(setSalons).catch(() => setSalons([])); }, []);
  const q = (place ?? '').trim().toLowerCase();
  const list = q ? salons.filter(s => [s.city, s.postal_code, s.address].some(v => v?.toLowerCase().includes(q))) : salons;
  const shown = list.length ? list : salons;
  const covers = useMediaUrls(shown.map(s => s.cover_path));
  if (!shown.length) return null;
  return <section className="blade-salons-nearby" aria-labelledby="blade-salons-title">
    <div className="blade-section-heading"><h2 id="blade-salons-title">Salons {q && list.length ? `à ${place}` : 'sur BLADE'}</h2></div>
    <div className="blade-salon-grid">{shown.map(s => <SalonCardView key={s.id} salon={s} cover={s.cover_path ? covers[s.cover_path] : undefined} />)}</div>
  </section>;
}

/* ---------------- Petite carte de localisation ---------------- */
function SalonMap({ lat, lng }: { lat: number; lng: number }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!box.current) return;
    const map = L.map(box.current, { zoomControl: false, scrollWheelZoom: false, dragging: !L.Browser.mobile, attributionControl: true }).setView([lat, lng], 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
    L.marker([lat, lng], { icon: L.divIcon({ className: 'blade-salon-pin', html: '<span>✂️</span>', iconSize: [40, 40], iconAnchor: [20, 38] }), keyboard: false }).addTo(map);
    return () => { map.remove(); };
  }, [lat, lng]);
  return <div ref={box} className="blade-salon-map" role="img" aria-label="Plan d’accès au salon" />;
}

/* ---------------- Page publique : /blade/salon/:slug ---------------- */
export function SalonPage() {
  const { slug = '' } = useParams();
  const [salon, setSalon] = useState<Salon | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing'>('loading');
  useEffect(() => {
    salonBySlug(slug).then(s => { setSalon(s); setState(s ? 'ok' : 'missing'); }).catch(() => setState('missing'));
  }, [slug]);
  useEffect(() => {
    if (!salon) return;
    document.title = `${salon.name} — salon de coiffure${salon.city ? ` à ${salon.city}` : ''} | BLADE Hairstyle`;
    const key = `blade-salon-view-${salon.id}`;
    try { if (!sessionStorage.getItem(key)) { sessionStorage.setItem(key, '1'); trackSalon(salon.id, 'view'); } } catch { trackSalon(salon.id, 'view'); }
  }, [salon]);
  const media = useMediaUrls(salon ? [salon.cover_path, ...salon.gallery_paths] : []);
  const open = (kind: 'booking' | 'instagram' | 'website' | 'directions', url: string) => { if (salon) trackSalon(salon.id, kind); window.open(url, '_blank', 'noopener'); };

  return <div className="blade-app blade-salon-page"><main className="blade-main">
    <p className="blade-eyebrow"><Link to="/blade">BLADE</Link> <span>/</span> Salon</p>
    {state === 'loading' && <p role="status">Chargement du salon…</p>}
    {state === 'missing' && <EmptyState icon="pin" title="Salon introuvable" description="Ce salon n’est pas (ou plus) référencé sur BLADE." action={<BladeButton asChild><Link to="/blade/client">Trouver un professionnel</Link></BladeButton>} />}
    {state === 'ok' && salon && <>
      <header className="blade-salon-hero">
        <div className="blade-salon-cover">{salon.cover_path && media[salon.cover_path] ? <img src={media[salon.cover_path]} alt={`Salon ${salon.name}`} /> : <Store size={48} aria-hidden="true" />}</div>
        <div className="blade-salon-head">
          <h1>{salon.name}</h1>
          {salon.is_premium && <VerifiedBadge />}
          <p className="blade-salon-address"><MapPin size={16} aria-hidden="true" />{salon.address}</p>
          {salon.specialties.length > 0 && <p className="blade-salon-tags">{salon.specialties.map(t => <em key={t}>{t}</em>)}</p>}
          {salon.price_from != null && <p className="blade-salon-price">À partir de <strong>{euros(salon.price_from)}</strong></p>}
        </div>
      </header>
      <div className="blade-salon-actions">
        {salon.booking_url && <BladeButton variant="default" onClick={() => open('booking', salon.booking_url!)}><CalendarCheck size={18} aria-hidden="true" />Réserver{salon.booking_platform && salon.booking_platform !== 'autre' ? ` sur ${PLATFORMS[salon.booking_platform]}` : ''}<ExternalLink size={14} aria-hidden="true" /></BladeButton>}
        {salon.phone && <BladeButton asChild><a href={`tel:${salon.phone.replace(/\s/g, '')}`} onClick={() => trackSalon(salon.id, 'phone')}><Phone size={18} aria-hidden="true" />Appeler</a></BladeButton>}
        <BladeButton onClick={() => open('directions', directions(salon))}><Navigation size={18} aria-hidden="true" />Itinéraire</BladeButton>
        {salon.instagram && <BladeButton onClick={() => open('instagram', `https://www.instagram.com/${salon.instagram}/`)}><Instagram size={18} aria-hidden="true" />Instagram</BladeButton>}
        {salon.website && <BladeButton onClick={() => open('website', salon.website!)}><Globe size={18} aria-hidden="true" />Site web</BladeButton>}
      </div>
      <div className="blade-salon-grid2">
        <div>
          {salon.description && <Section title="Le salon"><p className="blade-salon-text">{salon.description}</p></Section>}
          {salon.hours && <Section title="Horaires"><p className="blade-salon-text"><Clock size={16} aria-hidden="true" /> {salon.hours}</p></Section>}
          {salon.gallery_paths.length > 0 && <Section title="Photos"><div className="blade-salon-gallery">{salon.gallery_paths.map(p => media[p] && <img key={p} src={media[p]} alt="" loading="lazy" />)}</div></Section>}
        </div>
        <div>{salon.lat != null && salon.lng != null && <SalonMap lat={salon.lat} lng={salon.lng} />}</div>
      </div>
    </>}
  </main></div>;
}

/* ---------------- Espace pro : « Mon salon » ---------------- */
type Form = { name: string; address: string; city: string; postal_code: string; lat: number | null; lng: number | null; phone: string; instagram: string; website: string; booking_url: string; booking_platform: Platform; specialties: string[]; description: string; price_from: string; hours: string; cover_path: string | null; status: 'draft' | 'published' | 'hidden' };
const EMPTY: Form = { name: '', address: '', city: '', postal_code: '', lat: null, lng: null, phone: '', instagram: '', website: '', booking_url: '', booking_platform: 'planity', specialties: [], description: '', price_from: '', hours: '', cover_path: null, status: 'draft' };
const https = (v: string) => { const t = v.trim(); if (!t) return null; return /^https?:\/\//i.test(t) ? t.replace(/^http:/i, 'https:') : `https://${t}`; };

function SalonEditor({ providerId }: { providerId: string }) {
  const [form, setForm] = useState<Form>(EMPTY);
  const [salon, setSalon] = useState<Salon | null>(null);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const [places, setPlaces] = useState<Place[]>([]);
  const picked = useRef('');
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }));
  const cover = useMediaUrls([form.cover_path]);

  useEffect(() => {
    (async () => {
      const { data } = await db.from('blade_salons').select('*').eq('provider_id', providerId).maybeSingle();
      if (data) {
        const s = data as Salon; setSalon(s); picked.current = s.address;
        setForm({ name: s.name, address: s.address, city: s.city ?? '', postal_code: s.postal_code ?? '', lat: s.lat, lng: s.lng, phone: s.phone ?? '', instagram: s.instagram ?? '',
          website: s.website ?? '', booking_url: s.booking_url ?? '', booking_platform: s.booking_platform ?? 'planity', specialties: s.specialties ?? [], description: s.description ?? '',
          price_from: s.price_from != null ? String(s.price_from) : '', hours: s.hours ?? '', cover_path: s.cover_path, status: s.status });
      }
      const st = await db.rpc('blade_my_salon_stats'); if (!st.error) setStats((st.data as Record<string, number>) ?? {});
      setLoading(false);
    })();
  }, [providerId]);

  // Suggestions d’adresse (géolocalise le salon pour la carte et la recherche).
  useEffect(() => {
    if (form.address.trim().length < 4 || form.address === picked.current) { setPlaces([]); return; }
    const ctrl = new AbortController();
    const id = window.setTimeout(() => { searchPlaces(form.address, ctrl.signal).then(setPlaces).catch(() => {}); }, 350);
    return () => { window.clearTimeout(id); ctrl.abort(); };
  }, [form.address]);
  const pick = (p: Place) => {
    const cp = /\b(\d{5})\b/.exec(p.label)?.[1] ?? '';
    const city = cp ? (p.label.split(cp)[1] ?? '').split(',')[0].trim() : '';
    picked.current = p.label; setPlaces([]);
    setForm(f => ({ ...f, address: p.label.replace(/, France$/, ''), postal_code: cp, city: city || f.city, lng: p.center[0], lat: p.center[1] }));
  };

  const save = async (publish?: boolean) => {
    setBusy(true); setError(''); setMessage('');
    try {
      if (form.name.trim().length < 2) throw new Error('Indique le nom du salon.');
      if (form.address.trim().length < 5) throw new Error('Indique l’adresse du salon.');
      if (publish && !form.booking_url.trim()) throw new Error('Ajoute le lien de réservation de ton salon pour le publier : tes clients y seront redirigés directement.');
      const price = form.price_from.trim() ? Number(form.price_from.replace(',', '.')) : null;
      if (price != null && !(price >= 0 && price <= 1000)) throw new Error('Prix « à partir de » invalide.');
      const insta = form.instagram.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/.*$/, '') || null;
      const values = {
        name: form.name.trim(), address: form.address.trim(), city: form.city.trim() || null, postal_code: /^\d{5}$/.test(form.postal_code) ? form.postal_code : null,
        lat: form.lat, lng: form.lng, phone: form.phone.trim() || null, instagram: insta, website: https(form.website), booking_url: https(form.booking_url),
        booking_platform: form.booking_url.trim() ? form.booking_platform : null, specialties: form.specialties, description: form.description.trim() || null,
        price_from: price, hours: form.hours.trim() || null, cover_path: form.cover_path,
        status: publish === undefined ? (salon?.status ?? 'draft') : publish ? 'published' : 'draft',
      };
      const res = salon ? await db.from('blade_salons').update(values).eq('id', salon.id).select('*').single()
        : await db.from('blade_salons').insert({ ...values, provider_id: providerId }).select('*').single();
      if (res.error) throw new Error(/published_needs_link/.test(res.error.message) ? 'Un salon en ligne doit avoir un lien de réservation.' : /check|violates/i.test(res.error.message) ? 'Une information n’est pas au bon format (Instagram, liens en https, code postal…).' : res.error.message);
      setSalon(res.data as Salon); set('status', (res.data as Salon).status);
      setMessage(values.status === 'published' ? 'Ton salon est en ligne sur BLADE.' : 'Enregistré. Ton salon n’est pas encore visible.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Enregistrement impossible.'); }
    finally { setBusy(false); }
  };
  const upload = async (file?: File) => {
    if (!file) return; setBusy(true); setError('');
    try { set('cover_path', await uploadMedia(providerId, file, 'cover')); setMessage('Photo ajoutée : pense à enregistrer.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Envoi impossible.'); } finally { setBusy(false); }
  };

  if (loading) return <p role="status">Chargement…</p>;
  const total = (k: string) => stats[k] ?? 0;
  return <>
    <Section title="Pourquoi référencer ton salon ?">
      <p className="blade-note">Tu as déjà Planity, ton site ou tes réservations par Instagram ? Garde-les. Ta fiche BLADE rend ton salon visible auprès des clients près de chez toi, et le bouton « Réserver » les envoie vers ton outil habituel. C’est gratuit.</p>
    </Section>
    {salon?.status === 'published' && salon.booking_url && <Section title="Ton lien direct BLADE">
      <p className="blade-note">Partage ce lien (bio Instagram, QR code en vitrine, carte NFC…) : il envoie tes clients directement vers ta réservation, et chaque clic est compté ci-dessous.</p>
      <div className="blade-salon-shortlink">
        <code>{`${window.location.origin}/blade/r/${salon.slug}`}</code>
        <BladeButton onClick={async () => { const l = `${window.location.origin}/blade/r/${salon.slug}`; try { await navigator.clipboard.writeText(l); setMessage('Lien copié.'); } catch { setMessage(l); } }}><Copy size={16} aria-hidden="true" />Copier</BladeButton>
      </div>
    </Section>}
    {salon && <Section title="Ce que BLADE t’apporte (30 derniers jours)">
      <ul className="blade-salon-stats">
        <li><Eye size={18} aria-hidden="true" /><strong>{total('view')}</strong><span>vues de ta fiche</span></li>
        <li><CalendarCheck size={18} aria-hidden="true" /><strong>{total('booking')}</strong><span>clics sur Réserver</span></li>
        <li><Phone size={18} aria-hidden="true" /><strong>{total('phone')}</strong><span>appels</span></li>
        <li><Navigation size={18} aria-hidden="true" /><strong>{total('directions')}</strong><span>itinéraires</span></li>
        <li><Instagram size={18} aria-hidden="true" /><strong>{total('instagram') + total('website')}</strong><span>visites Instagram / site</span></li>
      </ul>
    </Section>}
    <Section title="Ma fiche salon">
      <form className="blade-local-form blade-salon-form" onSubmit={e => { e.preventDefault(); void save(); }}>
        <div className="blade-fields">
          <Field label="Nom du salon" value={form.name} onChange={v => set('name', v)} required />
          <div className="blade-salon-address-field">
            <Field label="Adresse du salon" value={form.address} onChange={v => set('address', v)} required />
            {places.length > 0 && <ul className="blade-sim-list" role="listbox">{places.map(p => <li key={p.label} role="option" aria-selected="false"><button type="button" onClick={() => pick(p)}>{p.label}</button></li>)}</ul>}
            {form.lat != null ? <small className="blade-note">Adresse placée sur la carte ✓</small> : <small className="blade-note">Choisis une suggestion pour placer ton salon sur la carte.</small>}
          </div>
          <Field label="Téléphone" type="tel" value={form.phone} onChange={v => set('phone', v)} />
          <Field label="Instagram (sans @)" value={form.instagram} onChange={v => set('instagram', v)} />
          <Field label="Lien de réservation de ton salon (obligatoire pour publier)" value={form.booking_url} onChange={v => set('booking_url', v)} required={form.status === 'published'} />
          <label className="blade-field"><span>Outil de réservation</span><select value={form.booking_platform} onChange={e => set('booking_platform', e.target.value as Platform)}>{Object.entries(PLATFORMS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <Field label="Site web" value={form.website} onChange={v => set('website', v)} />
          <Field label="Prix « à partir de » (€)" type="number" value={form.price_from} onChange={v => set('price_from', v)} />
        </div>
        <fieldset className="blade-salon-specs"><legend>Spécialités</legend>
          {SPECIALTIES.map(s => <label key={s} className={form.specialties.includes(s) ? 'is-on' : ''}><input type="checkbox" checked={form.specialties.includes(s)} onChange={e => set('specialties', e.target.checked ? [...form.specialties, s] : form.specialties.filter(x => x !== s))} />{s}</label>)}
        </fieldset>
        <Field label="Horaires (ex. Mar–Sam 10h–20h, Dim 11h–17h)" value={form.hours} onChange={v => set('hours', v)} />
        <Field label="Présentation du salon" type="textarea" value={form.description} onChange={v => set('description', v)} />
        <div className="blade-salon-cover-edit">
          {form.cover_path && cover[form.cover_path] ? <img src={cover[form.cover_path]} alt="Photo du salon" /> : <span><Store size={28} aria-hidden="true" /></span>}
          <label className="blade-button blade-salon-upload"><Camera size={18} aria-hidden="true" />{form.cover_path ? 'Changer la photo' : 'Ajouter une photo du salon'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => void upload(e.target.files?.[0])} hidden /></label>
        </div>
        <Status error={error} message={message} />
        <div className="blade-inline">
          <BladeButton type="submit" disabled={busy}>Enregistrer</BladeButton>
          {form.status !== 'published'
            ? <BladeButton type="button" variant="default" disabled={busy || form.status === 'hidden'} onClick={() => void save(true)}>Publier mon salon</BladeButton>
            : <BladeButton type="button" disabled={busy} onClick={() => void save(false)}>Retirer de BLADE</BladeButton>}
          {salon?.status === 'published' && <BladeButton asChild><Link to={`/blade/salon/${salon.slug}`} target="_blank">Voir ma fiche <ExternalLink size={14} aria-hidden="true" /></Link></BladeButton>}
        </div>
        {form.status === 'hidden' && <p className="blade-form-error">Ta fiche a été masquée par BLADE. Contacte le support.</p>}
      </form>
    </Section>
  </>;
}

export function ProSalon() {
  return <ProviderPage title="Mon salon">{data => <SalonEditor providerId={data.provider_id} />}</ProviderPage>;
}
