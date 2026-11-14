// BLADE client booking, shaped by the provider's page settings (places, step order, message, conditions, questions).
// The browser only collects choices; blade-booking recomputes slots, price, answers and status.
import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { BladeButton, EmptyState, Icon, PageHeading, Section, ArrowRight } from './common';
import { Field } from './provider';
import { bladeBooking, fmtDate, fmtPrice, useAvailability, useSession, type BookingCreated, type BookingQuote, type Service } from './data';
import { DOMICILE_ADDRESS, DOMICILE_OFFERS, PHONE_OK, allowedModes, checkAnswers, modeLabel, stepsFor, type Mode, type StepKey } from '../../supabase/functions/_shared/blade-booking-rules';
import { RequestSlot } from './requests';
import { DepositButton } from './live';
import { pageOf, usePublicPage, type PublicPage } from './customization-data';
import { BrandScope } from './brand';

const STEP_LABEL: Record<StepKey, string> = { service: 'Prestation', place: 'Lieu', date: 'Date', time: 'Horaire', recap: 'Récapitulatif' };

export function Reserve() {
  const { session, ready } = useSession();
  const [params] = useSearchParams();
  const pro = params.get('pro');
  const page = usePublicPage(pro && /^[0-9a-f-]{36}$/i.test(pro) ? pro : null);
  if (!ready) return <p role="status">Chargement…</p>;
  if (!session) return <><PageHeading title="Réserver" description="Choisis ta prestation et ton créneau."/><EmptyState title="Connexion requise" description="Connecte-toi pour réserver un rendez-vous." action={<BladeButton asChild variant="default"><Link to="/blade/connexion?espace=client">Se connecter</Link></BladeButton>}/></>;
  if (page.loading) return <p role="status">Chargement…</p>;
  if (!page.data) return <><PageHeading title="Réserver"/><EmptyState icon="user" title="Professionnel introuvable" description="Ce professionnel ne prend pas de rendez-vous en ligne pour le moment." action={<BladeButton asChild><Link to="/blade/client">Rechercher un professionnel</Link></BladeButton>}/></>;
  return <BookingFlow data={page.data} initialService={params.get('prestation')}/>;
}

