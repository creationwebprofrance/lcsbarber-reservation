// Sections de la page d'accueil BLADE : étapes, trajet estimé, Île-de-France, barbers, FAQ, appel final.
import { lazy, Suspense, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useMediaUrls } from './customization-data';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, CalendarCheck, Calculator, Car, ChevronDown, Clapperboard, Gift, Percent, Play } from 'lucide-react';
import { useBladePreferences, type Language } from './preferences';
import { Carousel } from './carousel';
import { cleanLogoStyle, logoStyleVars, type LogoStyle } from './customization-model';

const IdfMap = lazy(() => import('./idf-map'));
const TripPreview = lazy(() => import('./trip').then(m => ({ default: m.TripPreview })));

const L = <T,>(language: Language, m: Record<Language, T>) => m[language] ?? m.fr;

/** Fait apparaître en fondu les éléments .bl-reveal quand ils entrent à l'écran. */
/** Flèche qui sort à droite et revient par la gauche au survol du bouton. */
function ShiftArrow() {
  return <span className="bl-shift" aria-hidden="true"><ArrowRight size={18} className="bl-shift-a" /><ArrowRight size={18} className="bl-shift-b" /></span>;
}

export function useScrollReveal() {
  useEffect(() => {
    const els = [...document.querySelectorAll<HTMLElement>('.bl-reveal:not(.is-in)')];
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { els.forEach(e => e.classList.add('is-in')); return; }
    const io = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    els.forEach(e => io.observe(e));
    return () => io.disconnect();
  });
}

/* ---------- Vitrine des prestataires + comment ça marche ---------- */
type ShowItem = { provider_id: string; name: string; path: string; kind: 'image' | 'video'; logo_path?: string | null; logo_style?: LogoStyle | null };
const db = supabase as unknown as SupabaseClient;

/** Photos et vidéos publiées par les prestataires, avec leur nom ; « contenu bientôt » sinon. */
/** Logo rond du pro (même rendu que son profil, sans charger la page de profil). */
function ShowLogo({ url, name, logoStyle }: { url?: string; name: string; logoStyle?: LogoStyle | null }) {
  const bg = url ? cleanLogoStyle(logoStyle).bg : null;
  return <span className={`blade-brand-logo ${bg ? 'has-bg' : ''}`} style={url ? logoStyleVars(logoStyle) as React.CSSProperties : undefined} aria-hidden="true">{url ? <img src={url} alt="" draggable={false} /> : name.trim().slice(0, 1).toUpperCase() || 'B'}</span>;
}

function ProShowcase({ label, soon, soonText, see }: { label: string; soon: string; soonText: string; see: string }) {
  const [items, setItems] = useState<ShowItem[] | null>(null);
  useEffect(() => { db.rpc('blade_public_showcase').then(({ data }) => setItems((data as ShowItem[] | null) ?? []), () => setItems([])); }, []);
  const urls = useMediaUrls((items ?? []).flatMap(i => [i.path, i.logo_path]));
  const ready = (items ?? []).filter(i => urls[i.path]);
  if (items === null) return <div className="bl-show-skeleton" aria-hidden="true" />;
  const soonCard = (k: string) => <li key={k}><div className="bl-show-card is-soon"><Clapperboard size={30} aria-hidden="true" /><strong>{soon}</strong><span>{soonText}</span></div></li>;
  if (!ready.length) return <div className="bl-show-empty"><Clapperboard size={34} aria-hidden="true" /><strong>{soon}</strong><span>{soonText}</span></div>;
  return <Carousel label={label} className="bl-show">
    {ready.map(i => <li key={i.path}>
      <Link to={`/blade/profil/${i.provider_id}`} className="bl-show-card">
        {i.kind === 'video' ? <video src={urls[i.path]} muted loop playsInline autoPlay preload="metadata" aria-hidden="true" /> : <img src={urls[i.path]} alt={`Réalisation de ${i.name}`} loading="lazy" />}
        {i.kind === 'video' && <span className="bl-show-badge"><Play size={12} aria-hidden="true" />Vidéo</span>}
        <span className="bl-show-brand"><ShowLogo url={i.logo_path ? urls[i.logo_path] : undefined} name={i.name} logoStyle={i.logo_style} /><strong>{i.name}</strong></span>
        <span className="bl-show-meta"><em>{see} <ArrowRight size={14} aria-hidden="true" /></em></span>
      </Link>
    </li>)}
    {ready.length < 4 && Array.from({ length: 4 - ready.length }, (_, k) => soonCard(`soon-${k}`))}
  </Carousel>;
}

