// BLADE client booking: prestation → lieu → date → horaire → récapitulatif → confirmation.
// The browser only collects choices; blade-booking recomputes slots, price and status.
import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { BladeButton, EmptyState, Icon, PageHeading, Section, ArrowRight } from './common';
import { Field } from './provider';
import { bladeBooking, fmtDate, fmtPrice, useAvailability, useServices, useSession, type BookingCreated, type BookingQuote, type Service } from './data';
import { DOMICILE_ADDRESS, DOMICILE_OFFERS, MODE_LABEL, PHONE_OK, type Mode } from '../../supabase/functions/_shared/blade-booking-rules';
import { RequestSlot } from './requests';
import { DepositButton } from './live';

const STEPS = ['Prestation', 'Lieu', 'Date', 'Horaire', 'Récapitulatif'] as const;
type Step = typeof STEPS[number];

export function Reserve() {
  const { session } = useSession();
  const services = useServices();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('Prestation');
  const [service, setService] = useState<Service | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [address, setAddress] = useState('');
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const meta = session?.user.user_metadata ?? {};
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [slots, setSlots] = useState<{ loading: boolean; list: string[]; error: string | null }>({ loading: false, list: [], error: null });
  const [quote, setQuote] = useState<{ loading: boolean; data: BookingQuote | null; error: string | null }>({ loading: false, data: null, error: null });
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const days = useAvailability(mode ?? 'domicile');

  useEffect(() => { if (!name && (meta.full_name || meta.name)) setName(meta.full_name || meta.name); }, [meta.full_name, meta.name, name]);

  useEffect(() => {
    if (step !== 'Horaire' || !service || !mode || !date) return;
    let alive = true; setSlots({ loading: true, list: [], error: null });
    bladeBooking<{ slots: string[] }>({ action: 'slots', service_id: service.id, mode, date })
      .then(r => alive && setSlots({ loading: false, list: r.slots, error: null }))
      .catch(e => alive && setSlots({ loading: false, list: [], error: e.message }));
    return () => { alive = false; };
  }, [step, service, mode, date]);

  useEffect(() => {
    if (step !== 'Récapitulatif' || !service || !mode || !date || !time) return;
    let alive = true; setQuote({ loading: true, data: null, error: null });
    bladeBooking<BookingQuote>({ action: 'quote', service_id: service.id, mode, date, time, address })
      .then(r => alive && setQuote({ loading: false, data: r, error: null }))
      .catch(e => alive && setQuote({ loading: false, data: null, error: e.message }));
    return () => { alive = false; };
  }, [step, service, mode, date, time, address]);

  if (!session) return <><PageHeading title="Réserver" description="Choisis ta prestation et ton créneau."/><EmptyState title="Connexion requise" description="Connecte-toi pour réserver un rendez-vous." action={<BladeButton asChild variant="default"><Link to="/blade/connexion?espace=client">Se connecter</Link></BladeButton>}/></>;

  const reached = (s: Step) => STEPS.indexOf(s) <= STEPS.indexOf(step);
  const canOpen = (s: Step) => s === 'Prestation' || (s === 'Lieu' && !!service) || (s === 'Date' && !!mode) || (s === 'Horaire' && !!date) || (s === 'Récapitulatif' && !!time);
  const domicileOk = !service || Boolean(DOMICILE_OFFERS[service.name]);
  const addressOk = mode !== 'deplacement' || address.trim().length >= 8;

  async function submit(e: FormEvent) {
    e.preventDefault(); if (!service || !mode || !date || !time || sending) return;
    if (!PHONE_OK(phone)) { setSendError('Numéro de téléphone invalide (10 chiffres minimum).'); return; }
    setSending(true); setSendError(null);
    try {
      const r = await bladeBooking<BookingCreated>({ action: 'create', service_id: service.id, mode, date, time, address, name: name.trim(), phone: phone.trim(), notes: notes.trim() || undefined });
      navigate(`/blade/client/confirmation?rdv=${r.booking_id}&statut=${r.status}&acompte=${r.deposit}&total=${r.total}`);
    } catch (err) { setSendError((err as Error).message); if (/créneau/i.test((err as Error).message)) { setTime(null); setStep('Horaire'); } }
    finally { setSending(false); }
  }

  const selection: [string, string][] = [
    ['Prestation', service ? (mode === 'domicile' && DOMICILE_OFFERS[service.name] ? DOMICILE_OFFERS[service.name].label : service.name) : '—'],
    ['Lieu', mode ? MODE_LABEL[mode] : '—'], ['Date', date ? fmtDate(date) : '—'], ['Horaire', time ?? '—'],
  ];

  return <>
    <PageHeading title="Réserver" description="LCS Barber · choisis ta prestation et ton créneau."/>
    <ol className="blade-steps">{STEPS.map((s, i) => <li key={s}><BladeButton aria-pressed={step === s} className={step === s ? 'active' : ''} disabled={!canOpen(s) || !reached(s) && !canOpen(s)} onClick={() => canOpen(s) && setStep(s)}><span>{i + 1}</span>{s}</BladeButton></li>)}</ol>
    <div className="blade-two-columns">
      <Section title={step}>
        {step === 'Prestation' && (services.loading ? <p role="status">Chargement…</p> : services.error ? <p role="alert">{services.error}</p> : !services.data?.length ? <EmptyState icon="scissors" title="Aucune prestation disponible" compact/> :
          <div className="blade-choices">{services.data.map(s => <button type="button" key={s.id} className={`blade-choice ${service?.id === s.id ? 'active' : ''}`} aria-pressed={service?.id === s.id} onClick={() => { setService(s); setTime(null); if (mode === 'domicile' && !DOMICILE_OFFERS[s.name]) setMode(null); setStep('Lieu'); }}>
            <strong>{s.name}</strong>{s.description && <small>{s.description}</small>}<span>{fmtPrice(s.price)} · {s.duration_minutes} min</span>
          </button>)}</div>)}

        {step === 'Lieu' && <>
          <div className="blade-choices">
            <button type="button" className={`blade-choice ${mode === 'domicile' ? 'active' : ''}`} aria-pressed={mode === 'domicile'} disabled={!domicileOk} onClick={() => { setMode('domicile'); setDate(null); setTime(null); setStep('Date'); }}>
              <strong><Icon name="pin" size={16}/> Le client se déplace</strong><small>{DOMICILE_ADDRESS}</small>
              <span>{domicileOk && service ? `${fmtPrice(DOMICILE_OFFERS[service.name].price)} · sans frais de déplacement` : 'Non proposé pour cette prestation'}</span>
            </button>
            <button type="button" className={`blade-choice ${mode === 'deplacement' ? 'active' : ''}`} aria-pressed={mode === 'deplacement'} onClick={() => { setMode('deplacement'); setDate(null); setTime(null); }}>
              <strong><Icon name="home" size={16}/> LCS Barber se déplace</strong><small>Chez toi — frais de déplacement selon le trajet</small>
              <span>{service ? `${fmtPrice(service.price)} + frais éventuels` : ''}</span>
            </button>
          </div>
          {mode === 'deplacement' && <div className="blade-fields" style={{ marginTop: 16 }}>
            <Field label="Ton adresse complète" value={address} onChange={setAddress} required/>
            <BladeButton variant="default" disabled={!addressOk} onClick={() => setStep('Date')}>Continuer <ArrowRight size={16}/></BladeButton>
          </div>}
        </>}

        {step === 'Date' && mode && (days.loading ? <p role="status">Chargement des disponibilités…</p> : days.error ? <p role="alert">{days.error}</p> : !days.data?.length
          ? <><EmptyState title="Aucune disponibilité ouverte" description="Envoie une demande de créneau, LCS Barber te recontacte." compact/><RequestSlot mode={mode}/></>
          : <div className="blade-choices blade-choices-small">{days.data.map(d => <button type="button" key={d.date} className={`blade-choice ${date === d.date ? 'active' : ''}`} aria-pressed={date === d.date} onClick={() => { setDate(d.date); setTime(null); setStep('Horaire'); }}><strong>{fmtDate(d.date)}</strong></button>)}</div>)}

        {step === 'Horaire' && (slots.loading ? <p role="status">Chargement des horaires…</p> : slots.error ? <p role="alert">{slots.error}</p> : !slots.list.length
          ? <EmptyState title="Plus aucun horaire libre ce jour" description="Choisis une autre date." compact action={<BladeButton onClick={() => setStep('Date')}>Changer de date</BladeButton>}/>
          : <div className="blade-choices blade-choices-small">{slots.list.map(t => <button type="button" key={t} className={`blade-choice ${time === t ? 'active' : ''}`} aria-pressed={time === t} onClick={() => { setTime(t); setStep('Récapitulatif'); }}><strong>{t}</strong></button>)}</div>)}

        {step === 'Récapitulatif' && <form className="blade-local-form" onSubmit={submit}>
          {quote.loading ? <p role="status">Calcul du prix…</p> : quote.error ? <p role="alert">{quote.error}</p> : quote.data && <dl className="blade-key-values">
            <div><dt>{quote.data.quote.label}</dt><dd>{fmtPrice(quote.data.quote.base)}</dd></div>
            {quote.data.quote.hourly > 0 && <div><dt>Supplément horaire</dt><dd>{fmtPrice(quote.data.quote.hourly)}</dd></div>}
            {quote.data.quote.sameDay > 0 && <div><dt>Réservation le jour même</dt><dd>{fmtPrice(quote.data.quote.sameDay)}</dd></div>}
            {quote.data.quote.sunday > 0 && <div><dt>Supplément dimanche</dt><dd>{fmtPrice(quote.data.quote.sunday)}</dd></div>}
            {mode === 'deplacement' && <div><dt>Déplacement ({quote.data.travel_minutes} min)</dt><dd>{fmtPrice(quote.data.quote.travel)}</dd></div>}
            <div><dt><strong>Total</strong></dt><dd><strong>{fmtPrice(quote.data.quote.total)}</strong></dd></div>
            {quote.data.deposit > 0 && <div><dt>Acompte à régler</dt><dd>{fmtPrice(quote.data.deposit)}</dd></div>}
          </dl>}
          {quote.data && <p className="blade-note">{quote.data.status === 'pending' ? 'Ton rendez-vous sera confirmé dès que LCS Barber aura reçu ton acompte (Revolut ou carte).' : 'Ton rendez-vous sera confirmé immédiatement.'}</p>}
          <div className="blade-fields">
            <Field label="Nom" value={name} onChange={setName} required/>
            <Field label="Téléphone" type="tel" value={phone} onChange={setPhone} required/>
            <Field label="Message (facultatif)" value={notes} onChange={setNotes}/>
          </div>
          {sendError && <p role="alert" className="blade-error">{sendError}</p>}
          <BladeButton type="submit" variant="default" disabled={sending || !quote.data || name.trim().length < 2 || !phone.trim()}>{sending ? 'Enregistrement…' : 'Confirmer la réservation'}</BladeButton>
        </form>}
      </Section>
      <Section title="Ta sélection">
        <dl className="blade-key-values">{selection.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}{mode === 'deplacement' && address && <div><dt>Adresse</dt><dd>{address}</dd></div>}</dl>
      </Section>
    </div>
  </>;
}