function BookingFlow({ data, initialService }: { data: PublicPage; initialService: string | null }) {
  const { session } = useSession();
  const navigate = useNavigate();
  const settings = pageOf(data);
  const modes = allowedModes(settings.booking_modes);
  const steps = stepsFor(settings.step_order, settings.booking_modes);
  const isLcs = data.is_lcs;
  const preset = data.services.find(s => s.id === initialService) ?? null;
  const [service, setService] = useState<Service | null>(preset);
  const [step, setStep] = useState<StepKey>(preset && steps[0] === 'service' ? steps[1] : steps[0]);
  const [mode, setMode] = useState<Mode | null>(modes.length === 1 ? modes[0] : null);
  const [address, setAddress] = useState('');
  const [addressOk, setAddressOk] = useState('');
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const meta = session?.user.user_metadata ?? {};
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [rulesAck, setRulesAck] = useState(false);
  const [slots, setSlots] = useState<{ loading: boolean; list: string[]; error: string | null }>({ loading: false, list: [], error: null });
  const [quote, setQuote] = useState<{ loading: boolean; data: BookingQuote | null; error: string | null }>({ loading: false, data: null, error: null });
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const days = useAvailability(mode ?? 'domicile');
  const dayList = isLcs ? days.data ?? [] : [];
  const salon = isLcs ? DOMICILE_ADDRESS : settings.salon_address || settings.city || 'Chez le professionnel';

  useEffect(() => { if (!name && (meta.full_name || meta.name)) setName(meta.full_name || meta.name); }, [meta.full_name, meta.name, name]);

  useEffect(() => {
    if (step !== 'time' || !mode || !date) return;
    let alive = true; setSlots({ loading: true, list: [], error: null });
    bladeBooking<{ slots: string[] }>({ action: 'slots', provider_id: data.provider_id, service_id: service?.id, mode, date })
      .then(r => alive && setSlots({ loading: false, list: r.slots, error: null }))
      .catch(e => alive && setSlots({ loading: false, list: [], error: e.message }));
    return () => { alive = false; };
  }, [step, service, mode, date, data.provider_id]);

  const needsAddress = mode === 'deplacement' && !addressOk;
  useEffect(() => {
    if (step !== 'recap' || !service || !mode || !date || !time || needsAddress) return;
    let alive = true; setQuote({ loading: true, data: null, error: null });
    bladeBooking<BookingQuote>({ action: 'quote', service_id: service.id, mode, date, time, address: addressOk })
      .then(r => alive && setQuote({ loading: false, data: r, error: null }))
      .catch(e => alive && setQuote({ loading: false, data: null, error: e.message }));
    return () => { alive = false; };
  }, [step, service, mode, date, time, addressOk, needsAddress]);

  const done = (s: StepKey) => s === 'service' ? !!service : s === 'place' ? !!mode : s === 'date' ? !!date : s === 'time' ? !!time : false;
  const canOpen = (s: StepKey) => steps.slice(0, steps.indexOf(s)).every(done);
  const next = (from: StepKey) => setStep(steps[steps.indexOf(from) + 1] ?? 'recap');
  const offeredHere = (s: Service, m: Mode | null) => m !== 'domicile' || !isLcs || Boolean(DOMICILE_OFFERS[s.name]);
  const priceOf = (s: Service) => mode === 'domicile' && isLcs && DOMICILE_OFFERS[s.name] ? DOMICILE_OFFERS[s.name].price : s.price;
  const rules = settings.booking_rules;

  async function submit(e: FormEvent) {
    e.preventDefault(); if (!service || !mode || !date || !time || sending) return;
    if (!PHONE_OK(phone)) { setSendError('Numéro de téléphone invalide (10 chiffres minimum).'); return; }
    const checked = checkAnswers(settings.custom_questions, answers);
    if (checked.error) { setSendError(checked.error); return; }
    if (rules && !rulesAck) { setSendError(`Accepte les conditions de ${data.name} pour réserver.`); return; }
    setSending(true); setSendError(null);
    try {
      const r = await bladeBooking<BookingCreated>({ action: 'create', service_id: service.id, mode, date, time, address: addressOk, name: name.trim(), phone: phone.trim(), notes: notes.trim() || undefined, answers, rules_ack: rulesAck });
      navigate(`/blade/client/confirmation?rdv=${r.booking_id}&statut=${r.status}&acompte=${r.deposit}&total=${r.total}`);
    } catch (err) { setSendError((err as Error).message); if (/créneau/i.test((err as Error).message)) { setTime(null); setStep('time'); } }
    finally { setSending(false); }
  }

  const selection: [string, string][] = [
    ['Prestation', service ? (mode === 'domicile' && isLcs && DOMICILE_OFFERS[service.name] ? DOMICILE_OFFERS[service.name].label : service.name) : '—'],
    ['Lieu', mode ? modeLabel(mode, data.name) : '—'], ['Date', date ? fmtDate(date) : '—'], ['Horaire', time ?? '—'],
  ];
  const addressField = <div className="blade-fields" style={{ marginTop: 16 }}>
    <Field label="Ton adresse complète" value={address} onChange={setAddress} required/>
    <BladeButton variant="default" disabled={address.trim().length < 8} onClick={() => { setAddressOk(address.trim()); if (step === 'place') next('place'); }}>{step === 'place' ? 'Continuer' : 'Calculer le prix'} <ArrowRight size={16}/></BladeButton>
  </div>;

  return <BrandScope accent={settings.accent_color} font={settings.font_key}>
    <PageHeading title="Réserver" description={`${data.name} · choisis ta prestation et ton créneau.`}/>
    {settings.welcome_message && <p className="blade-brand-welcome">{settings.welcome_message}</p>}
    <ol className="blade-steps">{steps.map((s, i) => <li key={s}><BladeButton aria-pressed={step === s} className={step === s ? 'active' : ''} disabled={!canOpen(s)} onClick={() => canOpen(s) && setStep(s)}><span>{i + 1}</span>{STEP_LABEL[s]}</BladeButton></li>)}</ol>
    <div className="blade-two-columns">
      <Section title={STEP_LABEL[step]}>
        {step === 'service' && (!data.services.length ? <EmptyState icon="scissors" title="Aucune prestation disponible" compact/> :
          <div className="blade-choices">{data.services.map(s => { const ok = offeredHere(s, mode); return <button type="button" key={s.id} disabled={!ok} className={`blade-choice ${service?.id === s.id ? 'active' : ''}`} aria-pressed={service?.id === s.id} onClick={() => { setService(s); next('service'); }}>
            <strong>{s.name}</strong>{s.description && <small>{s.description}</small>}<span>{ok ? `${fmtPrice(priceOf(s))} · ${s.duration_minutes} min` : 'Non proposé pour ce lieu'}</span>
          </button>; })}</div>)}

        {step === 'place' && <>
          <div className="blade-choices">
            {modes.includes('domicile') && <button type="button" className={`blade-choice ${mode === 'domicile' ? 'active' : ''}`} aria-pressed={mode === 'domicile'} disabled={!!service && !offeredHere(service, 'domicile')} onClick={() => { setMode('domicile'); setDate(null); setTime(null); setAddressOk(''); next('place'); }}>
              <strong><Icon name="pin" size={16}/> Le client se déplace</strong><small>{salon}</small>
              <span>{service ? (offeredHere(service, 'domicile') ? `${fmtPrice(isLcs ? DOMICILE_OFFERS[service.name].price : service.price)}${isLcs ? ' · sans frais de déplacement' : ''}` : 'Non proposé pour cette prestation') : 'Sans frais de déplacement'}</span>
            </button>}
            {modes.includes('deplacement') && <button type="button" className={`blade-choice ${mode === 'deplacement' ? 'active' : ''}`} aria-pressed={mode === 'deplacement'} onClick={() => { setMode('deplacement'); setDate(null); setTime(null); }}>
              <strong><Icon name="home" size={16}/> {data.name} se déplace</strong><small>Chez toi — frais de déplacement selon le trajet</small>
              <span>{service ? `${fmtPrice(service.price)} + frais éventuels` : ''}</span>
            </button>}
          </div>
          {mode === 'deplacement' && addressField}
        </>}

        {step === 'date' && mode && (isLcs && days.loading ? <p role="status">Chargement des disponibilités…</p> : isLcs && days.error ? <p role="alert">{days.error}</p> : !dayList.length
          ? (isLcs ? <><EmptyState title="Aucune disponibilité ouverte" description={`Envoie une demande de créneau, ${data.name} te recontacte.`} compact/><RequestSlot mode={mode}/></>
            : <EmptyState title="Pas encore d’agenda en ligne" description={`${data.name} n’a pas encore ouvert de créneaux. Contacte-le directement.`} compact/>)
          : <div className="blade-choices blade-choices-small">{dayList.map(d => <button type="button" key={d.date} className={`blade-choice ${date === d.date ? 'active' : ''}`} aria-pressed={date === d.date} onClick={() => { setDate(d.date); setTime(null); next('date'); }}><strong>{fmtDate(d.date)}</strong></button>)}</div>)}

        {step === 'time' && (slots.loading ? <p role="status">Chargement des horaires…</p> : slots.error ? <p role="alert">{slots.error}</p> : !slots.list.length
          ? <EmptyState title="Plus aucun horaire libre ce jour" description="Choisis une autre date." compact action={<BladeButton onClick={() => setStep('date')}>Changer de date</BladeButton>}/>
          : <div className="blade-choices blade-choices-small">{slots.list.map(t => <button type="button" key={t} className={`blade-choice ${time === t ? 'active' : ''}`} aria-pressed={time === t} onClick={() => { setTime(t); next('time'); }}><strong>{t}</strong></button>)}</div>)}

        {step === 'recap' && <form className="blade-local-form" onSubmit={submit}>
          {needsAddress ? addressField : quote.loading ? <p role="status">Calcul du prix…</p> : quote.error ? <p role="alert">{quote.error}</p> : quote.data && <dl className="blade-key-values">
            <div><dt>{quote.data.quote.label}</dt><dd>{fmtPrice(quote.data.quote.base)}</dd></div>
            {quote.data.quote.hourly > 0 && <div><dt>Supplément horaire</dt><dd>{fmtPrice(quote.data.quote.hourly)}</dd></div>}
            {quote.data.quote.sameDay > 0 && <div><dt>Réservation le jour même</dt><dd>{fmtPrice(quote.data.quote.sameDay)}</dd></div>}
            {quote.data.quote.sunday > 0 && <div><dt>Supplément dimanche</dt><dd>{fmtPrice(quote.data.quote.sunday)}</dd></div>}
            {mode === 'deplacement' && <div><dt>Déplacement ({quote.data.travel_minutes} min)</dt><dd>{fmtPrice(quote.data.quote.travel)}</dd></div>}
            <div><dt><strong>Total</strong></dt><dd><strong>{fmtPrice(quote.data.quote.total)}</strong></dd></div>
            {quote.data.deposit > 0 && <div><dt>Acompte à régler</dt><dd>{fmtPrice(quote.data.deposit)}</dd></div>}
          </dl>}
          {quote.data && <p className="blade-note">{quote.data.status === 'pending' ? `Ton rendez-vous sera confirmé dès que ${data.name} aura reçu ton acompte (Revolut ou carte).` : 'Ton rendez-vous sera confirmé immédiatement.'}</p>}
          <div className="blade-fields">
            <Field label="Nom" value={name} onChange={setName} required/>
            <Field label="Téléphone" type="tel" value={phone} onChange={setPhone} required/>
            {settings.custom_questions.map(q => <label key={q.id} className="blade-field"><span>{q.label}{q.required ? ' *' : ''}</span>
              {q.type === 'text' ? <input value={answers[q.id] ?? ''} maxLength={300} required={q.required} onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}/>
                : <select value={answers[q.id] ?? ''} required={q.required} onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}><option value="">Choisir</option>{(q.type === 'yesno' ? ['Oui', 'Non'] : q.options ?? []).map(o => <option key={o}>{o}</option>)}</select>}
            </label>)}
            <Field label="Message (facultatif)" value={notes} onChange={setNotes}/>
          </div>
          {rules && <div className="blade-brand-welcome"><strong>Conditions de {data.name}</strong><p>{rules}</p><label className="blade-checkbox"><input type="checkbox" checked={rulesAck} onChange={e => setRulesAck(e.target.checked)}/>J’ai lu et j’accepte ces conditions</label></div>}
          {sendError && <p role="alert" className="blade-error">{sendError}</p>}
          <BladeButton type="submit" variant="default" disabled={sending || !quote.data || name.trim().length < 2 || !phone.trim() || (!!rules && !rulesAck)}>{sending ? 'Enregistrement…' : 'Confirmer la réservation'}</BladeButton>
        </form>}
      </Section>
      <Section title="Ta sélection">
        <dl className="blade-key-values">{selection.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}{mode === 'deplacement' && addressOk && <div><dt>Adresse</dt><dd>{addressOk}</dd></div>}</dl>
        <div className="blade-secondary-links"><Link to={`/blade/client/profil-professionnel?pro=${data.provider_id}`}>Profil de {data.name} <ArrowRight size={16}/></Link></div>
      </Section>
    </div>
  </BrandScope>;
}

