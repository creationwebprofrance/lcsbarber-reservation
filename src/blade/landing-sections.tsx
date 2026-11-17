// Sections de la page d'accueil BLADE : étapes, trajet estimé, Île-de-France, barbers, FAQ, appel final.
import { lazy, Suspense, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Baby, BadgeCheck, CalendarCheck, Calculator, Car, ChevronDown, Droplets, Gift, Infinity as InfinityIcon, MapPin, Palette, Percent, Scissors, Search, Sparkles, Waves, Wind } from 'lucide-react';
import { useBladePreferences, type Language } from './preferences';
import { Carousel } from './carousel';

const TripPreview = lazy(() => import('./trip').then(m => ({ default: m.TripPreview })));

const L = <T,>(language: Language, m: Record<Language, T>) => m[language] ?? m.fr;

/** Fait apparaître en fondu les éléments .bl-reveal quand ils entrent à l'écran. */
export function useScrollReveal() {
  useEffect(() => {
    const els = [...document.querySelectorAll<HTMLElement>('.bl-reveal:not(.is-in)')];
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { els.forEach(e => e.classList.add('is-in')); return; }
    const io = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    els.forEach(e => io.observe(e));
    return () => io.disconnect();
  });
}

/* ---------- Prestations + comment ça marche ---------- */
type Presta = { icon: typeof Scissors; tone: string; t: Record<Language, [string, string]> };
const PRESTAS: Presta[] = [
  { icon: Scissors, tone: 'a', t: { fr: ['Dégradé & coupe homme', 'Taper, fade, contours nets'], en: ['Fades & men’s cuts', 'Taper, fade, sharp line-ups'], es: ['Degradado y corte hombre', 'Taper, fade, contornos'] } },
  { icon: Sparkles, tone: 'b', t: { fr: ['Taille de barbe', 'Traçage, rasage, soin'], en: ['Beard trim', 'Shaping, shave, care'], es: ['Arreglo de barba', 'Perfilado, afeitado, cuidado'] } },
  { icon: Wind, tone: 'c', t: { fr: ['Coupe & brushing femme', 'Coupe, mise en forme, coiffage'], en: ['Women’s cut & blow-dry', 'Cut, shaping, styling'], es: ['Corte y peinado mujer', 'Corte, forma, peinado'] } },
  { icon: Waves, tone: 'd', t: { fr: ['Tresses & nattes', 'Box braids, cornrows, nattes collées'], en: ['Braids', 'Box braids, cornrows'], es: ['Trenzas', 'Box braids, cornrows'] } },
  { icon: InfinityIcon, tone: 'a', t: { fr: ['Locks', 'Création, resserrage, entretien'], en: ['Locs', 'Starter locs, retwist, care'], es: ['Locks', 'Creación, mantenimiento'] } },
  { icon: Palette, tone: 'b', t: { fr: ['Coloration & mèches', 'Couleur, balayage, décoloration'], en: ['Colour & highlights', 'Colour, balayage, bleach'], es: ['Color y mechas', 'Color, balayage'] } },
  { icon: Droplets, tone: 'c', t: { fr: ['Soins du cheveu', 'Hydratation, soin profond'], en: ['Hair care', 'Hydration, deep treatment'], es: ['Cuidado capilar', 'Hidratación, tratamiento'] } },
  { icon: Baby, tone: 'd', t: { fr: ['Coupe enfant', 'Patience et douceur à domicile'], en: ['Kids’ cuts', 'Gentle, at home'], es: ['Corte niños', 'Con paciencia, a domicilio'] } },
];

