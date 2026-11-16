import { Star, Quote } from 'lucide-react';
import { useReviews } from './data';
import { useBladePreferences, type Language } from './preferences';

const copy: Record<Language, { eyebrow: string; title: string; out: (n: number) => string }> = {
  fr: { eyebrow: 'Avis clients', title: 'Ils sont repartis avec le sourire', out: n => `sur ${n} avis` },
  en: { eyebrow: 'Client reviews', title: 'They left with a smile', out: n => `from ${n} reviews` },
  es: { eyebrow: 'Opiniones', title: 'Salieron con una sonrisa', out: n => `de ${n} opiniones` },
};

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return <span className="bl-reviews-stars" aria-label={`${value} sur 5`}>{[1, 2, 3, 4, 5].map(i => <Star key={i} size={size} className={i <= Math.round(value) ? 'on' : ''} aria-hidden="true" />)}</span>;
}

// Vrais avis laissés par les clients : la section ne s'affiche que s'il y en a.
export function ReviewsBand() {
  const { language } = useBladePreferences();
  const c = copy[language] ?? copy.fr;
  const { data } = useReviews();
  const reviews = (data ?? []).filter(r => r.rating > 0);
  if (!reviews.length) return null;
  const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  const shown = reviews.filter(r => r.comment && r.comment.trim().length > 12).slice(0, 3);
  const date = (iso: string) => new Date(iso).toLocaleDateString(language === 'en' ? 'en-GB' : language === 'es' ? 'es-ES' : 'fr-FR', { month: 'long', year: 'numeric' });
  return <section className="bl-reviews-band blade-reveal" aria-labelledby="bl-reviews-title">
    <div className="bl-reviews-head">
      <div><p className="blade-pricing-eyebrow">{c.eyebrow}</p><h2 id="bl-reviews-title">{c.title}</h2></div>
      <div className="bl-reviews-score"><strong>{avg.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}</strong><div><Stars value={avg} size={18} /><span>{c.out(reviews.length)}</span></div></div>
    </div>
    {shown.length > 0 && <ul className="bl-reviews-list">{shown.map(r => <li key={r.id}>
      <Quote size={22} aria-hidden="true" />
      <p>{r.comment}</p>
      <footer><strong>{r.client_name.split(' ')[0]}</strong><Stars value={r.rating} /><small>{date(r.created_at)}</small></footer>
    </li>)}</ul>}
  </section>;
}
