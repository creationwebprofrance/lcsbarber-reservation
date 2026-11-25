import { useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { ProviderPage } from './provider';
import { Section, BladeButton, EmptyState, Icon } from './common';
import { fmtDate, isoDate, type ProviderBundle } from './data';
import { PlanGate, useMyPlan } from './plan';

/** Relances du plan Pro par mois civil (même valeur que supabase/functions/blade-relance). */
export const PRO_MONTHLY_RELANCES = 100;

const TEMPLATES = [
  { label: 'Ça fait longtemps', subject: '{prenom}, ça fait un moment !', message: 'Bonjour {prenom},\n\nÇa fait un moment qu’on ne s’est pas vus. Il est peut-être temps de rafraîchir ta coupe ?\n\nJ’ai des créneaux disponibles cette semaine : réserve directement en cliquant sur le bouton ci-dessous.\n\nÀ très vite !' },
  { label: 'Créneaux libres', subject: 'Des créneaux se sont libérés', message: 'Bonjour {prenom},\n\nDes créneaux viennent de se libérer dans mon planning. Si tu veux en profiter, réserve dès maintenant avec le bouton ci-dessous.\n\nÀ bientôt !' },
  { label: 'Offre spéciale', subject: '{prenom}, une petite attention pour toi', message: 'Bonjour {prenom},\n\nPour te remercier de ta fidélité, je t’offre une petite attention sur ta prochaine prestation.\n\nRéserve ton créneau avec le bouton ci-dessous et mentionne ce message.\n\nÀ très vite !' },
] as const;
const PERIODS = [['4', '4 semaines'], ['6', '6 semaines'], ['8', '2 mois'], ['12', '3 mois'], ['0', 'Tous mes clients']] as const;

type Relance = { client_id: string; sent_at: string };
type Result = { sent: number; skipped: { id: string; name: string; reason: string }[] };

export function ProviderRelances() {
  return <ProviderPage title="Relances">{data => <PlanGate need="pro" feature="La relance des clients"><RelancesBody data={data} /></PlanGate>}</ProviderPage>;
}

function RelancesBody({ data }: { data: ProviderBundle }) {
  const [weeks, setWeeks] = useState('6');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState<string>(TEMPLATES[0].subject);
  const [message, setMessage] = useState<string>(TEMPLATES[0].message);
  const [history, setHistory] = useState<Relance[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const { data: myPlan } = useMyPlan(refresh);

  useEffect(() => {
    (supabase as unknown as SupabaseClient).from('blade_client_relances').select('client_id,sent_at').eq('provider_id', data.provider_id).order('sent_at', { ascending: false }).limit(1000)
      .then(({ data: rows }) => setHistory((rows ?? []) as Relance[]));
  }, [data.provider_id, refresh]);

  const today = isoDate(new Date());
  const rows = useMemo(() => {
    const lastRelance = new Map<string, string>();
    for (const r of history) if (!lastRelance.has(r.client_id)) lastRelance.set(r.client_id, r.sent_at);
    return data.clients.map(c => {
      const mine = data.bookings.filter(b => b.status !== 'cancelled' && (b.client_id === c.id || (c.email && b.client_email?.toLowerCase() === c.email.toLowerCase())));
      const past = mine.filter(b => b.appointment_date <= today).map(b => b.appointment_date).sort();
      const upcoming = mine.some(b => b.appointment_date > today);
      const last = past[past.length - 1] ?? null;
      const days = last ? Math.floor((Date.parse(today) - Date.parse(last)) / 86400000) : null;
      const hasEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email ?? '');
      return { c, last, days, upcoming, hasEmail, relance: lastRelance.get(c.id) ?? null };
    });
  }, [data.clients, data.bookings, history, today]);

  const minDays = Number(weeks) * 7;
  const q = query.trim().toLowerCase();
  const list = rows
    .filter(r => !r.c.is_blacklisted && r.hasEmail)
    .filter(r => minDays === 0 || (!r.upcoming && r.days !== null && r.days >= minDays))
    .filter(r => !q || r.c.name.toLowerCase().includes(q) || r.c.email.toLowerCase().includes(q))
    .sort((a, b) => (b.days ?? -1) - (a.days ?? -1));
  const recentlyRelanced = (r: typeof rows[number]) => r.relance !== null && Date.now() - Date.parse(r.relance) < 7 * 86400000;
  const selectable = list.filter(r => !recentlyRelanced(r));
  const allOn = selectable.length > 0 && selectable.every(r => selected.has(r.c.id));
  const toggle = (id: string) => setSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const firstName = (name: string) => name.trim().split(/\s+/)[0] || '';
  const sample = list.find(r => selected.has(r.c.id))?.c.name ?? list[0]?.c.name ?? 'Client';
  const fill = (t: string) => t.replace(/\{\s*prenom\s*\}/gi, firstName(sample)).replace(/\{\s*nom\s*\}/gi, sample);
  const count = selected.size;
  // Plan Pro : relances restantes ce mois-ci (indicatif ; le serveur fait foi).
  const monthStart = today.slice(0, 7);
  const usedThisMonth = history.filter(r => isoDate(new Date(r.sent_at)).slice(0, 7) === monthStart).length;
  const monthlyLeft = myPlan?.plan === 'pro' ? Math.max(0, PRO_MONTHLY_RELANCES - usedThisMonth) : null;

  const send = async () => {
    if (!count || busy) return;
    if (!confirm(`Envoyer cette relance par email à ${count} client${count > 1 ? 's' : ''} ?`)) return;
    setBusy(true); setError(''); setResult(null);
    try {
      const { data: r, error: e } = await supabase.functions.invoke('blade-relance', { body: { client_ids: [...selected].slice(0, 50), subject, message } });
      if (e) {
        // Un refus du serveur (quota du mois atteint, plan) porte son message dans le corps de la réponse.
        const details = e instanceof FunctionsHttpError ? await e.context.json().catch(() => null) : null;
        throw new Error(typeof details?.error === 'string' ? details.error : 'Envoi impossible pour le moment.');
      }
      if (r?.error) throw new Error(r.error);
      setResult(r as Result); setSelected(new Set()); setRefresh(n => n + 1);
    } catch (e) { setError(e instanceof Error ? e.message : 'Envoi impossible pour le moment.'); }
    finally { setBusy(false); }
  };

  return <>
    <p className="blade-note">Envoie un email à tes clients pour les faire revenir. Le bouton « Réserver » de l’email mène à ta fiche BLADE, et ils peuvent te répondre directement.</p>
    {monthlyLeft !== null && <p className="blade-note" role="status"><strong>{monthlyLeft} relance{monthlyLeft > 1 ? 's' : ''} restante{monthlyLeft > 1 ? 's' : ''} ce mois-ci</strong> sur {PRO_MONTHLY_RELANCES} avec le plan Pro. Relances illimitées avec le plan Premium.</p>}
    <div className="blade-two-columns">
      <Section title="Clients à relancer">
        <div className="blade-fields">
          <label className="blade-field"><span>Pas venus depuis</span><select value={weeks} onChange={e => { setWeeks(e.target.value); setSelected(new Set()); }}>{PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <label className="blade-field"><span>Rechercher</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Nom ou email" /></label>
        </div>
        {!list.length ? <EmptyState compact icon="users" title="Aucun client à relancer" description={minDays ? 'Aucun client avec email n’est absent depuis cette période. Essaie une période plus courte.' : 'Aucun client avec un email valide.'} /> : <>
          <label className="blade-checkbox blade-relance-all"><input type="checkbox" checked={allOn} onChange={() => setSelected(allOn ? new Set() : new Set(selectable.slice(0, 50).map(r => r.c.id)))} />Tout sélectionner ({Math.min(selectable.length, 50)})</label>
          <ul className="blade-relance-list">{list.map(r => {
            const blocked = recentlyRelanced(r);
            return <li key={r.c.id} className={blocked ? 'is-blocked' : ''}><label>
              <input type="checkbox" disabled={blocked || (!selected.has(r.c.id) && count >= 50)} checked={selected.has(r.c.id)} onChange={() => toggle(r.c.id)} />
              <span><strong>{r.c.name}</strong><small>{r.c.email}</small></span>
              <span className="blade-relance-meta">{r.last ? `Dernière visite : ${fmtDate(r.last)}` : 'Jamais venu'}{r.upcoming && ' · RDV à venir'}{r.relance && <em>{blocked ? 'Relancé récemment' : `Relancé le ${new Date(r.relance).toLocaleDateString('fr-FR')}`}</em>}</span>
            </label></li>;
          })}</ul>
        </>}
      </Section>
      <Section title="Ton message">
        <div className="blade-relance-templates" role="group" aria-label="Modèles de message">{TEMPLATES.map(t => <BladeButton key={t.label} type="button" onClick={() => { setSubject(t.subject); setMessage(t.message); }}>{t.label}</BladeButton>)}</div>
        <div className="blade-fields">
          <label className="blade-field blade-field-full"><span>Objet</span><input value={subject} maxLength={150} onChange={e => setSubject(e.target.value)} /></label>
          <label className="blade-field blade-field-full"><span>Message</span><textarea rows={9} value={message} maxLength={3000} onChange={e => setMessage(e.target.value)} /><small>{'{prenom}'} est remplacé par le prénom de chaque client.</small></label>
        </div>
        <div className="blade-relance-preview" aria-label="Aperçu de l’email">
          <small>Aperçu pour {sample}</small>
          <strong>{fill(subject)}</strong>
          <p>{fill(message)}</p>
          <span className="blade-relance-cta">Réserver mon prochain rendez-vous</span>
        </div>
        <div className="blade-inline">
          <BladeButton variant="default" disabled={!count || busy || monthlyLeft === 0 || subject.trim().length < 3 || message.trim().length < 10} onClick={send}><Icon name="message" />{busy ? 'Envoi…' : count ? `Relancer ${count} client${count > 1 ? 's' : ''}` : 'Sélectionne des clients'}</BladeButton>
        </div>
        {error && <p className="blade-form-error" role="alert">{error}</p>}
        {result && <div role="status" className="blade-note">
          <p><strong>{result.sent} email{result.sent > 1 ? 's' : ''} envoyé{result.sent > 1 ? 's' : ''}.</strong></p>
          {result.skipped.length > 0 && <ul>{result.skipped.map(s => <li key={s.id}>{s.name || 'Client'} : {s.reason}</li>)}</ul>}
        </div>}
        <p className="blade-note">Un même client ne peut être relancé qu’une fois tous les 7 jours (50 clients par envoi, 200 par jour).</p>
      </Section>
    </div>
  </>;
}
