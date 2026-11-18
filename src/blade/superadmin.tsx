// Superadmin (LCS Barber only): every provider and client, validation and per-provider options.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BladeButton, EmptyState, Icon, PageHeading, Section, Tabs, ArrowRight } from './common';
import { adminSetProvider, fmtDate, useAdminOverview, useLcsTotals, useSession, type AdminProvider } from './data';
import { isInactive, providerStatusLabel } from './provider-admin-model';

const OPTIONS: { key: 'opt_payment_links' | 'opt_auto_emails' | 'opt_searchable'; label: string }[] = [
  { key: 'opt_payment_links', label: 'Acompte par lien (Revolut / Stripe)' },
  { key: 'opt_auto_emails', label: 'Emails automatiques' },
  { key: 'opt_searchable', label: 'Visible dans la recherche' },
];
const day = (iso: string | null) => iso ? fmtDate(iso.slice(0, 10)) : '—';

function ProviderRow({ p, onSaved }: { p: AdminProvider; onSaved: () => void }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function save(next: AdminProvider) {
    setBusy(true); setError('');
    try { await adminSetProvider(next, next.status !== p.status); onSaved(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Modification refusée'); }
    finally { setBusy(false); }
  }
  const inactive = p.status === 'active' && isInactive(p.last_active_at);
  return <article aria-busy={busy}>
    <div>
      <h3>{p.display_name || p.email || 'Sans nom'}{p.is_self ? ' (toi)' : ''}</h3>
      <p>{p.email ?? '—'}</p>
      <p className="blade-note">Inscrit le {day(p.created_at)} · {p.clients} clients · {p.bookings} rendez-vous · <strong>{p.honored} prestation{p.honored > 1 ? 's' : ''} honorée{p.honored > 1 ? 's' : ''}</strong> · dernière activité {day(p.last_active_at)}{inactive ? ' · inactif depuis plus d’un mois' : ''}</p>
      <p className="blade-note">Liens enregistrés : {p.has_revolut ? 'Revolut' : ''}{p.has_revolut && p.has_stripe_link ? ' + ' : ''}{p.has_stripe_link ? 'Stripe' : ''}{!p.has_revolut && !p.has_stripe_link ? 'aucun' : ''}</p>
    </div>
    <span className="blade-pill">{providerStatusLabel[p.status]}</span>
    <div className="blade-superadmin-options">
      {OPTIONS.map(o => <label key={o.key} className="blade-switch"><input type="checkbox" checked={p[o.key]} disabled={busy} onChange={e => save({ ...p, [o.key]: e.target.checked })}/><span>{o.label}</span></label>)}
      <label className="blade-switch"><input type="checkbox" checked={p.status === 'suspended'} disabled={busy || p.status === 'pending' || p.is_self} onChange={e => save({ ...p, status: e.target.checked ? 'suspended' : 'active' })}/><span>Compte suspendu</span></label>
      {p.status === 'pending' && <BladeButton variant="default" disabled={busy} onClick={() => save({ ...p, status: 'active' })}>Valider ce prestataire</BladeButton>}
      {error && <p className="blade-form-error" role="alert">{error}</p>}
    </div>
  </article>;
}

/** Demande d'accès prestataire : valider (accès pro + email) ou refuser (compte bloqué, sans email). */
function RequestCard({ p, onSaved }: { p: AdminProvider; onSaved: () => void }) {
  const [busy, setBusy] = useState(''); const [error, setError] = useState('');
  async function decide(status: 'active' | 'suspended') {
    if (status === 'suspended' && !window.confirm(`Refuser l’accès prestataire de ${p.display_name || p.email} ?`)) return;
    setBusy(status); setError('');
    try { await adminSetProvider({ ...p, status }, status === 'active'); onSaved(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Action refusée'); }
    finally { setBusy(''); }
  }
  return <article className="blade-request-card" aria-busy={!!busy}>
    <span className="blade-request-avatar" aria-hidden="true">{(p.display_name || p.email || '?').trim().slice(0, 1).toUpperCase()}</span>
    <div><h3>{p.display_name || 'Sans nom'}</h3><p>{p.email ?? '—'}</p><small>Demande du {day(p.created_at)}</small></div>
    <div className="blade-request-actions">
      <BladeButton variant="default" disabled={!!busy} onClick={() => decide('active')}>{busy === 'active' ? 'Validation…' : 'Valider l’accès'}</BladeButton>
      <BladeButton disabled={!!busy} onClick={() => decide('suspended')}>Refuser</BladeButton>
    </div>
    {error && <p className="blade-form-error" role="alert">{error}</p>}
  </article>;
}

function Kpi({ icon, value, label, hint }: { icon: string; value: number; label: string; hint: string }) {
  return <article className="blade-kpi"><Icon name={icon} /><strong>{value.toLocaleString('fr-FR')}</strong><span>{label}</span><small>{hint}</small></article>;
}

/** Bandeau du dashboard : demandes prestataires en attente (superadmin seulement). */
export function PendingProvidersBanner() {
  const { ready, isSuperadmin } = useSession();
  const { data } = useAdminOverview(ready && isSuperadmin);
  const n = (data?.providers ?? []).filter(p => p.status === 'pending').length;
  if (!n) return null;
  return <Link to="/blade/pro/superadmin" className="blade-pending-banner"><Icon name="users" /><span><strong>{n} demande{n > 1 ? 's' : ''} prestataire{n > 1 ? 's' : ''} à valider</strong><small>Valide l’accès pour qu’ils puissent utiliser leur espace pro.</small></span><ArrowRight size={18} /></Link>;
}

export function Superadmin() {
  const { ready, isSuperadmin } = useSession();
  const [refresh, setRefresh] = useState(0); const [tab, setTab] = useState('Prestataires'); const [query, setQuery] = useState('');
  const { data, loading, error } = useAdminOverview(ready && isSuperadmin, refresh);
  const { data: lcs } = useLcsTotals(ready && isSuperadmin, refresh);
  const clients = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.clients ?? []).filter(c => !q || `${c.name} ${c.email} ${c.provider_name ?? ''}`.toLowerCase().includes(q));
  }, [data, query]);
  if (!ready) return <p role="status" className="blade-note">Chargement…</p>;
  if (!isSuperadmin) return <><PageHeading pro title="Superadmin"/><EmptyState icon="user" title="Accès réservé au superadmin LCS Barber"/></>;
  const pending = (data?.providers ?? []).filter(p => p.status === 'pending').length;
  return <>
    <PageHeading pro title="Superadmin" description="Tous les prestataires et tous les clients de BLADE"/>
    {data && <div className="blade-kpis">
      <Kpi icon="scissors" value={lcs?.bookings ?? data.honored_total} label="Prestations" hint={lcs ? `${data.honored_total} honorées · ${lcs.pending} en attente` : 'Terminées, ou confirmées et passées'} />
      <Kpi icon="users" value={lcs?.clients ?? data.honored_clients} label="Clients" hint={lcs ? `Comme LCS Barber · ${lcs.revenue.toLocaleString('fr-FR')} € de CA` : 'Au moins une prestation honorée'} />
      <Kpi icon="user" value={data.providers.filter(p => p.status === 'active').length} label="Prestataires actifs" hint={`${data.providers.length} au total`} />
      <Kpi icon="bell" value={pending} label="Demandes à valider" hint="Accès prestataire" />
    </div>}
    {data && <Section title="Demandes d’accès prestataire" action={pending ? <span className="blade-pill">{pending} en attente</span> : undefined}>
      {pending
        ? <div className="blade-requests">{data.providers.filter(p => p.status === 'pending').map(p => <RequestCard key={p.id} p={p} onSaved={() => setRefresh(n => n + 1)} />)}</div>
        : <p className="blade-note">Aucune demande en attente. Tu reçois un email dès qu’une personne demande un accès prestataire depuis « Devenir pro ».</p>}
    </Section>}
    <Tabs options={['Prestataires', 'Clients']} value={tab} onChange={setTab}/>
    {loading ? <p role="status" className="blade-note">Chargement…</p> : error ? <p role="alert" className="blade-form-error">Impossible de charger : {error}</p> : !data ? null : tab === 'Prestataires'
      ? <Section title={`Prestataires (${data.providers.length})`} action={pending ? <span className="blade-pill">{pending} à valider</span> : undefined}>
          {data.providers.length ? <div className="blade-provider-list">{data.providers.map(p => <ProviderRow key={p.id} p={p} onSaved={() => setRefresh(n => n + 1)}/>)}</div> : <EmptyState title="Aucun prestataire" compact/>}
        </Section>
      : <Section title={`Clients (${data.clients.length})`}>
          <p className="blade-note">{data.unattributed_clients} clients et {data.unattributed_bookings} rendez-vous de LCS Barber ne sont pas encore rattachés à un prestataire BLADE.</p>
          <label className="blade-field"><span>Rechercher</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Nom, email ou prestataire"/></label>
          {clients.length ? <div className="blade-live-table" role="table">
            <div role="row" className="blade-live-row blade-live-head">{['Client', 'Email', 'Téléphone', 'Prestataire', 'Prestations honorées'].map(c => <span role="columnheader" key={c}>{c}</span>)}</div>
            {clients.map(c => <div role="row" className="blade-live-row" key={c.id}><span role="cell" data-label="Client">{c.name}</span><span role="cell" data-label="Email">{c.email}</span><span role="cell" data-label="Téléphone">{c.phone ?? '—'}</span><span role="cell" data-label="Prestataire">{c.provider_name ?? 'LCS Barber (non rattaché)'}</span><span role="cell" data-label="Prestations honorées">{c.honored}</span></div>)}
          </div> : <EmptyState title="Aucun client" compact/>}
        </Section>}
  </>;
}
