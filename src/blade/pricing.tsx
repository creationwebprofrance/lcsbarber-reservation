import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ArrowRight, Minus } from 'lucide-react';
import { BladeButton } from './common';
import { useBladePreferences, type Language } from './preferences';
import { SiteNav, SiteFooter, useHashScroll } from './site-nav';
import { useSession } from './data';
import { FEATURE_TABLES, type Cell } from './plan-features';

type Billing = 'month' | 'year';
// yearly : prix facturé une fois par an ; yearlyMonth : son équivalent mensuel affiché en grand.
type Plan = { id: 'free' | 'pro' | 'premium'; name: string; price: string; yearly?: string; yearlyMonth?: string; tagline: string; features: string[]; cta: string; badge?: string };
type PricingCopy = { eyebrow: string; title: string; lead: string; pitch: string; monthly: string; annual: string; save: string; period: string; billedYearly: (amount: string) => string; note: string; plans: Plan[] };

const signup = '/blade/connexion?espace=pro&mode=inscription';

// Grille de novembre 2026 : Pro 19,90 €, Premium 39,90 € ; annuel = 12 mois - 10 % (mêmes montants
// que supabase/functions/blade-subscription/index.ts).
const copy: Record<Language, PricingCopy> = {
  fr: {
    eyebrow: 'Pour les prestataires',
    title: 'Des plans simples pour développer ton activité',
    lead: 'Commence gratuitement, puis passe au plan qui te correspond. Sans engagement, sans commission.',
    pitch: 'Un rendez-vous manqué évité par mois, et le plan Pro est remboursé.',
    monthly: 'Mensuel', annual: 'Annuel', save: '-10 %', period: '/mois',
    billedYearly: a => `soit ${a} facturés par an`,
    note: 'TVA non applicable, art. 293 B du CGI. Annuel : 10 % d’économie, payé en une fois. Résiliable à tout moment.',
    plans: [
      { id: 'free', name: 'Découverte', price: '0 €', tagline: 'Pour te lancer sur BLADE.', cta: 'Commencer gratuitement',
        features: ['Profil visible dans la recherche', 'Jusqu’à 20 réservations par mois', 'Agenda, horaires et congés', 'Mails de confirmation et d’annulation', 'Aucune commission sur tes prestations'] },
      { id: 'pro', name: 'Pro', price: '19,90 €', yearly: '214,90 €', yearlyMonth: '17,91 €', tagline: 'Pour remplir ton agenda sans rendez-vous perdus.', cta: 'Passer Pro', badge: 'Le plus choisi',
        features: ['Tout le plan Découverte', 'Réservations illimitées', 'Acomptes en ligne contre les rendez-vous non honorés', 'Rappel automatique la veille du rendez-vous', '100 relances clients par mois', 'Carte de fidélité pour 50 clients', 'Suivi de ton véhicule et de ses entretiens'] },
      { id: 'premium', name: 'Premium', price: '39,90 €', yearly: '430,90 €', yearlyMonth: '35,91 €', tagline: 'Pour être trouvé en premier en Île-de-France.', cta: 'Passer Premium',
        features: ['Tout le plan Pro, sans ses limites', 'Relances clients illimitées (200 mails par jour au plus)', 'Carte de fidélité illimitée (cartes NFC compatibles)', 'Pourboires en ligne par ton lien Stripe ou Revolut', 'Suivi du trajet en direct à domicile pour ton client', 'Modèles de page Vitrine et Salon', 'Mise en avant dans ta ville et badge « Pro vérifié »', 'Boutique en ligne pour vendre tes produits (bientôt)'] },
    ],
  },
  en: {
    eyebrow: 'For professionals',
    title: 'Simple plans to grow your business',
    lead: 'Start for free, then switch to the plan that suits you. No commitment, no commission.',
    pitch: 'Avoid one missed appointment a month and the Pro plan pays for itself.',
    monthly: 'Monthly', annual: 'Yearly', save: '-10%', period: '/month',
    billedYearly: a => `i.e. ${a} billed yearly`,
    note: 'VAT not applicable (French tax code, art. 293 B). Yearly: save 10%, paid once. Cancel anytime.',
    plans: [
      { id: 'free', name: 'Starter', price: '€0', tagline: 'To get started on BLADE.', cta: 'Start for free',
        features: ['Profile visible in search', 'Up to 20 bookings per month', 'Calendar, hours and days off', 'Confirmation and cancellation emails', 'No fee on your services'] },
      { id: 'pro', name: 'Pro', price: '€19.90', yearly: '€214.90', yearlyMonth: '€17.91', tagline: 'To fill your calendar without lost appointments.', cta: 'Go Pro', badge: 'Most popular',
        features: ['Everything in Starter', 'Unlimited bookings', 'Online deposits against no-shows', 'Automatic reminder the day before', '100 client follow-ups a month', 'Loyalty card for 50 clients', 'Vehicle and servicing tracking'] },
      { id: 'premium', name: 'Premium', price: '€39.90', yearly: '€430.90', yearlyMonth: '€35.91', tagline: 'To be found first in Île-de-France.', cta: 'Go Premium',
        features: ['Everything in Pro, without its limits', 'Unlimited client follow-ups (up to 200 emails a day)', 'Unlimited loyalty card (NFC cards supported)', 'Online tips through your Stripe or Revolut link', 'Live travel tracking for your client', 'Showcase and Salon page layouts', 'Featured in your city and “Verified pro” badge', 'Online shop for your products (coming soon)'] },
    ],
  },
  es: {
    eyebrow: 'Para profesionales',
    title: 'Planes sencillos para hacer crecer tu negocio',
    lead: 'Empieza gratis y luego elige el plan que te convenga. Sin permanencia, sin comisión.',
    pitch: 'Evita una cita perdida al mes y el plan Pro se paga solo.',
    monthly: 'Mensual', annual: 'Anual', save: '-10 %', period: '/mes',
    billedYearly: a => `es decir ${a} facturados al año`,
    note: 'IVA no aplicable (código fiscal francés, art. 293 B). Anual: 10 % de ahorro, pago único. Cancela cuando quieras.',
    plans: [
      { id: 'free', name: 'Descubrimiento', price: '0 €', tagline: 'Para empezar en BLADE.', cta: 'Empezar gratis',
        features: ['Perfil visible en la búsqueda', 'Hasta 20 reservas al mes', 'Agenda, horarios y vacaciones', 'E-mails de confirmación y cancelación', 'Sin comisión sobre tus servicios'] },
      { id: 'pro', name: 'Pro', price: '19,90 €', yearly: '214,90 €', yearlyMonth: '17,91 €', tagline: 'Para llenar tu agenda sin citas perdidas.', cta: 'Pasar a Pro', badge: 'El más elegido',
        features: ['Todo el plan Descubrimiento', 'Reservas ilimitadas', 'Anticipos online contra ausencias', 'Recordatorio automático la víspera', '100 recordatorios a clientes al mes', 'Tarjeta de fidelidad para 50 clientes', 'Seguimiento del vehículo y su mantenimiento'] },
      { id: 'premium', name: 'Premium', price: '39,90 €', yearly: '430,90 €', yearlyMonth: '35,91 €', tagline: 'Para aparecer primero en Île-de-France.', cta: 'Pasar a Premium',
        features: ['Todo el plan Pro, sin sus límites', 'Recordatorios a clientes ilimitados (hasta 200 e-mails al día)', 'Tarjeta de fidelidad ilimitada (compatible NFC)', 'Propinas online con tu enlace Stripe o Revolut', 'Seguimiento del trayecto en directo para tu cliente', 'Modelos de página Escaparate y Salón', 'Destacado en tu ciudad e insignia «Pro verificado»', 'Tienda online para tus productos (próximamente)'] },
    ],
  },
};

