// Sections de la page d'accueil BLADE : étapes, trajet estimé, Île-de-France, barbers, FAQ, appel final.
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, CalendarCheck, Calculator, Car, ChevronDown, Gift, MapPin, Percent, Scissors, Search } from 'lucide-react';
import { useBladePreferences, type Language } from './preferences';
import { CITIES } from './seo';

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

/* ---------- Comment ça marche ---------- */
export function HowItWorks() {
  const { language } = useBladePreferences();
  const c = L(language, {
    fr: { eyebrow: 'Comment ça marche', title: 'Ta coupe en trois étapes', steps: [['Cherche', 'Indique ta ville et choisis : ton barber vient chez toi, ou tu vas près de chez toi.'], ['Choisis', 'Compare les profils, les avis et les prix affichés avant de réserver.'], ['Ton barber arrive', 'Réserve ton créneau en ligne et suis son trajet estimé jusqu’à ta porte.']] },
    en: { eyebrow: 'How it works', title: 'Your haircut in three steps', steps: [['Search', 'Enter your city and choose: your barber comes to you, or you go nearby.'], ['Choose', 'Compare profiles, reviews and prices before you book.'], ['Your barber arrives', 'Book your slot online and follow their estimated trip to your door.']] },
    es: { eyebrow: 'Cómo funciona', title: 'Tu corte en tres pasos', steps: [['Busca', 'Indica tu ciudad y elige: tu barbero va a tu casa o vas cerca de ti.'], ['Elige', 'Compara perfiles, opiniones y precios antes de reservar.'], ['Tu barbero llega', 'Reserva online y sigue su trayecto estimado hasta tu puerta.']] },
  });
  const icons = [Search, Scissors, Car];
  return <section id="blade-gallery" className="bl-section bl-how" aria-labelledby="bl-how-title">
    <div className="bl-head bl-reveal"><p className="bl-eyebrow">{c.eyebrow}</p><h2 id="bl-how-title">{c.title}</h2></div>
    <ol className="bl-steps">
      {c.steps.map(([title, text], i) => { const Icon = icons[i]; return <li key={title} className="bl-step bl-reveal" style={{ transitionDelay: `${i * 90}ms` }}>
        <span className="bl-step-num" aria-hidden="true">{i + 1}</span>
        <span className="bl-step-icon" aria-hidden="true"><Icon size={26} /></span>
        <h3>{title}</h3><p>{text}</p>
      </li>; })}
    </ol>
  </section>;
}

