// Abonnement du prestataire à BLADE (payé sur le compte Stripe de la plateforme).
// Les acomptes des clients, eux, passent par les liens Stripe / Revolut de chaque prestataire.
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, CreditCard, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { BladeButton, Section } from './common';
import { ProviderPage, Status } from './provider';
import { useMyPlan } from './plan';

type Plan = 'free' | 'pro' | 'premium';
type Subscription = {
  plan: Plan; status: string; effective_plan: Plan; current_period_end: string | null; trial_end: string | null;
  cancel_at_period_end: boolean; had_trial: boolean; stripe_customer_id: string | null;
};

type Billing = 'month' | 'year';
// Mêmes montants que supabase/functions/blade-subscription/index.ts (annuel = 12 mois - 10 %).
const PLANS: { id: Exclude<Plan, 'free'>; name: string; price: Record<Billing, string>; points: string[] }[] = [
  { id: 'pro', name: 'Pro', price: { month: '19,90 €/mois', year: '214,90 €/an (17,91 €/mois)' }, points: ['Réservations illimitées', 'Acomptes en ligne contre les no-shows', 'Carte de fidélité incluse', 'Rappels automatiques et relances clients'] },
  { id: 'premium', name: 'Premium', price: { month: '39,90 €/mois', year: '430,90 €/an (35,91 €/mois)' }, points: ['Tout le plan Pro', 'Mise en avant dans ta ville', 'Badge « Pro vérifié »', 'Statistiques avancées'] },
];
const NAMES: Record<Plan, string> = { free: 'Découverte (gratuit)', pro: 'Pro', premium: 'Premium' };
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

