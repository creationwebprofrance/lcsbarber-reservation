// Provider-branded views: accent color + font scope and the public profile.
import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { BladeButton, EmptyState, Section, ArrowRight } from './common';
import { VerifiedBadge } from './plan';
import { fmtPrice } from './data';
import { FONTS, brandVars, type FontKey } from './customization-model';
import { pageOf, useMediaUrls, type OpeningHour, type PublicPage } from './customization-data';
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
export function BrandLogo({ url, name }: { url?: string; name: string }) {
  return <span className="blade-brand-logo">{url ? <img src={url} alt={`Logo ${name}`} /> : name.trim().slice(0, 1).toUpperCase() || 'B'}</span>;
}

const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const hm = (t: string) => t.slice(0, 5) === '00:00' ? '24:00' : t.slice(0, 5);
function Hours({ hours }: { hours: OpeningHour[] }) {
  const days = [1, 2, 3, 4, 5, 6, 0].map(d => ({ d, ranges: [...new Set(hours.filter(h => h.day_of_week === d).map(h => `${hm(h.start_time)}–${hm(h.end_time)}`))] }));
  return <dl className="blade-key-values">{days.map(({ d, ranges }) => <div key={d}><dt>{DAY_NAMES[d]}</dt><dd>{ranges.length ? ranges.join(', ') : 'Fermé'}</dd></div>)}</dl>;
}
function Stars({ value }: { value: number }) { return <>{Array.from({ length: 5 }, (_, i) => <Star key={i} size={14} className={i < Math.round(value) ? 'on' : ''} aria-hidden="true" />)}</>; }

export function ProviderProfileView({ data, preview = false }: { data: PublicPage; preview?: boolean }) {
  const page = pageOf(data);
  const urls = useMediaUrls([page.logo_path, page.cover_path, ...page.gallery_paths]);
  const book = `/blade/client/reserver?pro=${data.provider_id}`;
  const modes = allowedModes(page.booking_modes);
  const place = data.is_lcs ? DOMICILE_ADDRESS : page.salon_address;
  const avg = data.reviews.length ? data.reviews.reduce((s, r) => s + r.rating, 0) / data.reviews.length : null;
  const gallery = page.gallery_paths.filter(p => urls[p]);

  const blocks: Record<string, ReactNode> = {
    services: <Section key="services" title="Prestations">{data.services.length ? <div className="blade-provider-list">{data.services.map(s => <article key={s.id}><div><h3>{s.name}</h3>{s.description && <p>{s.description}</p>}<small>{s.duration_minutes} min</small></div><strong>{fmtPrice(s.price)}</strong>{!preview && <BladeButton asChild variant="default"><Link to={`${book}&prestation=${s.id}`}>Réserver</Link></BladeButton>}</article>)}</div> : <EmptyState icon="scissors" title="Aucune prestation en ligne" compact />}</Section>,
    gallery: page.gallery_paths.length ? <Section key="gallery" title="Galerie"><div className="blade-gallery-grid">{gallery.map(p => <figure key={p}><img src={urls[p]} alt={`Réalisation de ${data.name}`} loading="lazy" /></figure>)}</div></Section> : null,
    reviews: <Section key="reviews" title="Avis clients">{data.reviews.length ? <ul className="blade-live-reviews">{data.reviews.map(r => <li key={r.id}><div><strong>{r.client_name}</strong><span aria-label={`${r.rating} sur 5`}><Stars value={r.rating} /></span></div>{r.comment && <p>{r.comment}</p>}<small>{new Date(r.created_at).toLocaleDateString('fr-FR')}</small></li>)}</ul> : <EmptyState icon="message" title="Pas encore d’avis" compact />}</Section>,
    hours: data.hours.length ? <Section key="hours" title="Horaires"><Hours hours={data.hours} /></Section> : null,
    map: (place || page.city || modes.includes('deplacement')) ? <Section key="map" title="Adresse et zone"><dl className="blade-key-values">
      {modes.includes('domicile') && <div><dt>Sur place</dt><dd>{place || page.city || 'Adresse communiquée à la réservation'}</dd></div>}
      {modes.includes('deplacement') && <div><dt>À domicile</dt><dd>{data.name} se déplace chez toi{page.city ? ` · autour de ${page.city}` : ''}</dd></div>}
    </dl>{(place || page.city) && <p><a className="blade-text-link" href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(place || page.city || '')}`} target="_blank" rel="noopener noreferrer">Voir sur la carte <ArrowRight size={16} /></a></p>}</Section> : null,
  };

  return <BrandScope accent={page.accent_color} font={page.font_key}>
    <header className="blade-brand-hero">
      <div className="blade-brand-cover">{page.cover_path && urls[page.cover_path] && <img src={urls[page.cover_path]} alt="" />}</div>
      <div className="blade-brand-identity">
        <BrandLogo url={page.logo_path ? urls[page.logo_path] : undefined} name={data.name} />
        <div><p className="blade-eyebrow">Professionnel</p><h1>{data.name}</h1>{data.is_premium && <VerifiedBadge/>}{page.city && <p>{page.city}</p>}
          {avg !== null && <span className="blade-rating" aria-label={`Note ${avg.toFixed(1)} sur 5, ${data.reviews.length} avis`}><strong>{avg.toFixed(1).replace('.', ',')}</strong><Stars value={avg} /><small>({data.reviews.length})</small></span>}</div>
        {!preview && <BladeButton asChild variant="default"><Link to={book}>Réserver</Link></BladeButton>}
      </div>
      {page.bio && <p className="blade-brand-bio">{page.bio}</p>}
      {(page.instagram || page.tiktok) && <p className="blade-brand-links">
        {page.instagram && <a href={`https://instagram.com/${page.instagram}`} target="_blank" rel="noopener noreferrer">Instagram @{page.instagram}</a>}
        {page.tiktok && <a href={`https://www.tiktok.com/@${page.tiktok}`} target="_blank" rel="noopener noreferrer">TikTok @{page.tiktok}</a>}
      </p>}
    </header>
    {page.sections.map(k => blocks[k])}
  </BrandScope>;
}