/** Old recap route now lives inside the booking flow. */
export function Recap() { return <Navigate to="/blade/client/reserver" replace/>; }

export function Confirmation() {
  const [p] = useSearchParams();
  const id = p.get('rdv'); const status = p.get('statut'); const deposit = Number(p.get('acompte') || 0); const total = Number(p.get('total') || 0);
  if (!id) return <><PageHeading title="Confirmation"/><EmptyState title="Aucune réservation à confirmer" action={<BladeButton asChild variant="default"><Link to="/blade/client/reserver">Réserver</Link></BladeButton>}/></>;
  const pending = status === 'pending';
  return <><PageHeading title={pending ? 'Réservation enregistrée' : 'Rendez-vous confirmé'} description={pending ? 'Il reste à régler l’acompte.' : 'À bientôt chez LCS Barber.'}/>
    <Section title={pending ? 'Acompte à régler' : 'C’est noté'}>
      <p>Total : <strong>{fmtPrice(total)}</strong>{pending && <> · Acompte : <strong>{fmtPrice(deposit)}</strong></>}</p>
      {pending ? <><p className="blade-note">Ton rendez-vous sera confirmé dès que LCS Barber aura reçu l’acompte.</p><DepositButton bookingId={id}/></> : <p className="blade-note">Tu recevras un email de confirmation.</p>}
      <div className="blade-secondary-links"><Link to="/blade/client/rendez-vous">Mes rendez-vous <ArrowRight size={16}/></Link></div>
    </Section></>;
}
