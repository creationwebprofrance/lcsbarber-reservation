// Provider-branded views: accent color + font scope and the public profile.
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { BladeButton, EmptyState, Section, ArrowRight } from './common';
import { VerifiedBadge } from './plan';
import { fmtPrice } from './data';
import { FONTS, brandVars, cleanLogoStyle, isVideoPath, layoutOf, logoStyleVars, widgetsOf, type FontKey, type LogoStyle, type Widget } from './customization-model';
import { pageOf, useMediaUrls, type OpeningHour, type PageSettings, type PublicPage } from './customization-data';
import { DOMICILE_ADDRESS, allowedModes } from '../../supabase/functions/_shared/blade-booking-rules';

export function useBrandFont(font: FontKey | string) {
  useEffect(() => {
    const f = FONTS[font as FontKey];
    if (!f?.google) return;
    const id = `blade-font-${font}`;
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id; link.rel = 'stylesheet'; link.href = `https://fonts.googleapis.com/css2?${f.google}&display=swap`;
    document.head.appendChild(link);
  }, [font]);
}
export function BrandScope({ accent, font, children, className = '' }: { accent: string; font: FontKey | string; children: ReactNode; className?: string }) {
  useBrandFont(font);
  return <div className={`blade-brand-scope ${className}`} style={brandVars(accent, font) as CSSProperties}>{children}</div>;
}
export function BrandLogo({ url, name, logoStyle }: { url?: string; name: string; logoStyle?: Partial<LogoStyle> | null }) {
  const bg = url ? cleanLogoStyle(logoStyle).bg : null;
  return <span className={`blade-brand-logo ${bg ? 'has-bg' : ''}`} style={url ? logoStyleVars(logoStyle) as CSSProperties : undefined}>{url ? <img src={url} alt={`Logo ${name}`} draggable={false} /> : name.trim().slice(0, 1).toUpperCase() || 'B'}</span>;
}

const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const hm = (t: string) => t.slice(0, 5) === '00:00' ? '24:00' : t.slice(0, 5);
function Hours({ hours }: { hours: OpeningHour[] }) {
  const days = [1, 2, 3, 4, 5, 6, 0].map(d => ({ d, ranges: [...new Set(hours.filter(h => h.day_of_week === d).map(h => `${hm(h.start_time)}–${hm(h.end_time)}`))] }));
  return <dl className="blade-key-values">{days.map(({ d, ranges }) => <div key={d}><dt>{DAY_NAMES[d]}</dt><dd>{ranges.length ? ranges.join(', ') : 'Fermé'}</dd></div>)}</dl>;
}
function Stars({ value }: { value: number }) { return <>{Array.from({ length: 5 }, (_, i) => <Star key={i} size={14} className={i < Math.round(value) ? 'on' : ''} aria-hidden="true" />)}</>; }

/** Animation du logo à l'ouverture d'un profil : le logo apparaît en grand, puis rejoint sa place. */
function LogoIntro({ url, name, logoStyle }: { url?: string; name: string; logoStyle?: LogoStyle | null }) {
  const [on, setOn] = useState(() => typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => { if (!on) return; const t = window.setTimeout(() => setOn(false), 1700); return () => window.clearTimeout(t); }, [on]);
  if (!on) return null;
  return <div className="blade-logo-intro" aria-hidden="true" onClick={() => setOn(false)}>
    <span className="blade-logo-intro-ring" /><span className="blade-logo-intro-ring is-2" />
    <span className="blade-logo-intro-logo"><BrandLogo url={url} name={name} logoStyle={logoStyle} /></span>
    <span className="blade-logo-intro-name">{name}</span>
  </div>;
}