export function HowItWorks() {
  const { language } = useBladePreferences();
  const c = L(language, {
    fr: { eyebrow: 'Le travail de nos pros', title: 'Toute la coiffure, chez toi ou près de toi', soon: 'Le contenu arrive bientôt !', soonText: 'Les photos et vidéos de nos pros de la coiffure arrivent très vite.', see: 'Voir le profil', stepsTitle: 'Ta coupe en trois étapes', steps: [['Cherche', 'Ta ville, à domicile ou près de toi.'], ['Choisis', 'Profils, avis et prix affichés.'], ['Ton pro arrive', 'Suis son trajet jusqu’à ta porte.']] },
    en: { eyebrow: 'Our pros’ work', title: 'Every hair service, at home or nearby', soon: 'Content coming soon!', soonText: 'Photos and videos from our hair pros are on their way.', see: 'See profile', stepsTitle: 'Your haircut in three steps', steps: [['Search', 'Your city, at home or nearby.'], ['Choose', 'Profiles, reviews and prices shown.'], ['Your pro arrives', 'Follow their trip to your door.']] },
    es: { eyebrow: 'El trabajo de nuestros pros', title: 'Toda la peluquería, en casa o cerca', soon: '¡El contenido llega pronto!', soonText: 'Las fotos y vídeos de nuestros profesionales llegan muy pronto.', see: 'Ver perfil', stepsTitle: 'Tu corte en tres pasos', steps: [['Busca', 'Tu ciudad, a domicilio o cerca.'], ['Elige', 'Perfiles, opiniones y precios.'], ['Tu profesional llega', 'Sigue su trayecto hasta tu puerta.']] },
  });
  return <section id="blade-gallery" className="bl-section bl-how" aria-labelledby="bl-how-title">
    <div className="bl-head bl-reveal"><p className="bl-eyebrow">{c.eyebrow}</p><h2 id="bl-how-title">{c.title}</h2></div>
    <ProShowcase label={c.eyebrow} soon={c.soon} soonText={c.soonText} see={c.see} />
  </section>;
}

/* ---------- Trajet estimé (atout unique) ---------- */
export function TripShowcase() {
  const { language } = useBladePreferences();
  const c = L(language, {
    fr: { eyebrow: 'Exclusif BLADE', title: 'Suis ton coiffeur jusqu’à ta porte', text: 'Barber, coiffeuse, lockticien… dès qu’il part, tu vois son trajet estimé, l’heure d’arrivée et les éventuels retards. Plus besoin d’appeler pour savoir où il en est.', points: ['Heure d’arrivée estimée', 'Retards signalés en direct', 'Ta vie privée et la sienne respectées'], cta: 'Simuler avec mon adresse', eta: 'Arrivée vers', live: 'Position estimée', min: 'min' },
    en: { eyebrow: 'Only on BLADE', title: 'Follow your hairstylist to your door', text: 'As soon as they leave, you see their estimated trip, arrival time and any delays. No need to call.', points: ['Estimated arrival time', 'Delays shared live', 'Privacy respected on both sides'], cta: 'Try it with my address', eta: 'Arriving around', live: 'Estimated position', min: 'min' },
    es: { eyebrow: 'Exclusivo BLADE', title: 'Sigue a tu peluquero hasta tu puerta', text: 'En cuanto sale, ves su trayecto estimado, la hora de llegada y los retrasos. Sin llamadas.', points: ['Hora de llegada estimada', 'Retrasos avisados en directo', 'Privacidad respetada'], cta: 'Simular con mi dirección', eta: 'Llegada hacia', live: 'Posición estimada', min: 'min' },
  });
  return <section className="bl-section bl-trip" aria-labelledby="bl-trip-title">
    <div className="bl-trip-text bl-reveal">
      <p className="bl-eyebrow">{c.eyebrow}</p>
      <h2 id="bl-trip-title">{c.title}</h2>
      <p>{c.text}</p>
      <ul>{c.points.map(p => <li key={p}><BadgeCheck size={18} aria-hidden="true" />{p}</li>)}</ul>
      <Link to="/blade/trajet/demo" className="bl-shift-btn bl3-btn bl3-btn-solid">{c.cta} <ShiftArrow /></Link>
    </div>
    <div className="bl-trip-visual bl-reveal" aria-hidden="true">
      <div className="bl-phone">
        <span className="bl-phone-notch" />
        <Suspense fallback={<div className="bl-phone-screen"><div className="bl-phone-map" /></div>}>
          <TripPreview live={c.live} eta={c.eta} />
        </Suspense>
      </div>
    </div>
  </section>;
}