export function PricingPlans() {
  const { language } = useBladePreferences();
  const c = copy[language] ?? copy.fr;
  const [billing, setBilling] = useState<Billing>('month');
  // Un prestataire connecté va directement à son abonnement ; les autres créent leur compte pro.
  const { session, isPro } = useSession();
  const target = (id: Plan['id']) => session && isPro ? (id === 'free' ? '/blade/pro' : `/blade/pro/abonnement?plan=${id}${billing === 'year' ? '&billing=year' : ''}`) : signup;
  return <section id="tarifs" className="blade-pricing blade-reveal" aria-labelledby="blade-pricing-title">
    <div className="blade-pricing-head">
      <p className="blade-pricing-eyebrow">{c.eyebrow}</p>
      <h2 id="blade-pricing-title">{c.title}</h2>
      <p>{c.lead}</p>
    </div>
    <div className="blade-pricing-bar">
      <div className="blade-billing-toggle" role="group" aria-label={`${c.monthly} / ${c.annual}`}>
        <button type="button" aria-pressed={billing === 'month'} onClick={() => setBilling('month')}>{c.monthly}</button>
        <button type="button" aria-pressed={billing === 'year'} onClick={() => setBilling('year')}>{c.annual} <span className="blade-billing-save">{c.save}</span></button>
      </div>
      <p className="blade-pricing-pitch">{c.pitch}</p>
    </div>
    <div className="blade-pricing-grid">
      {c.plans.map(plan => {
        const yearly = billing === 'year' && plan.yearly ? plan.yearly : null;
        return <article key={plan.id} className={`blade-plan${plan.badge ? ' blade-plan-featured' : ''}`}>
          {plan.badge && <span className="blade-plan-badge">{plan.badge}</span>}
          <h3>{plan.name}</h3>
          <p className="blade-plan-tagline">{plan.tagline}</p>
          <p className="blade-plan-price"><strong>{yearly ? plan.yearlyMonth : plan.price}</strong><span>{c.period}</span></p>
          <p className="blade-plan-billed">{yearly ? c.billedYearly(yearly) : ' '}</p>
          <ul>{plan.features.map(f => <li key={f}><Check size={18} aria-hidden="true" /><span>{f}</span></li>)}</ul>
          <BladeButton asChild variant={plan.badge ? 'default' : 'outline'} className="blade-plan-cta"><Link to={target(plan.id)}>{plan.cta} <ArrowRight size={18} aria-hidden="true" /></Link></BladeButton>
        </article>;
      })}
    </div>
    <p className="blade-pricing-note">{c.note}</p>
    <PlanComparison names={c.plans.map(p => p.name)} />
  </section>;
}

