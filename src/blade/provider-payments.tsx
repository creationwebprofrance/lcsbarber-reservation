// Provider payments: own Revolut / Stripe deposit links (only when LCS Barber allows it)
// and manual "Acompte reçu" confirmation for bookings paid by link.
import { useState } from 'react';
import { BladeButton, EmptyState, Section } from './common';
import { cancelProviderBooking, fmtDate, fmtPrice, markDepositReceived, updateOwnProvider, useSession } from './data';
import { Field, ProviderPage, Status } from './provider';
import { PAYMENT_OPTION_OFF, needsDeposit, paymentLinksError } from './provider-admin-model';

function LinksForm() {
  const { provider } = useSession();
  const [name, setName] = useState(provider?.display_name ?? '');
  const [revolut, setRevolut] = useState(provider?.revolut_url ?? '');
  const [stripe, setStripe] = useState(provider?.stripe_link_url ?? '');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  if (!provider) return null;
  const allowed = provider.opt_payment_links;
  async function save() {
    if (!provider) return;
    const problem = paymentLinksError(provider, allowed ? revolut : '', allowed ? stripe : '');
    if (problem) { setError(problem); return; }
    setBusy(true); setError(''); setMessage('');
    try { await updateOwnProvider(name, allowed ? revolut : '', allowed ? stripe : ''); setMessage('Enregistré.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Enregistrement refusé'); }
    finally { setBusy(false); }
  }
  return <Section title="Mon compte et mes liens de paiement">
    <div className="blade-local-form">
      <Field label="Nom affiché aux clients" value={name} onChange={setName}/>
      <fieldset disabled={!allowed} className="blade-fields" aria-describedby={!allowed ? 'blade-links-off' : undefined}>
        <Field label="Lien Revolut (https://revolut.me/…)" value={revolut} onChange={setRevolut}/>
        <Field label="Lien de paiement Stripe (https://buy.stripe.com/…)" value={stripe} onChange={setStripe}/>
      </fieldset>
      {!allowed && <p id="blade-links-off" className="blade-note">{PAYMENT_OPTION_OFF}. Tes clients ne verront pas de bouton de paiement.</p>}
      {allowed && <p className="blade-note">Le client paie l’acompte avec ton lien. Son rendez-vous reste « en attente » jusqu’à ce que tu cliques « Acompte reçu ».</p>}
      <Status error={error} message={message}/>
      <BladeButton variant="default" disabled={busy} onClick={save}>{busy ? 'Enregistrement…' : 'Enregistrer'}</BladeButton>
    </div>
  </Section>;
}

export function ProviderPayments() {
  const { provider } = useSession();
  const [busy, setBusy] = useState(''); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  return <ProviderPage title="Paiements">{(data, reload) => {
    const today = new Date().toISOString().slice(0, 10);
    const waiting = data.bookings.filter(b => needsDeposit({ ...b, provider_id: data.provider_id }) && b.appointment_date >= today)
      .sort((a, b) => `${a.appointment_date}${a.appointment_time}`.localeCompare(`${b.appointment_date}${b.appointment_time}`));
    async function act(id: string, kind: 'revolut' | 'stripe_link' | 'autre' | 'cancel') {
      setBusy(id); setError(''); setMessage('');
      try {
        const emailed = kind === 'cancel' ? await cancelProviderBooking(id) : await markDepositReceived(id, kind);
        setMessage(`${kind === 'cancel' ? 'Rendez-vous annulé' : 'Acompte reçu : rendez-vous confirmé'}${emailed ? ' — email envoyé au client et à toi.' : provider?.opt_auto_emails ? ' — email non envoyé.' : '.'}`);
        reload();
      } catch (e) { setError(e instanceof Error ? e.message : 'Action refusée'); }
      finally { setBusy(''); }
    }
    return <>
      <LinksForm/>
      <Section title="Acomptes en attente">
        <Status error={error} message={message}/>
        {!provider?.opt_payment_links ? <p className="blade-note">{PAYMENT_OPTION_OFF}.</p> : null}
        {waiting.length ? <div className="blade-provider-list">{waiting.map(b => <article key={b.id}>
          <div><h3>{b.client_name}</h3><p>{fmtDate(b.appointment_date)} · {b.appointment_time.slice(0, 5)} · {b.services?.name ?? 'Prestation'} · {fmtPrice(b.total_price)}</p></div>
          <span className="blade-pill">En attente</span>
          {provider?.opt_payment_links && <BladeButton variant="default" disabled={busy === b.id} onClick={() => act(b.id, provider.revolut_url && !provider.stripe_link_url ? 'revolut' : provider.stripe_link_url && !provider.revolut_url ? 'stripe_link' : 'autre')}>Acompte reçu</BladeButton>}
          <BladeButton disabled={busy === b.id} onClick={() => { if (window.confirm('Annuler ce rendez-vous ? Le client sera prévenu par email.')) void act(b.id, 'cancel'); }}>Annuler</BladeButton>
        </article>)}</div> : <EmptyState title="Aucun acompte en attente" compact icon="coins"/>}
      </Section>
    </>;
  }}</ProviderPage>;
}
