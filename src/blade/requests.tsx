import { useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { BladeButton, EmptyState, Icon, Modal } from './common';
import { isoDate, fmtDate, submitSlotRequest, useSlotRequests, useSession } from './data';
import { SLOT_REQUESTS_ACTIVE, slotRequestSchema } from './request-model';

export function RequestSlot({ mode }: { mode: 'domicile' | 'deplacement' }) {
  const [open, setOpen] = useState(false);
  return <><BladeButton variant="default" onClick={() => setOpen(true)}><Icon name="calendar"/>Demander un créneau</BladeButton>{open && <Modal title="Demander un créneau" onClose={() => setOpen(false)}><RequestForm mode={mode}/></Modal>}</>;
}

function RequestForm({ mode }: { mode: 'domicile' | 'deplacement' }) {
  const { session, email } = useSession(); const id = useId();
  const [requestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [result, setResult] = useState<{ email_sent: boolean } | null>(null);
  const today = isoDate(new Date());
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || !SLOT_REQUESTS_ACTIVE || !session) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = slotRequestSchema.safeParse({ ...fields, mode, request_id: requestId });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Vérifiez les informations.'); return; }
    if (parsed.data.requested_date < today) { setError('Choisissez une date à partir d’aujourd’hui.'); return; }
    setBusy(true); setError('');
    try { setResult(await submitSlotRequest(parsed.data)); } catch (e) { setError(e instanceof Error ? e.message : 'Demande non envoyée. Réessayez.'); } finally { setBusy(false); }
  }
  if (result) return <EmptyState title="Demande enregistrée" description={result.email_sent ? 'Le coiffeur a reçu votre demande dans son espace et par e-mail. Ce n’est pas une réservation confirmée.' : 'Votre demande est visible dans l’espace du coiffeur, mais la notification e-mail n’a pas pu être envoyée. Ce n’est pas une réservation confirmée.'} compact/>;
  return <form className="blade-local-form" onSubmit={submit}>
    <p className="blade-note"><Icon name={mode === 'deplacement' ? 'home' : 'pin'}/> {mode === 'deplacement' ? 'Chez vous — LCS Barber se déplace' : 'Près de vous — vous venez chez LCS Barber'}</p>
    <div className="blade-fields">
      <div className="blade-field"><label htmlFor={`${id}-name`}>Nom</label><input id={`${id}-name`} name="client_name" autoComplete="name" required minLength={2} maxLength={100} defaultValue={session?.user.user_metadata.full_name ?? ''}/></div>
      <div className="blade-field"><label htmlFor={`${id}-email`}>E-mail</label><input id={`${id}-email`} name="client_email" type="email" autoComplete="email" required maxLength={255} defaultValue={email}/></div>
      <div className="blade-field"><label htmlFor={`${id}-date`}>Date souhaitée</label><input id={`${id}-date`} name="requested_date" type="date" min={today} required/></div>
      <div className="blade-field"><label htmlFor={`${id}-time`}>Horaire souhaité</label><input id={`${id}-time`} name="requested_time" type="time" required/></div>
      <div className="blade-field blade-field-full"><label htmlFor={`${id}-message`}>Message (facultatif)</label><textarea id={`${id}-message`} name="message" maxLength={1000}/></div>
    </div>
    <p className="blade-note">La demande ne confirme pas de rendez-vous.</p>
    {!SLOT_REQUESTS_ACTIVE && <p className="blade-note" role="status">L’envoi des demandes sera disponible après activation de BLADE.</p>}
    {!session && <BladeButton asChild><Link to="/blade/connexion?espace=client">Se connecter pour envoyer une demande</Link></BladeButton>}
    {error && <p role="alert" className="blade-error">{error}</p>}
    <BladeButton type="submit" variant="default" disabled={!SLOT_REQUESTS_ACTIVE || !session || busy}>{busy ? 'Envoi…' : 'Envoyer la demande'}</BladeButton>
  </form>;
}

function RequestsInbox() {
  const { data, loading, error } = useSlotRequests();
  if (loading) return <p role="status" className="blade-note">Chargement des demandes…</p>;
  if (error) return <p role="alert" className="blade-error">Impossible de charger les demandes : {error}</p>;
  if (!data?.length) return <EmptyState title="Aucune demande de créneau" compact/>;
  return <ul className="blade-slot-requests">{data.map(r => <li key={r.id}><header><strong>{r.client_name}</strong><span>Demande de créneau</span></header><p>{fmtDate(r.requested_date)} · {r.requested_time.slice(0,5)} · {r.mode === 'deplacement' ? 'Chez le client' : 'Chez LCS Barber'}</p><a className="blade-text-link" href={`mailto:${r.client_email}`}>{r.client_email}</a>{r.message && <p>{r.message}</p>}<small>Reçue le {new Date(r.created_at).toLocaleString('fr-FR')}</small></li>)}</ul>;
}

export function ProfessionalRequests() {
  const { session, ready, isAdmin } = useSession();
  if (!ready) return <p className="blade-note" role="status">Chargement…</p>;
  if (!session || !isAdmin) return <EmptyState title="Connexion professionnelle requise" compact/>;
  if (!SLOT_REQUESTS_ACTIVE) return <p className="blade-note">Les demandes de créneau apparaîtront ici après activation de BLADE.</p>;
  return <RequestsInbox/>;
}