function CellValue({ value, yes, no }: { value: Cell; yes: string; no: string }) {
  if (typeof value === 'string') return <span className="blade-compare-text">{value}</span>;
  return value ? <Check size={18} className="blade-compare-yes" aria-label={yes} /> : <Minus size={18} className="blade-compare-no" aria-label={no} />;
}

// Tableau détaillé des fonctionnalités, plan par plan (données : plan-features.ts).
function PlanComparison({ names }: { names: string[] }) {
  const { language } = useBladePreferences();
  const t = FEATURE_TABLES[language] ?? FEATURE_TABLES.fr;
  return <div className="blade-compare" aria-labelledby="blade-compare-title">
    <h3 id="blade-compare-title">{t.title}</h3>
    <p className="blade-compare-lead">{t.lead}</p>
    <div className="blade-compare-scroll">
      <table>
        <thead><tr><td />{names.map(n => <th key={n} scope="col">{n}</th>)}</tr></thead>
        {t.groups.map(g => <tbody key={g.title}>
          <tr className="blade-compare-group"><th scope="rowgroup" colSpan={4}>{g.title}</th></tr>
          {g.rows.map(r => <tr key={r.label}>
            <th scope="row">{r.label}{r.hint && <small>{r.hint}</small>}</th>
            {(['free', 'pro', 'premium'] as const).map(k => <td key={k}><CellValue value={r[k]} yes={t.included} no={t.excluded} /></td>)}
          </tr>)}
        </tbody>)}
      </table>
    </div>
  </div>;
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