/** Old recap route now lives inside the booking flow. */
export function Recap() { return <Navigate to="/blade/client/reserver" replace/>; }

export function Confirmation() {
  const [p] = useSearchParams();
  const id = p.get('rdv'); const status = p.get('statut'); const deposit = Number(p.get('acompte') || 0); const total = Number(p.get('total') || 0);
  if (!id) return <><PageHeading title="Confirmation"/><EmptyState title="Aucune réservation à confirmer" action={<BladeButton asChild variant="default"><Link to="/blade/client/reserver">Réserver</Link></BladeButton>}/></>;
  const pending = status === 'pending';
  return <><PageHeading title={pending ? 'Réservation enregistrée' : 'Rendez-vous confirmé'} description={pending ? 'Il reste à régler l’acompte.' : 'À bientôt !'}/>
    <Section title={pending ? 'Acompte à régler' : 'C’est noté'}>
      <p>Total : <strong>{fmtPrice(total)}</strong>{pending && <> · Acompte : <strong>{fmtPrice(deposit)}</strong></>}</p>
      {pending ? <><p className="blade-note">Ton rendez-vous sera confirmé dès que le professionnel aura reçu l’acompte.</p><DepositButton bookingId={id}/></> : <p className="blade-note">Tu recevras un email de confirmation.</p>}
      <div className="blade-secondary-links"><Link to="/blade/client/rendez-vous">Mes rendez-vous <ArrowRight size={16}/></Link></div>
    </Section></>;
}