/* ---------- Trajet estimé (atout unique) ---------- */
const ROUTE = 'M40 210 C 90 200, 110 150, 150 140 S 230 120, 250 80 S 300 40, 330 40';
export function TripShowcase() {
  const { language } = useBladePreferences();
  const c = L(language, {
    fr: { eyebrow: 'Exclusif BLADE', title: 'Suis ton barber jusqu’à ta porte', text: 'Dès qu’il part, tu vois son trajet estimé, l’heure d’arrivée et les éventuels retards. Plus besoin d’appeler pour savoir où il en est.', points: ['Heure d’arrivée estimée', 'Retards signalés en direct', 'Ta vie privée et la sienne respectées'], cta: 'Voir la démo', eta: 'Arrivée vers', live: 'Position estimée', min: 'min' },
    en: { eyebrow: 'Only on BLADE', title: 'Follow your barber to your door', text: 'As soon as they leave, you see their estimated trip, arrival time and any delays. No need to call.', points: ['Estimated arrival time', 'Delays shared live', 'Privacy respected on both sides'], cta: 'See the demo', eta: 'Arriving around', live: 'Estimated position', min: 'min' },
    es: { eyebrow: 'Exclusivo BLADE', title: 'Sigue a tu barbero hasta tu puerta', text: 'En cuanto sale, ves su trayecto estimado, la hora de llegada y los retrasos. Sin llamadas.', points: ['Hora de llegada estimada', 'Retrasos avisados en directo', 'Privacidad respetada'], cta: 'Ver la demo', eta: 'Llegada hacia', live: 'Posición estimada', min: 'min' },
  });
  const eta = new Date(Date.now() + 12 * 60000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
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
        <div className="bl-phone-map">
          <svg viewBox="0 0 370 250" preserveAspectRatio="xMidYMid slice">
            <defs><pattern id="bl-grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" fill="none" stroke="currentColor" strokeOpacity=".08" /></pattern></defs>
            <rect width="370" height="250" fill="url(#bl-grid)" />
            <path d="M0 120 H370 M190 0 V250 M0 60 L370 200" stroke="currentColor" strokeOpacity=".07" strokeWidth="14" fill="none" />
            <path d={ROUTE} fill="none" stroke="#8a6a55" strokeWidth="5" strokeDasharray="2 10" strokeLinecap="round" />
            <path d={ROUTE} fill="none" stroke="#4a2f22" strokeWidth="5" strokeLinecap="round" className="bl-route-done" pathLength={1} />
            <g transform="translate(330 40)"><circle r="16" fill="#fff" /><text textAnchor="middle" dy="6" fontSize="16">🏠</text></g>
            <g className="bl-car"><circle r="15" fill="#4a2f22" stroke="#fff" strokeWidth="3" /><text textAnchor="middle" dy="5" fontSize="13">✂️</text><animateMotion dur="9s" repeatCount="indefinite" path={ROUTE} keyPoints="0;1;1" keyTimes="0;0.82;1" calcMode="linear" /></g>
          </svg>
          <span className="bl-phone-tag">{c.live}</span>
        </div>
        <div className="bl-phone-card"><Car size={18} /><div><strong>{c.eta} {eta}</strong><small>~12 {c.min}</small></div></div>
      </div>
    </div>
  </section>;
}

/* ---------- Île-de-France ---------- */
export function IdfBand() {
  const { language } = useBladePreferences();
  const c = L(language, {
    fr: { eyebrow: 'Île-de-France', title: 'Disponible dans toute l’Île-de-France', text: 'Paris et sa petite couronne, et bien plus. Choisis ta ville :', all: 'Toutes les villes' },
    en: { eyebrow: 'Île-de-France', title: 'Available across Île-de-France', text: 'Paris, its suburbs and more. Pick your city:', all: 'All cities' },
    es: { eyebrow: 'Île-de-France', title: 'Disponible en toda Île-de-France', text: 'París, sus alrededores y más. Elige tu ciudad:', all: 'Todas las ciudades' },
  });
  const featured = ['paris', 'boulogne-billancourt', 'saint-denis', 'montreuil', 'nanterre', 'creteil', 'versailles', 'argenteuil', 'vitry-sur-seine', 'levallois-perret', 'aubervilliers', 'cergy'];
  const cities = featured.map(s => CITIES.find(x => x.slug === s)!).filter(Boolean);
  return <section className="bl-section bl-idf bl-reveal" aria-labelledby="bl-idf-title">
    <div className="bl-idf-head"><MapPin size={34} aria-hidden="true" /><div><p className="bl-eyebrow">{c.eyebrow}</p><h2 id="bl-idf-title">{c.title}</h2><p>{c.text}</p></div></div>
    <ul className="bl-idf-cities">
      {cities.map(city => <li key={city.slug}><Link to={`/blade/barber/${city.slug}`}>{city.name}</Link></li>)}
      <li><Link to="/blade/barber" className="is-all">{c.all} <ArrowRight size={16} aria-hidden="true" /></Link></li>
    </ul>
  </section>;
}

/* ---------- Bandeau barbers ---------- */
export function ProBand() {
  const { language } = useBladePreferences();
  const c = L(language, {
    fr: { eyebrow: 'Pour les barbers', title: 'Tu es barber ? Rejoins BLADE', text: 'Reçois des réservations près de chez toi et garde 100 % de tes prestations.', points: [['Aucune commission', 'Tes acomptes arrivent sur ton propre lien.'], ['Fidélité incluse', 'Carte de fidélité, compatible NFC, dès le plan Pro.'], ['Trajet estimé', 'Tes clients te suivent jusqu’à leur porte (Premium).']], cta: 'Voir les offres', calc: 'Calculer mes revenus' },
    en: { eyebrow: 'For barbers', title: 'Are you a barber? Join BLADE', text: 'Get bookings near you and keep 100% of your earnings.', points: [['No commission', 'Deposits go to your own link.'], ['Loyalty included', 'NFC-ready loyalty card from the Pro plan.'], ['Estimated trip', 'Clients follow you to their door (Premium).']], cta: 'See plans', calc: 'Estimate my income' },
    es: { eyebrow: 'Para barberos', title: '¿Eres barbero? Únete a BLADE', text: 'Recibe reservas cerca de ti y quédate con el 100 % de tus servicios.', points: [['Sin comisión', 'Los anticipos llegan a tu propio enlace.'], ['Fidelidad incluida', 'Tarjeta de fidelidad compatible NFC desde Pro.'], ['Trayecto estimado', 'Tus clientes te siguen hasta su puerta (Premium).']], cta: 'Ver planes', calc: 'Calcular mis ingresos' },
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
      ['Combien coûte une coupe sur BLADE ?', 'Chaque barber fixe ses prix, affichés avant de réserver. Pour une prestation à domicile, les frais de déplacement sont indiqués à l’avance.'],
      ['Le barber vient-il avec son matériel ?', 'Oui. Pour une prestation à domicile, il arrive avec tout le nécessaire. Prévois simplement une chaise et un point d’eau à proximité.'],
      ['Dois-je payer en ligne ?', 'Certains barbers demandent un acompte en ligne pour bloquer le créneau. Le reste se règle directement avec eux.'],
      ['Comment suivre l’arrivée de mon barber ?', 'Quand il part, tu reçois un lien vers son trajet estimé avec l’heure d’arrivée. Il signale aussi ses éventuels retards.'],
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
    fr: { title: 'Prêt pour ta prochaine coupe ?', text: 'Trouve ton barber en quelques secondes, chez toi ou près de toi.', cta: 'Trouver mon barber' },
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
