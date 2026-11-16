import { Link } from 'react-router-dom';
import { Check, ArrowRight } from 'lucide-react';
import { BladeButton } from './common';
import { useBladePreferences, type Language } from './preferences';
import { SiteNav, SiteFooter, useHashScroll } from './site-nav';
import { useSession } from './data';

type Plan = { id: 'free' | 'pro' | 'premium'; name: string; price: string; period: string; tagline: string; features: string[]; cta: string; badge?: string };
type PricingCopy = { eyebrow: string; title: string; lead: string; note: string; plans: Plan[] };

const signup = '/blade/connexion?espace=pro&mode=inscription';

const copy: Record<Language, PricingCopy> = {
  fr: {
    eyebrow: 'Pour les prestataires',
    title: 'Des plans simples pour développer ton activité',
    lead: 'Commence gratuitement, puis passe au plan qui te correspond. Sans engagement.',
    note: 'Prix TTC. Paiement annuel : 2 mois offerts.',
    plans: [
      { id: 'free', name: 'Découverte', price: '0 €', period: '/mois', tagline: 'Pour te lancer sur BLADE.', cta: 'Commencer gratuitement',
        features: ['Profil visible dans la recherche', 'Jusqu’à 20 réservations par mois', 'Agenda et créneaux', 'Paiement sur place', '5 % de commission sur les paiements en ligne'] },
      { id: 'pro', name: 'Pro', price: '14,90 €', period: '/mois', tagline: 'Pour les barbers qui travaillent à plein temps.', cta: 'Essayer 30 jours gratuits', badge: 'Le plus choisi',
        features: ['Réservations illimitées', '0 % de commission', 'Carte de fidélité incluse (cartes NFC compatibles)', 'Acomptes en ligne contre les rendez-vous non honorés', 'Rappels automatiques aux clients', 'Galerie de réalisations et messagerie', 'Statistiques de base'] },
      { id: 'premium', name: 'Premium', price: '29,90 €', period: '/mois', tagline: 'Pour être vu en premier en Île-de-France.', cta: 'Passer Premium',
        features: ['Tout le plan Pro', 'Mise en avant dans les résultats de ta ville', 'Badge « Pro vérifié »', 'Suivi du trajet en direct à domicile', 'Statistiques avancées', 'Plusieurs barbers pour un salon'] },
    ],
  },
  en: {
    eyebrow: 'For professionals',
    title: 'Simple plans to grow your business',
    lead: 'Start for free, then switch to the plan that suits you. No commitment.',
    note: 'Prices include VAT. Yearly billing: 2 months free.',
    plans: [
      { id: 'free', name: 'Starter', price: '€0', period: '/month', tagline: 'To get started on BLADE.', cta: 'Start for free',
        features: ['Profile visible in search', 'Up to 20 bookings per month', 'Calendar and time slots', 'Pay on site', '5% fee on online payments'] },
      { id: 'pro', name: 'Pro', price: '€14.90', period: '/month', tagline: 'For full-time barbers.', cta: 'Try 30 days free', badge: 'Most popular',
        features: ['Unlimited bookings', '0% fee', 'Loyalty card included (NFC cards supported)', 'Online deposits against no-shows', 'Automatic client reminders', 'Work gallery and messaging', 'Basic statistics'] },
      { id: 'premium', name: 'Premium', price: '€29.90', period: '/month', tagline: 'To be seen first in Île-de-France.', cta: 'Go Premium',
        features: ['Everything in Pro', 'Featured in your city’s results', '“Verified pro” badge', 'Live travel tracking for home visits', 'Advanced statistics', 'Several barbers for one salon'] },
    ],
  },
  es: {
    eyebrow: 'Para profesionales',
    title: 'Planes sencillos para hacer crecer tu negocio',
    lead: 'Empieza gratis y luego elige el plan que te convenga. Sin permanencia.',
    note: 'Precios con IVA. Pago anual: 2 meses gratis.',
    plans: [
      { id: 'free', name: 'Descubrimiento', price: '0 €', period: '/mes', tagline: 'Para empezar en BLADE.', cta: 'Empezar gratis',
        features: ['Perfil visible en la búsqueda', 'Hasta 20 reservas al mes', 'Agenda y horarios', 'Pago en el lugar', '5 % de comisión en pagos online'] },
      { id: 'pro', name: 'Pro', price: '14,90 €', period: '/mes', tagline: 'Para barberos a tiempo completo.', cta: 'Probar 30 días gratis', badge: 'El más elegido',
        features: ['Reservas ilimitadas', '0 % de comisión', 'Tarjeta de fidelidad incluida (compatible NFC)', 'Anticipos online contra ausencias', 'Recordatorios automáticos', 'Galería de trabajos y mensajería', 'Estadísticas básicas'] },
      { id: 'premium', name: 'Premium', price: '29,90 €', period: '/mes', tagline: 'Para destacar en Île-de-France.', cta: 'Pasar a Premium',
        features: ['Todo el plan Pro', 'Destacado en los resultados de tu ciudad', 'Insignia «Pro verificado»', 'Seguimiento del trayecto en directo', 'Estadísticas avanzadas', 'Varios barberos para un salón'] },
    ],
  },
};

export function PricingPlans() {
  const { language } = useBladePreferences();
  const c = copy[language] ?? copy.fr;
  // Un prestataire connecté va directement à son abonnement ; les autres créent leur compte pro.
  const { session, isPro } = useSession();
  const target = (id: Plan['id']) => session && isPro ? (id === 'free' ? '/blade/pro' : `/blade/pro/abonnement?plan=${id}`) : signup;
  return <section id="tarifs" className="blade-pricing blade-reveal" aria-labelledby="blade-pricing-title">
    <div className="blade-pricing-head">
      <p className="blade-pricing-eyebrow">{c.eyebrow}</p>
      <h2 id="blade-pricing-title">{c.title}</h2>
      <p>{c.lead}</p>
    </div>
    <div className="blade-pricing-grid">
      {c.plans.map(plan => <article key={plan.id} className={`blade-plan${plan.badge ? ' blade-plan-featured' : ''}`}>
        {plan.badge && <span className="blade-plan-badge">{plan.badge}</span>}
        <h3>{plan.name}</h3>
        <p className="blade-plan-tagline">{plan.tagline}</p>
        <p className="blade-plan-price"><strong>{plan.price}</strong><span>{plan.period}</span></p>
        <ul>{plan.features.map(f => <li key={f}><Check size={18} aria-hidden="true" /><span>{f}</span></li>)}</ul>
        <BladeButton asChild variant={plan.badge ? 'default' : 'outline'} className="blade-plan-cta"><Link to={target(plan.id)}>{plan.cta} <ArrowRight size={18} aria-hidden="true" /></Link></BladeButton>
      </article>)}
    </div>
    <p className="blade-pricing-note">{c.note}</p>
  </section>;
}

// Page « Tarifs » accessible depuis la barre de navigation.
export function PricingPage() {
  useHashScroll();
  return <div className="bl-landing bl2 blade-app">
    <a href="#bl-main" className="blade-skip">Aller au contenu</a>
    <SiteNav />
    <main id="bl-main" className="bl2-main bl3-page">
      <PricingPlans />
    </main>
    <SiteFooter />
  </div>;
}