async function call(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('blade-subscription', { body: { ...body, origin: window.location.origin } });
  if (error) {
    let message = 'Le service d’abonnement ne répond pas. Réessaie dans un instant.';
    try { const details = await (error as { context?: Response }).context?.json(); if (details?.error) message = details.error; } catch { /* réponse non JSON */ }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

function statusText(s: Subscription) {
  if (s.effective_plan === 'free') return s.status === 'canceled' ? 'Ton abonnement est terminé. Tu es revenu au plan Découverte.' : 'Tu utilises le plan Découverte, gratuit.';
  if (s.status === 'trialing') return `Essai gratuit jusqu’au ${day(s.trial_end)}. Aucun prélèvement avant cette date.`;
  if (s.status === 'past_due') return 'Le dernier paiement a échoué. Mets à jour ta carte pour garder ton plan.';
  if (s.cancel_at_period_end) return `Abonnement résilié : il reste actif jusqu’au ${day(s.current_period_end)}.`;
  return s.current_period_end ? `Prochain prélèvement le ${day(s.current_period_end)}.` : 'Abonnement actif.';
}

function SubscriptionPanel() {
  const [params, setParams] = useSearchParams();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [busy, setBusy] = useState<string>('sync');
  const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const started = useRef(false);
  const wanted = params.get('plan');
  const [billing, setBilling] = useState<Billing>(params.get('billing') === 'year' ? 'year' : 'month');
  const plan = useMyPlan(sub ? 1 : 0);

  useEffect(() => {
    if (started.current) return; started.current = true;
    const sessionId = params.get('session_id'); const cancelled = params.get('annule');
    (async () => {
      try {
        const s = await call(sessionId ? { action: 'sync', session_id: sessionId } : { action: 'sync' });
        setSub(s);
        if (sessionId) setMessage(s.effective_plan === 'free' ? 'Paiement reçu : ton abonnement s’active, recharge la page dans un instant.' : `Bienvenue dans le plan ${NAMES[s.effective_plan as Plan]} !`);
        else if (cancelled) setMessage('Paiement annulé : rien n’a été prélevé.');
      } catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); }
      finally {
        setBusy('');
        if (sessionId || cancelled) { const next = new URLSearchParams(params); next.delete('session_id'); next.delete('annule'); setParams(next, { replace: true }); }
      }
    })();
  }, [params, setParams]);

  const go = async (body: Record<string, unknown>, key: string) => {
    setBusy(key); setError(''); setMessage('');
    try { const { url } = await call(body); if (url) window.location.assign(url); else setBusy(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); setBusy(''); }
  };

  const current = sub?.effective_plan ?? 'free';
  // « paying » = un vrai abonnement Stripe en cours ; un plan offert ou administrateur n'en est pas un.
  const paying = !!sub && ['trialing', 'active', 'past_due'].includes(sub.status);
  const source = plan.data?.source;
  const info = !sub ? '' : source === 'superadmin' ? 'Compte administrateur : toutes les fonctions sont incluses, sans abonnement.'
    : source === 'offert' && !paying ? `Plan ${NAMES[current]} offert jusqu’au ${day(plan.data?.comp_until ?? null)}. Abonne-toi avant cette date pour ne rien perdre.`
    : statusText(sub);
  return <>
    <Section title="Mon plan">
      <div className="blade-sub-current">
        <CreditCard size={22} aria-hidden="true" />
        <div>
          <strong>{busy === 'sync' && !sub ? 'Chargement…' : `${NAMES[current]}${source === 'offert' && !paying ? ' (offert)' : ''}`}</strong>
          {info && <p>{info}</p>}
        </div>
        {sub?.stripe_customer_id && <BladeButton disabled={!!busy} onClick={() => go({ action: 'portal' }, 'portal')}>{busy === 'portal' ? 'Ouverture…' : <>Gérer, factures, résilier <ExternalLink size={16} aria-hidden="true" /></>}</BladeButton>}
      </div>
      <Status error={error} message={message} />
    </Section>

    <Section title={paying ? 'Changer de plan' : 'Passer à un plan payant'}>
      {!paying && source !== 'superadmin' && <div className="blade-billing-toggle" role="group" aria-label="Facturation mensuelle ou annuelle">
        <button type="button" aria-pressed={billing === 'month'} onClick={() => setBilling('month')}>Mensuel</button>
        <button type="button" aria-pressed={billing === 'year'} onClick={() => setBilling('year')}>Annuel <span className="blade-billing-save">-10 %</span></button>
      </div>}
      <div className="blade-sub-plans">
        {PLANS.map(p => {
          // Un plan offert reste « à souscrire » : le prestataire doit pouvoir s'abonner avant la fin de l'offre.
          const isCurrent = current === p.id && paying;
          const trial = p.id === 'pro' && !sub?.had_trial && !paying;
          return <article key={p.id} className={`blade-sub-plan${isCurrent ? ' is-current' : ''}${wanted === p.id && !isCurrent ? ' is-wanted' : ''}`}>
            <header><h3>{p.name}</h3><strong>{p.price[billing]}</strong></header>
            <ul>{p.points.map(t => <li key={t}><Check size={16} aria-hidden="true" />{t}</li>)}</ul>
            {source === 'superadmin' ? <p className="blade-sub-badge">Inclus pour ton compte</p>
              : isCurrent ? <p className="blade-sub-badge">Ton plan actuel</p>
              : <BladeButton variant="default" disabled={!!busy || !sub} onClick={() => paying ? go({ action: 'portal' }, 'portal') : go({ action: 'checkout', plan: p.id, billing }, p.id)}>
                {busy === p.id ? 'Redirection vers Stripe…' : paying ? `Passer au plan ${p.name}` : trial ? 'Essayer 30 jours gratuits' : `Choisir ${p.name}`}
              </BladeButton>}
          </article>;
        })}
      </div>
      <p className="blade-note">Paiement sécurisé par Stripe, sans engagement : tu peux résilier à tout moment. Les acomptes de tes clients restent versés sur ton propre lien Stripe ou Revolut (<Link to="/blade/pro/paiements" className="blade-text-link">Paiements</Link>).</p>
    </Section>
  </>;
}

export function ProSubscription() {
  return <ProviderPage title="Mon abonnement">{() => <SubscriptionPanel />}</ProviderPage>;
}