export function ProviderProfileView({ data, preview = false, intro = !preview, layout: layoutOverride }: { data: PublicPage; preview?: boolean; intro?: boolean; layout?: string }) {
  const page = pageOf(data);
  const widgets = widgetsOf(page);
  const urls = useMediaUrls([page.logo_path, page.cover_path, ...page.gallery_paths]);
  const book = `/blade/client/reserver?pro=${data.provider_id}`;
  const modes = allowedModes(page.booking_modes);
  const place = data.is_lcs ? DOMICILE_ADDRESS : page.salon_address;
  const avg = data.reviews.length ? data.reviews.reduce((s, r) => s + r.rating, 0) / data.reviews.length : null;
  const gallery = page.gallery_paths.filter(p => urls[p]);
  const logoUrl = page.logo_path ? urls[page.logo_path] : undefined;
  // L'animation attend le logo (s'il y en a un) pour ne pas montrer l'initiale puis l'image.
  const logoReady = !page.logo_path || !!logoUrl;

  const render = (w: Widget): ReactNode => {
    const t = (fallback: string) => w.title || fallback;
    switch (w.type) {
      case 'about': return page.bio ? <Section title={t('Présentation')}><p className="blade-brand-bio">{page.bio}</p></Section> : null;
      case 'social': return (page.instagram || page.tiktok) ? <Section title={t('Réseaux sociaux')}><p className="blade-brand-links">
        {page.instagram && <a href={`https://instagram.com/${page.instagram}`} target="_blank" rel="noopener noreferrer">Instagram @{page.instagram}</a>}
        {page.tiktok && <a href={`https://www.tiktok.com/@${page.tiktok}`} target="_blank" rel="noopener noreferrer">TikTok @{page.tiktok}</a>}
      </p></Section> : null;
      case 'services': return <Section title={t('Prestations')}>{data.services.length ? <div className="blade-provider-list">{data.services.map(s => <article key={s.id}><div><h3>{s.name}</h3>{s.description && <p>{s.description}</p>}<small>{s.duration_minutes} min</small></div><strong>{fmtPrice(s.price)}</strong>{!preview && <BladeButton asChild variant="default"><Link to={`${book}&prestation=${s.id}`}>Réserver</Link></BladeButton>}</article>)}</div> : <EmptyState icon="scissors" title="Aucune prestation en ligne" compact />}</Section>;
      case 'gallery': return page.gallery_paths.length ? <Section title={t('Galerie')}><div className="blade-gallery-grid">{gallery.map(p => <figure key={p}>{isVideoPath(p) ? <video src={urls[p]} muted loop playsInline autoPlay controls preload="metadata" aria-label={`Vidéo de ${data.name}`} /> : <img src={urls[p]} alt={`Réalisation de ${data.name}`} loading="lazy" />}</figure>)}</div></Section> : null;
      case 'reviews': return <Section title={t('Avis clients')}>{data.reviews.length ? <ul className="blade-live-reviews">{data.reviews.map(r => <li key={r.id}><div><strong>{r.client_name}</strong><span aria-label={`${r.rating} sur 5`}><Stars value={r.rating} /></span></div>{r.comment && <p>{r.comment}</p>}<small>{new Date(r.created_at).toLocaleDateString('fr-FR')}</small></li>)}</ul> : <EmptyState icon="message" title="Pas encore d’avis" compact />}</Section>;
      case 'hours': return data.hours.length ? <Section title={t('Horaires')}><Hours hours={data.hours} /></Section> : null;
      case 'map': return (place || page.city || modes.includes('deplacement')) ? <Section title={t('Adresse et zone')}><dl className="blade-key-values">
        {modes.includes('domicile') && <div><dt>Sur place</dt><dd>{place || page.city || 'Adresse communiquée à la réservation'}</dd></div>}
        {modes.includes('deplacement') && <div><dt>À domicile</dt><dd>{data.name} se déplace chez toi{page.city ? ` · autour de ${page.city}` : ''}</dd></div>}
      </dl>{(place || page.city) && <p><a className="blade-text-link" href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(place || page.city || '')}`} target="_blank" rel="noopener noreferrer">Voir sur la carte <ArrowRight size={16} /></a></p>}</Section> : null;
      case 'booking': return <div className="blade-widget-cta"><div><strong>{w.title || `Réserve avec ${data.name}`}</strong><span>En ligne, en quelques secondes.</span></div>{preview ? <BladeButton variant="default">Réserver</BladeButton> : <BladeButton asChild variant="default"><Link to={book}>Réserver</Link></BladeButton>}</div>;
      case 'text': return w.text ? <Section title={w.title || 'Bon à savoir'}><p className="blade-widget-text">{w.text}</p></Section> : null;
      default: return null;
    }
  };

  const layout = layoutOf(layoutOverride ?? page.layout);
  if (layout !== 'classique') {
    const ctx: LayoutCtx = { data, page, widgets, urls, gallery, logoUrl, avg, place, modes, book, preview, render };
    return <BrandScope accent={page.accent_color} font={page.font_key} className={`blade-layout blade-layout-${layout}`}>
      {intro && logoReady && <LogoIntro url={logoUrl} name={data.name} logoStyle={page.logo_style} />}
      {layout === 'agenda' ? <AgendaLayout {...ctx} /> : layout === 'vitrine' ? <VitrineLayout {...ctx} /> : <SalonLayout {...ctx} />}
    </BrandScope>;
  }

  return <BrandScope accent={page.accent_color} font={page.font_key}>
    {intro && logoReady && <LogoIntro url={logoUrl} name={data.name} logoStyle={page.logo_style} />}
    <header className={`blade-brand-hero ${intro ? 'has-intro' : ''}`}>
      <div className="blade-brand-cover">{page.cover_path && urls[page.cover_path] && <img src={urls[page.cover_path]} alt="" />}</div>
      <div className="blade-brand-identity">
        <BrandLogo url={logoUrl} name={data.name} logoStyle={page.logo_style} />
        <div><p className="blade-eyebrow">Professionnel</p><h1>{data.name}</h1>{data.is_premium && <VerifiedBadge/>}{page.city && <p>{page.city}</p>}
          {avg !== null && <span className="blade-rating" aria-label={`Note ${avg.toFixed(1)} sur 5`}><strong>{avg.toFixed(1).replace('.', ',')}</strong><Stars value={avg} /></span>}</div>
        {!preview && <BladeButton asChild variant="default"><Link to={book}>Réserver</Link></BladeButton>}
      </div>
    </header>
    <div className="blade-widgets">
      {widgets.map(w => { const node = render(w); return node ? <div key={w.id} className={`blade-widget blade-widget-${w.size}`}>{node}</div> : null; })}
    </div>
  </BrandScope>;
}

// ---- Modèles de page (Agenda, Vitrine, Salon) : mêmes données que le profil classique, autre mise en page ----
type LayoutCtx = {
  data: PublicPage; page: PageSettings; widgets: Widget[]; urls: Record<string, string>; gallery: string[]; logoUrl?: string;
  avg: number | null; place: string | null; modes: ReturnType<typeof allowedModes>; book: string; preview: boolean; render: (w: Widget) => ReactNode;
};
const has = (c: LayoutCtx, type: Widget['type']) => c.widgets.some(w => w.type === type);
const others = (c: LayoutCtx, skip: Widget['type'][]) => c.widgets.filter(w => !skip.includes(w.type));
const fmtAvg = (avg: number) => avg.toFixed(1).replace('.', ',');
const LAYOUT_SECTION_TITLES: Partial<Record<Widget['type'], string>> = { gallery: 'Réalisations', reviews: 'Avis clients', hours: 'Horaires', map: 'Adresse et zone' };

function BookLink({ c, to, children, className }: { c: LayoutCtx; to?: string; children: ReactNode; className?: string }) {
  return c.preview ? <BladeButton variant="default" className={className}>{children}</BladeButton>
    : <BladeButton asChild variant="default" className={className}><Link to={to ?? c.book}>{children}</Link></BladeButton>;
}
function Rating({ c }: { c: LayoutCtx }) {
  return c.avg !== null ? <span className="blade-rating" aria-label={`Note ${fmtAvg(c.avg)} sur 5`}><strong>{fmtAvg(c.avg)}</strong><Stars value={c.avg} /><small>{c.data.reviews.length} avis</small></span> : null;
}
function PlaceFacts({ c }: { c: LayoutCtx }) {
  const { page, data, modes, place } = c;
  return <>
    {modes.includes('domicile') && <div><dt>Sur place</dt><dd>{place || page.city || 'Adresse communiquée à la réservation'}</dd></div>}
    {modes.includes('deplacement') && <div><dt>À domicile</dt><dd>{data.name} se déplace chez toi{page.city ? ` · autour de ${page.city}` : ''}</dd></div>}
  </>;
}
function Media({ c, path }: { c: LayoutCtx; path: string }) {
  return isVideoPath(path) ? <video src={c.urls[path]} muted loop playsInline autoPlay preload="metadata" aria-label={`Vidéo de ${c.data.name}`} />
    : <img src={c.urls[path]} alt={`Réalisation de ${c.data.name}`} loading="lazy" />;
}
function priceRange(c: LayoutCtx) {
  const p = c.data.services.map(s => Number(s.price)).filter(n => Number.isFinite(n));
  if (!p.length) return null;
  const lo = Math.min(...p), hi = Math.max(...p);
  return lo === hi ? fmtPrice(lo) : `De ${fmtPrice(lo)} à ${fmtPrice(hi)}`;
}

/** Agenda : fiche à gauche, choix de la prestation à droite, puis le calendrier de réservation. */
function AgendaLayout(c: LayoutCtx) {
  const { data, page } = c;
  const [picked, setPicked] = useState<string | null>(null);
  const service = data.services.find(s => s.id === picked);
  const more = others(c, ['services', 'booking', 'about', 'social']);
  return <div className="blade-la">
    <aside className="blade-la-who">
      <BrandLogo url={c.logoUrl} name={data.name} logoStyle={page.logo_style} />
      <div><h1>{data.name}</h1>{data.is_premium && <VerifiedBadge />}{page.city && <p>{page.city}</p>}<Rating c={c} /></div>
      <dl className="blade-key-values"><PlaceFacts c={c} /></dl>
      {page.bio && <p className="blade-brand-bio">{page.bio}</p>}
      {(page.instagram || page.tiktok) && c.render({ id: 'social', type: 'social', size: 'full' })}
    </aside>
    <section className="blade-la-flow" aria-label={`Réserver avec ${data.name}`}>
      <div className={`blade-la-step ${service ? 'is-done' : ''}`}>
        <h2><span className="blade-la-num">1</span>Choisis ta prestation</h2>
        {data.services.length ? <div className="blade-la-services" role="group" aria-label="Prestations">
          {data.services.map(s => <button type="button" key={s.id} className="blade-la-service" aria-pressed={picked === s.id} onClick={() => setPicked(s.id)}>
            <span><strong>{s.name}</strong>{s.description && <small>{s.description}</small>}</span>
            <span className="blade-la-dur">{s.duration_minutes} min</span><strong className="blade-la-price">{fmtPrice(s.price)}</strong>
          </button>)}
        </div> : <EmptyState icon="scissors" title="Aucune prestation en ligne" compact />}
      </div>
      <div className={`blade-la-step ${service ? '' : 'is-locked'}`}>
        <h2><span className="blade-la-num">2</span>Choisis ton créneau</h2>
        <div className="blade-la-recap">
          <p>{service ? <><strong>{service.name}</strong> · {service.duration_minutes} min · {fmtPrice(service.price)}</> : 'Sélectionne d’abord une prestation.'}</p>
          {service ? <BookLink c={c} to={`${c.book}&prestation=${service.id}`}>Voir les créneaux</BookLink> : <BladeButton variant="default" disabled>Voir les créneaux</BladeButton>}
        </div>
        <p className="blade-note">Le calendrier s’ouvre à l’étape suivante, avec le lieu et l’heure.</p>
      </div>
    </section>
    {more.length > 0 && <div className="blade-la-more">
      {more.map(w => { const node = c.render(w); return node ? <details key={w.id} className="blade-la-fold"><summary>{w.title || (w.type === 'text' ? 'Bon à savoir' : LAYOUT_SECTION_TITLES[w.type] ?? 'Infos')}</summary>{node}</details> : null; })}
    </div>}
  </div>;
}

/** Vitrine : grande couverture, réalisations d'abord, prestations en cartes, bouton fixe sur mobile. */
function VitrineLayout(c: LayoutCtx) {
  const { data, page, urls } = c;
  const showGallery = has(c, 'gallery') && c.gallery.length > 0;
  const rest = others(c, ['services', 'booking', 'gallery']);
  const from = data.services.length ? Math.min(...data.services.map(s => Number(s.price))) : null;
  return <div className="blade-lv">
    <header className="blade-lv-hero">
      <div className="blade-lv-cover">{page.cover_path && urls[page.cover_path] && <img src={urls[page.cover_path]} alt="" />}</div>
      <div className="blade-lv-id">
        <BrandLogo url={c.logoUrl} name={data.name} logoStyle={page.logo_style} />
        <div><h1>{data.name}</h1>{data.is_premium && <VerifiedBadge />}
          <p className="blade-lv-meta"><Rating c={c} />{page.city && <span>{page.city}</span>}{from !== null && <span>Dès {fmtPrice(from)}</span>}</p></div>
        <BookLink c={c} className="blade-lv-book">Réserver</BookLink>
      </div>
    </header>
    {showGallery && <Section title="Réalisations"><div className={`blade-lv-gallery n-${Math.min(c.gallery.length, 5)}`}>
      {c.gallery.slice(0, 5).map(p => <figure key={p}><Media c={c} path={p} /></figure>)}
    </div>{c.gallery.length > 5 && <p className="blade-note">{c.gallery.length - 5} autres réalisations</p>}</Section>}
    <Section title="Prestations">{data.services.length ? <div className="blade-lv-cards">
      {data.services.map((s, i) => <article key={s.id} className="blade-lv-card">
        {c.gallery[i] && !isVideoPath(c.gallery[i]) && <img src={urls[c.gallery[i]]} alt="" loading="lazy" />}
        <div><h3>{s.name}</h3>{s.description && <p>{s.description}</p>}
          <div className="blade-lv-card-row"><span><strong>{fmtPrice(s.price)}</strong> · {s.duration_minutes} min</span><BookLink c={c} to={`${c.book}&prestation=${s.id}`}>Réserver</BookLink></div></div>
      </article>)}
    </div> : <EmptyState icon="scissors" title="Aucune prestation en ligne" compact />}</Section>
    <div className="blade-lv-rest">{rest.map(w => { const node = c.render(w); return node ? <div key={w.id}>{node}</div> : null; })}</div>
    {!c.preview && <div className="blade-lv-sticky"><span><strong>{data.name}</strong>{from !== null && <small>Dès {fmtPrice(from)}{c.avg !== null ? ` · ${fmtAvg(c.avg)} ★` : ''}</small>}</span><BookLink c={c}>Réserver</BookLink></div>}
  </div>;
}

/** Salon : en-tête avec adresse et note, mosaïque de photos, onglets, encadrés réservation, adresse et horaires. */
function SalonLayout(c: LayoutCtx) {
  const { data, page, urls } = c;
  const photos = [page.cover_path && urls[page.cover_path] ? page.cover_path : null, ...c.gallery.filter(p => !isVideoPath(p))].filter(Boolean).slice(0, 5) as string[];
  const address = c.place || page.city;
  const range = priceRange(c);
  const showReviews = has(c, 'reviews');
  const extra = others(c, ['services', 'booking', 'reviews', 'hours', 'map', 'gallery']);
  return <div className="blade-ls">
    <header className="blade-ls-head">
      <h1>{data.name}</h1>{data.is_premium && <VerifiedBadge />}
      <p className="blade-ls-line"><Rating c={c} />{address && <span>{address}</span>}{c.modes.includes('deplacement') && <span>Se déplace à domicile</span>}</p>
      {photos.length > 0 && <div className={`blade-ls-photos n-${photos.length}`}>{photos.map(p => <figure key={p}><img src={urls[p]} alt="" loading={p === photos[0] ? "eager" : "lazy"} fetchPriority={p === photos[0] ? "high" : "auto"} /></figure>)}</div>}
    </header>
    <nav className="blade-ls-tabs" aria-label="Sections"><a href="#prestations">Prestations</a>{showReviews && <a href="#avis">Avis</a>}{extra.length > 0 && <a href="#a-propos">À propos</a>}</nav>
    <div className="blade-ls-grid">
      <div className="blade-ls-main">
        <section id="prestations"><h2>Prestations</h2>{data.services.length ? <div className="blade-ls-services">
          {data.services.map(s => <div key={s.id} className="blade-ls-service">
            <span><strong>{s.name}</strong>{s.description && <small>{s.description}</small>}</span>
            <span className="blade-la-dur">{s.duration_minutes} min</span><strong className="blade-la-price">{fmtPrice(s.price)}</strong>
            {c.preview ? <BladeButton>Choisir</BladeButton> : <BladeButton asChild><Link to={`${c.book}&prestation=${s.id}`}>Choisir</Link></BladeButton>}
          </div>)}
        </div> : <EmptyState icon="scissors" title="Aucune prestation en ligne" compact />}</section>
        {showReviews && <section id="avis">{c.render({ id: 'reviews', type: 'reviews', size: 'full' })}</section>}
        {extra.length > 0 && <section id="a-propos">{extra.map(w => { const node = c.render(w); return node ? <div key={w.id}>{node}</div> : null; })}</section>}
      </div>
      <aside className="blade-ls-side">
        <div className="blade-ls-box"><strong>Réserver chez {data.name}</strong>{range && <p>{range}</p>}<BookLink c={c} className="blade-ls-book">Prendre rendez-vous</BookLink></div>
        {(address || c.modes.includes('deplacement')) && <div className="blade-ls-box"><strong>Adresse et zone</strong><dl className="blade-key-values"><PlaceFacts c={c} /></dl>
          {address && <a className="blade-text-link" href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}`} target="_blank" rel="noopener noreferrer">Voir sur la carte <ArrowRight size={16} /></a>}</div>}
        {data.hours.length > 0 && <div className="blade-ls-box"><strong>Horaires</strong><Hours hours={data.hours} /></div>}
      </aside>
    </div>
  </div>;
}