export function HowItWorks() {
  const { language } = useBladePreferences();
  const c = L(language, {
    fr: { eyebrow: 'Nos prestations', title: 'Toute la coiffure, chez toi ou près de toi', find: 'Trouver un pro', stepsTitle: 'Ta coupe en trois étapes', steps: [['Cherche', 'Ta ville, à domicile ou près de toi.'], ['Choisis', 'Profils, avis et prix affichés.'], ['Ton pro arrive', 'Suis son trajet jusqu’à ta porte.']] },
    en: { eyebrow: 'Services', title: 'Every hair service, at home or nearby', find: 'Find a pro', stepsTitle: 'Your haircut in three steps', steps: [['Search', 'Your city, at home or nearby.'], ['Choose', 'Profiles, reviews and prices shown.'], ['Your pro arrives', 'Follow their trip to your door.']] },
    es: { eyebrow: 'Servicios', title: 'Toda la peluquería, en casa o cerca', find: 'Encontrar un profesional', stepsTitle: 'Tu corte en tres pasos', steps: [['Busca', 'Tu ciudad, a domicilio o cerca.'], ['Elige', 'Perfiles, opiniones y precios.'], ['Tu profesional llega', 'Sigue su trayecto hasta tu puerta.']] },
  });
  const icons = [Search, Scissors, Car];
  return <section id="blade-gallery" className="bl-section bl-how" aria-labelledby="bl-how-title">
    <div className="bl-head bl-reveal"><p className="bl-eyebrow">{c.eyebrow}</p><h2 id="bl-how-title">{c.title}</h2></div>
    <Carousel label={c.eyebrow} className="bl-prestas bl-reveal">
      {PRESTAS.map(p => { const [name, sub] = p.t[language] ?? p.t.fr; const Icon = p.icon; return <li key={name}>
        <Link to="/blade/client" className={`bl-presta bl-presta-${p.tone}`}>
          <Icon className="bl-presta-bg" size={150} strokeWidth={1.1} aria-hidden="true" />
          <span className="bl-presta-icon" aria-hidden="true"><Icon size={22} /></span>
          <strong>{name}</strong><span>{sub}</span>
          <em>{c.find} <ArrowRight size={15} aria-hidden="true" /></em>
        </Link>
      </li>; })}
    </Carousel>
    <div className="bl-steps-block bl-reveal">
      <h3>{c.stepsTitle}</h3>
      <ol className="bl-steps">
        {c.steps.map(([title, text], i) => { const Icon = icons[i]; return <li key={title} className="bl-step">
          <span className="bl-step-icon" aria-hidden="true"><Icon size={20} /></span>
          <div><strong><span className="bl-step-num">{i + 1}.</span> {title}</strong><p>{text}</p></div>
        </li>; })}
      </ol>
    </div>
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
      <Link to="/blade/trajet/demo" className="bl3-btn bl3-btn-solid">{c.cta} <ArrowRight size={18} aria-hidden="true" /></Link>
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
  // Points lumineux autour de Paris (décoratifs, sans noms de villes).
  const dots: [number, number, number][] = [[200, 150, 0], [160, 120, .4], [245, 118, .9], [230, 190, 1.3], [150, 185, .6], [110, 140, 1.8], [290, 160, 1.1], [205, 75, 2.1], [195, 228, 1.6], [300, 95, 2.4], [95, 95, 2.8], [280, 225, .2]];
  return <section className="bl-section bl-idf bl-reveal" aria-labelledby="bl-idf-title">
    <div className="bl-idf-text">
      <p className="bl-eyebrow"><MapPin size={14} aria-hidden="true" /> {c.eyebrow}</p>
      <h2 id="bl-idf-title">{c.title}</h2>
      <p>{c.text}</p>
      <ul className="bl-idf-pts">{c.pts.map(([a, b]) => <li key={a}><strong>{a}</strong><span>{b}</span></li>)}</ul>
      <Link to="/blade/client" className="bl3-btn bl3-btn-solid">{c.cta} <ArrowRight size={18} aria-hidden="true" /></Link>
    </div>
    <div className="bl-idf-map" aria-hidden="true">
      <svg viewBox="0 0 400 300">
        <path className="bl-idf-region" d="M120 38 L196 22 L280 34 L346 70 L372 140 L350 214 L292 266 L206 282 L126 262 L60 214 L34 142 L58 80 Z" />
        {[44, 84, 124].map(r => <circle key={r} cx="200" cy="150" r={r} className="bl-idf-ring" />)}
        <path className="bl-idf-river" d="M40 120 C 90 110, 120 170, 165 160 S 230 120, 270 150 S 330 200, 370 190" />
        {dots.map(([x, y, d], i) => <g key={i} transform={`translate(${x} ${y})`}>
          <circle r="11" className="bl-idf-pulse" style={{ animationDelay: `${d}s` }} />
          <circle r={i === 0 ? 7 : 4.5} className={i === 0 ? 'bl-idf-core' : 'bl-idf-dot'} />
        </g>)}
      </svg>
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
    <Link to="/blade/client" className="bl3-btn bl3-btn-light">{c.cta} <ArrowRight size={18} aria-hidden="true" /></Link>
  </section>;
}