/* ---------- Île-de-France ---------- */
export function IdfBand() {
  const { language } = useBladePreferences();
  const c = L(language, {
    fr: { eyebrow: 'Île-de-France', title: 'Disponible dans toute l’Île-de-France', text: 'BLADE se lance en Île-de-France : de nouveaux pros de la coiffure rejoignent la plateforme chaque semaine.', cta: 'Explorer autour de moi', pts: [['8', 'départements couverts'], ['À domicile', 'ou en salon'], ['Chaque semaine', 'de nouveaux pros']] },
    en: { eyebrow: 'Île-de-France', title: 'Available across Île-de-France', text: 'BLADE is launching in Île-de-France: new hair professionals join every week.', cta: 'Explore near me', pts: [['8', 'departments covered'], ['At home', 'or in a salon'], ['Every week', 'new pros join']] },
    es: { eyebrow: 'Île-de-France', title: 'Disponible en toda Île-de-France', text: 'BLADE se lanza en Île-de-France: cada semana se unen nuevos profesionales.', cta: 'Explorar cerca de mí', pts: [['8', 'departamentos'], ['A domicilio', 'o en salón'], ['Cada semana', 'nuevos profesionales']] },
  });
  return <section className="bl-section bl-idf bl-reveal" aria-labelledby="bl-idf-title">
    <div className="bl-idf-text">
      <h2 id="bl-idf-title">{c.title}</h2>
      <Link to="/blade/client" className="bl-shift-btn bl3-btn bl3-btn-solid">{c.cta} <ShiftArrow /></Link>
    </div>
    <div className="bl-idf-map" aria-hidden="true">
      <Suspense fallback={<div className="bl-idf-leaflet" />}><IdfMap /></Suspense>
    </div>
  </section>;
}

/* ---------- Bandeau barbers ---------- */
export function ProBand() {
  const { language } = useBladePreferences();
  const c = L(language, {
    fr: { eyebrow: 'Pour les pros de la coiffure', title: 'Barber, coiffeur·se, lockticien·ne ? Rejoins BLADE', text: 'Reçois des réservations près de chez toi et garde 100 % de tes prestations.', points: [['Aucune commission', 'Tes acomptes arrivent sur ton propre lien.'], ['Fidélité incluse', 'Carte de fidélité, compatible NFC, dès le plan Pro.'], ['Trajet estimé', 'Tes clients te suivent jusqu’à leur porte (Premium).']], cta: 'Voir les offres', calc: 'Calculer mes revenus' },
    en: { eyebrow: 'For hair professionals', title: 'Barber, hairstylist, loctician? Join BLADE', text: 'Get bookings near you and keep 100% of your earnings.', points: [['No commission', 'Deposits go to your own link.'], ['Loyalty included', 'NFC-ready loyalty card from the Pro plan.'], ['Estimated trip', 'Clients follow you to their door (Premium).']], cta: 'See plans', calc: 'Estimate my income' },
    es: { eyebrow: 'Para profesionales del cabello', title: '¿Barbero, peluquero, loctician? Únete a BLADE', text: 'Recibe reservas cerca de ti y quédate con el 100 % de tus servicios.', points: [['Sin comisión', 'Los anticipos llegan a tu propio enlace.'], ['Fidelidad incluida', 'Tarjeta de fidelidad compatible NFC desde Pro.'], ['Trayecto estimado', 'Tus clientes te siguen hasta su puerta (Premium).']], cta: 'Ver planes', calc: 'Calcular mis ingresos' },
  });
  const icons = [Percent, Gift, Car];
  return <section className="bl-section bl-pro bl-reveal" aria-labelledby="bl-pro-title">
    <div className="bl-pro-intro"><p className="bl-eyebrow">{c.eyebrow}</p><h2 id="bl-pro-title">{c.title}</h2><p>{c.text}</p>
      <div className="bl-pro-actions"><Link to="/blade/tarifs" className="bl3-btn bl3-btn-light">{c.cta} <ArrowRight size={18} aria-hidden="true" /></Link><Link to="/blade/outils/calculateur-barber" className="bl3-btn bl3-btn-line"><Calculator size={18} aria-hidden="true" />{c.calc}</Link></div>
    </div>
    <ul className="bl-pro-points">{c.points.map(([t, d], i) => { const Icon = icons[i]; return <li key={t}><Icon size={22} aria-hidden="true" /><div><strong>{t}</strong><span>{d}</span></div></li>; })}</ul>
  </section>;
}

