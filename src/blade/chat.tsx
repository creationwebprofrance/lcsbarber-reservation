// BLADE pro chat: barbers post prestations to hand over; replies notify the offer author by email (server-side, staged).
import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BladeButton, EmptyState, Icon, PageHeading, Section } from './common';
import { useSession, fmtDate } from './data';

type Offer = { id: string; author_id: string; author_name: string; title: string; body: string; city: string | null; offer_date: string | null; price: number | null; status: string; created_at: string };
type Reply = { id: string; offer_id: string; author_id: string; author_name: string; body: string; created_at: string };
// Tables are staged; not yet in generated types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export function ProChat() {
  const { session, isAdmin, ready, firstName } = useSession();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const [o, r] = await Promise.all([
      db.from('blade_offers').select('*').order('created_at', { ascending: false }).limit(100),
      db.from('blade_offer_replies').select('*').order('created_at', { ascending: true }).limit(1000),
    ]);
    if (o.error || r.error) setError('Le chat sera disponible après l’activation de cette version.');
    else { setError(''); setOffers(o.data); setReplies(r.data); }
    setLoading(false);
  }, []);
  useEffect(() => {
    if (!session || !isAdmin) return;
    load();
    const channel = supabase.channel(`blade-chat-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blade_offers' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blade_offer_replies' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session, isAdmin, load]);

  if (!ready) return null;
  if (!session || !isAdmin) return <EmptyState title="Connexion requise" description="Le chat entre coiffeurs est réservé aux comptes professionnels." icon="message"/>;
  const name = firstName || session.user.email?.split('@')[0] || 'Coiffeur';
  return <div className="blade-chat">
    <PageHeading pro title="Chat coiffeurs" description="Proposez une prestation à un autre coiffeur. L’auteur d’une annonce reçoit un e-mail à chaque réponse."/>
    <NewOffer authorId={session.user.id} authorName={name} onDone={load}/>
    {error ? <EmptyState title="Chat pas encore activé" description={error} icon="message" compact/>
      : loading ? <p className="blade-note">Chargement…</p>
      : offers.length === 0 ? <EmptyState title="Aucune annonce" description="Publiez la première prestation à céder." icon="message" compact/>
      : offers.map(o => <OfferCard key={o.id} offer={o} replies={replies.filter(r => r.offer_id === o.id)} userId={session.user.id} userName={name} onChange={load}/>)}
  </div>;
}

function NewOffer({ authorId, authorName, onDone }: { authorId: string; authorName: string; onDone: () => void }) {
  const id = useId(); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget; const f = new FormData(form);
    const title = String(f.get('title') ?? '').trim(); const body = String(f.get('body') ?? '').trim();
    const price = f.get('price') ? Number(f.get('price')) : null;
    if (title.length < 2 || body.length < 1) { setMsg('Ajoutez un titre et une description.'); return; }
    if (price !== null && (!Number.isFinite(price) || price < 0)) { setMsg('Prix invalide.'); return; }
    setBusy(true); setMsg('');
    const { error } = await db.from('blade_offers').insert({ author_id: authorId, author_name: authorName, title: title.slice(0, 120), body: body.slice(0, 2000), city: String(f.get('city') ?? '').trim() || null, offer_date: f.get('offer_date') || null, price });
    setBusy(false);
    if (error) setMsg('Annonce non publiée. Le chat n’est peut-être pas encore activé.'); else { form.reset(); onDone(); }
  }
  return <Section title="Proposer une prestation">
    <form className="blade-local-form" onSubmit={submit}>
      <div className="blade-fields">
        <div className="blade-field blade-field-full"><label htmlFor={`${id}-t`}>Titre</label><input id={`${id}-t`} name="title" required maxLength={120} placeholder="Ex. Coupe + barbe samedi matin"/></div>
        <div className="blade-field"><label htmlFor={`${id}-c`}>Ville</label><input id={`${id}-c`} name="city" maxLength={80}/></div>
        <div className="blade-field"><label htmlFor={`${id}-d`}>Date</label><input id={`${id}-d`} name="offer_date" type="date"/></div>
        <div className="blade-field"><label htmlFor={`${id}-p`}>Prix (€)</label><input id={`${id}-p`} name="price" type="number" min={0} step="0.5"/></div>
        <div className="blade-field blade-field-full"><label htmlFor={`${id}-b`}>Détails</label><textarea id={`${id}-b`} name="body" required maxLength={2000} rows={3}/></div>
      </div>
      {msg && <p className="blade-error" role="alert">{msg}</p>}
      <BladeButton variant="default" type="submit" disabled={busy}><Icon name="message"/>{busy ? 'Publication…' : 'Publier'}</BladeButton>
    </form>
  </Section>;
}

function OfferCard({ offer, replies, userId, userName, onChange }: { offer: Offer; replies: Reply[]; userId: string; userName: string; onChange: () => void }) {
  const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [info, setInfo] = useState('');
  const mine = offer.author_id === userId;
  async function reply(e: FormEvent) {
    e.preventDefault(); const body = text.trim(); if (!body || busy) return;
    setBusy(true); setInfo('');
    const { data, error } = await db.from('blade_offer_replies').insert({ offer_id: offer.id, author_id: userId, author_name: userName, body: body.slice(0, 2000) }).select('id').single();
    if (error) { setBusy(false); setInfo('Réponse non envoyée.'); return; }
    setText('');
    if (!mine) {
      const { data: n } = await supabase.functions.invoke('blade-notify', { body: { event: 'offer_reply', reply_id: data.id } });
      setInfo(n?.email_sent ? `${offer.author_name} a été prévenu par e-mail.` : 'Réponse publiée. Aucun e-mail envoyé (option désactivée pour ce prestataire).');
    }
    setBusy(false); onChange();
  }
  async function toggle() { await db.from('blade_offers').update({ status: offer.status === 'open' ? 'taken' : 'open' }).eq('id', offer.id); onChange(); }
  return <Section title={offer.title} action={<span className="blade-pill">{offer.status === 'open' ? 'Disponible' : 'Attribuée'}</span>}>
    <p className="blade-note">{offer.author_name} · {fmtDate(offer.created_at.slice(0, 10))}{offer.city ? ` · ${offer.city}` : ''}{offer.offer_date ? ` · le ${fmtDate(offer.offer_date)}` : ''}{offer.price != null ? ` · ${offer.price} €` : ''}</p>
    <p style={{ whiteSpace: 'pre-wrap' }}>{offer.body}</p>
    {mine && <BladeButton onClick={toggle}>{offer.status === 'open' ? 'Marquer attribuée' : 'Rouvrir'}</BladeButton>}
    <ul className="blade-chat-replies">{replies.map(r => <li key={r.id}><strong>{r.author_name}</strong> <span className="blade-note">{new Date(r.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span><p style={{ whiteSpace: 'pre-wrap' }}>{r.body}</p></li>)}</ul>
    <form className="blade-chat-reply" onSubmit={reply}>
      <textarea aria-label="Votre réponse" value={text} onChange={e => setText(e.target.value)} maxLength={2000} rows={2} placeholder="Répondre…"/>
      <BladeButton variant="default" type="submit" disabled={busy || !text.trim()}>Envoyer</BladeButton>
    </form>
    {info && <p className="blade-note" role="status">{info}</p>}
  </Section>;
}
