// Plan du prestataire connecté (calculé par le serveur : superadmin, abonnement Stripe, offre ou gratuit).
// Le serveur fait respecter les règles ; ici on informe et on propose de passer au plan supérieur.
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { BladeButton, EmptyState } from './common';
import { useSession } from './data';
import { useAsync } from './customization-data';

export type PlanId = 'free' | 'pro' | 'premium';
export type MyPlan = { plan: PlanId; source: 'superadmin' | 'stripe' | 'offert' | 'gratuit'; comp_until: string | null; bookings_this_month: number; booking_limit: number | null };

const RANK: Record<PlanId, number> = { free: 0, pro: 1, premium: 2 };
export const PLAN_NAMES: Record<PlanId, string> = { free: 'Découverte', pro: 'Pro', premium: 'Premium' };
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

export function useMyPlan(refresh = 0) {
  return useAsync(async () => {
    const { data, error } = await supabase.rpc('blade_my_plan');
    if (error) throw error;
    return data as unknown as MyPlan;
  }, [refresh]);
}

/** Bandeau du tableau de bord : plan, offre, compteur de réservations du plan Découverte. */
export function PlanBanner() {
  const { data } = useMyPlan();
  if (!data) return null;
  const free = data.plan === 'free';
  const used = data.bookings_this_month ?? 0; const limit = data.booking_limit ?? 0;
  const pct = limit ? Math.min(100, Math.round(used / limit * 100)) : 0;
  return <section className={`blade-plan-banner${free && used >= limit ? ' is-full' : ''}`} aria-label="Ton plan BLADE">
    <div>
      <p className="blade-eyebrow">Ton plan</p>
      <strong>{PLAN_NAMES[data.plan]}{data.source === 'offert' ? ' offert' : ''}</strong>
      {data.source === 'offert' && <p>Offert jusqu’au {day(data.comp_until)}. Abonne-toi avant cette date pour garder tes avantages.</p>}
      {data.source === 'superadmin' && <p>Compte administrateur : toutes les fonctions sont incluses.</p>}
      {free && <>
        <p>{used >= limit ? 'Limite atteinte : tes clients ne peuvent plus réserver en ligne ce mois-ci.' : `${used} réservation${used > 1 ? 's' : ''} en ligne sur ${limit} ce mois-ci.`}</p>
        <div className="blade-plan-meter" role="progressbar" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={used} aria-label="Réservations du mois"><span style={{ width: `${pct}%` }} /></div>
      </>}
    </div>
    {data.source !== 'superadmin' && data.plan !== 'premium' && <BladeButton asChild variant={free ? 'default' : 'outline'}><Link to={`/blade/pro/abonnement?plan=${free ? 'pro' : 'premium'}`}>{free ? 'Passer Pro' : data.source === 'offert' ? 'Choisir mon abonnement' : 'Passer Premium'} <ArrowRight size={16} aria-hidden="true" /></Link></BladeButton>}
  </section>;
}

/** Affiche le contenu si le plan suffit, sinon une invitation à passer au plan requis. */
export function PlanGate({ need, feature, children }: { need: Exclude<PlanId, 'free'>; feature: string; children: ReactNode }) {
  const { data, loading } = useMyPlan();
  const { session, ready } = useSession();
  if (!ready) return <p role="status">Chargement…</p>;
  // Visiteur non connecté : invitation à se connecter plutôt qu'une erreur de lecture du plan.
  if (!session) return <EmptyState icon="user" title="Connexion requise" description={`${feature} fait partie de l’espace professionnel.`} action={<BladeButton asChild variant="default"><Link to="/blade/connexion?espace=pro">Se connecter</Link></BladeButton>} compact />;
  if (loading && !data) return <p role="status">Chargement…</p>;
  if (!data) return <p className="blade-note" role="alert">Impossible de vérifier ton plan pour le moment. Recharge la page.</p>;
  if (RANK[data.plan] >= RANK[need]) return <>{children}</>;
  return <div className="blade-plan-gate">
    <Lock size={22} aria-hidden="true" />
    <div><h2>{feature} est inclus dans le plan {PLAN_NAMES[need]}</h2>
      <p>Tu es sur le plan {PLAN_NAMES[data.plan]}. Passe au plan {PLAN_NAMES[need]} pour l’activer, sans engagement.</p></div>
    <BladeButton asChild variant="default"><Link to={`/blade/pro/abonnement?plan=${need}`}>Voir le plan {PLAN_NAMES[need]} <ArrowRight size={16} aria-hidden="true" /></Link></BladeButton>
  </div>;
}

export function VerifiedBadge() {
  return <span className="blade-verified" title="Professionnel Premium vérifié par BLADE"><BadgeCheck size={16} aria-hidden="true" />Pro vérifié</span>;
}