/* ---------- FAQ (avec données structurées pour Google) ---------- */
export function Faq() {
  const { language } = useBladePreferences();
  const c = L(language, {
    fr: { eyebrow: 'Questions fréquentes', title: 'Tu te poses une question ?', items: [
      ['Combien coûte une prestation sur BLADE ?', 'Chaque professionnel fixe ses prix, affichés avant de réserver. Pour une prestation à domicile, les frais de déplacement sont indiqués à l’avance.'],
      ['Le professionnel vient-il avec son matériel ?', 'Oui. Pour une prestation à domicile, il arrive avec tout le nécessaire. Prévois simplement une chaise et un point d’eau à proximité.'],
      ['Dois-je payer en ligne ?', 'Certains professionnels demandent un acompte en ligne pour bloquer le créneau. Le reste se règle directement avec eux.'],
      ['Comment suivre l’arrivée de mon professionnel ?', 'Quand il part, tu reçois un lien vers son trajet estimé avec l’heure d’arrivée. Il signale aussi ses éventuels retards.'],
      ['Dans quelles villes BLADE est-il disponible ?', 'BLADE se lance en Île-de-France : Paris, Hauts-de-Seine, Seine-Saint-Denis, Val-de-Marne et au-delà.'],
    ] },
    en: { eyebrow: 'FAQ', title: 'Got a question?', items: [
      ['How much does a haircut cost?', 'Each barber sets their own prices, shown before you book. For home visits, travel fees are shown upfront.'],
      ['Does the barber bring their equipment?', 'Yes. For home visits they bring everything. Just have a chair and water nearby.'],
      ['Do I have to pay online?', 'Some barbers ask for an online deposit to hold the slot. The rest is paid to them directly.'],
      ['How do I follow my barber?', 'When they leave, you get a link to their estimated trip and arrival time. They also report delays.'],
      ['Where is BLADE available?', 'BLADE is launching in Île-de-France: Paris and the surrounding departments.'],
    ] },
    es: { eyebrow: 'Preguntas frecuentes', title: '¿Tienes una pregunta?', items: [
      ['¿Cuánto cuesta un corte?', 'Cada barbero fija sus precios, visibles antes de reservar. A domicilio, los gastos de desplazamiento se indican antes.'],
      ['¿El barbero trae su material?', 'Sí. A domicilio llega con todo lo necesario. Solo prepara una silla y agua cerca.'],
      ['¿Tengo que pagar online?', 'Algunos barberos piden un anticipo online para reservar. El resto se paga directamente.'],
      ['¿Cómo sigo a mi barbero?', 'Cuando sale, recibes un enlace a su trayecto estimado con la hora de llegada.'],
      ['¿Dónde está disponible BLADE?', 'BLADE empieza en Île-de-France: París y alrededores.'],
    ] },
  });
  useEffect(() => {
    const el = document.createElement('script'); el.type = 'application/ld+json'; el.id = 'bl-faq-ld';
    el.text = JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: c.items.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) });
    document.getElementById('bl-faq-ld')?.remove(); document.head.appendChild(el);
    return () => el.remove();
  }, [language]); // eslint-disable-line react-hooks/exhaustive-deps
  return <section className="bl-section bl-faq" aria-labelledby="bl-faq-title">
    <div className="bl-head bl-reveal"><p className="bl-eyebrow">{c.eyebrow}</p><h2 id="bl-faq-title">{c.title}</h2></div>
    <div className="bl-faq-list">{c.items.map(([q, a]) => <details key={q} className="bl-reveal"><summary>{q}<ChevronDown size={20} aria-hidden="true" /></summary><p>{a}</p></details>)}</div>
  </section>;
}

/* ---------- Appel final ---------- */
export function FinalCta() {
  const { language } = useBladePreferences();
  const c = L(language, {
    fr: { title: 'Prêt pour ta prochaine coupe ?', text: 'Barber, coiffeuse, lockticien… trouve ton pro en quelques secondes, chez toi ou près de toi.', cta: 'Trouver mon pro' },
    en: { title: 'Ready for your next cut?', text: 'Find your barber in seconds, at home or nearby.', cta: 'Find my barber' },
    es: { title: '¿Listo para tu próximo corte?', text: 'Encuentra a tu barbero en segundos, en casa o cerca.', cta: 'Encontrar mi barbero' },
  });
  return <section className="bl-section bl-final bl-reveal" aria-labelledby="bl-final-title">
    <CalendarCheck size={34} aria-hidden="true" />
    <h2 id="bl-final-title">{c.title}</h2>
    <p>{c.text}</p>
    <Link to="/blade/client" className="bl-shift-btn bl3-btn bl3-btn-light">{c.cta} <ShiftArrow /></Link>
  </section>;
}
