// Digital loyalty cards: provider program + cards, client cards, public card link.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { BladeButton, EmptyState, Modal, PageHeading, Section, Plus } from './common';
import { Field, ProviderPage, Status } from './provider';
import { useSession, type ProviderClient } from './data';
import { codeFromScan, earnRule, nextReward, pointsForAmount, shortId, type Reward } from './customization-model';
import { addPoints, cardLink, findCard, issueCard, loyaltyOverview, myCards, publicCard, redeemReward, saveProgram, scanLink, sendCardEmail, useAsync, useMediaUrls, type LoyaltyCard, type LoyaltyProgram } from './customization-data';
import { BrandLogo, BrandScope } from './brand';

const when = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
const errText = (e: unknown) => e instanceof Error ? e.message : 'Action impossible. Réessaie.';

/** The card as the client sees it (client space and public link). */
export function LoyaltyCardView({ card, showQr = true }: { card: LoyaltyCard; showQr?: boolean }) {
  const urls = useMediaUrls([card.logo_path]);
  const rewards = card.program.rewards ?? [];
  const next = nextReward(card.points, rewards);
  return <BrandScope accent={card.accent_color} font={card.font_key}>
    <article className="blade-loyalty-card" aria-label={`Carte fidélité ${card.provider_name}`}>
      <div className="blade-loyalty-head"><BrandLogo url={card.logo_path ? urls[card.logo_path] : undefined} name={card.provider_name}/><div><h3>{card.provider_name}</h3><small>{card.program.name} · {card.client_name}</small></div></div>
      <p><span className="blade-loyalty-points">{card.points}</span> point{card.points > 1 ? 's' : ''}</p>
      {!card.program.active && <p>Programme mis en pause par le professionnel.</p>}
      {next ? <><div className="blade-loyalty-progress" aria-hidden="true"><span style={{ width: `${next.pct}%` }}/></div><small>Encore {next.missing} point{next.missing > 1 ? 's' : ''} pour « {next.reward.label} »</small></>
        : rewards.length ? <small>Toutes les récompenses sont disponibles 🎉</small> : null}
      {rewards.length > 0 && <ul className="blade-loyalty-rewards">{rewards.map(r => <li key={r.id}><span>{r.label}</span><strong>{r.points} pts{card.points >= r.points ? ' · disponible' : ''}</strong></li>)}</ul>}
      <small>Tu gagnes {earnRule(card.program)}.</small>
      {showQr && <><div className="blade-loyalty-qr"><QRCodeSVG value={scanLink(card.code)} size={168} marginSize={1} title="QR code de ta carte"/></div><small className="blade-center">Montre ce QR code à {card.provider_name} à chaque passage.</small></>}
    </article>
    {card.events.length > 0 && <details className="blade-loyalty-details"><summary>Historique des points</summary><ul className="blade-loyalty-history">{card.events.map((e, i) => <li key={i}><span>{e.label ?? e.kind}<small>{when(e.created_at)}</small></span><strong>{e.delta > 0 ? `+${e.delta}` : e.delta}</strong></li>)}</ul></details>}
  </BrandScope>;
}

export function ClientLoyalty() {
  const { session, ready } = useSession();
  const state = useAsync(() => session ? myCards() : Promise.resolve([] as LoyaltyCard[]), [session?.user.id]);
  return <><PageHeading title="Mes cartes de fidélité" description="Tes points chez chaque professionnel."/>
    {!ready || state.loading ? <p role="status">Chargement…</p> : !session ? <EmptyState icon="user" title="Connecte-toi pour voir tes cartes" action={<BladeButton asChild variant="default"><Link to="/blade/connexion?espace=client">Se connecter</Link></BladeButton>}/>
      : state.error ? <Status error={state.error}/> : !state.data?.length ? <EmptyState icon="gift" title="Aucune carte de fidélité" description="Ton professionnel peut t’en offrir une : elle apparaîtra ici si elle est liée à ton adresse email."/>
      : <div className="blade-loyalty-grid">{state.data.map(c => <LoyaltyCardView key={c.id} card={c}/>)}</div>}</>;
}

export function PublicLoyaltyCard() {
  const { code } = useParams();
  const state = useAsync(() => publicCard(codeFromScan(code ?? '') ?? ''), [code]);
  return <div className="blade-app"><main className="blade-main">
    <BladeButton asChild><Link to="/blade">BLADE</Link></BladeButton>
    <PageHeading title="Ma carte de fidélité"/>
    {state.loading ? <p role="status">Chargement…</p> : !state.data ? <EmptyState icon="gift" title="Carte introuvable" description="Ce lien n’est plus valide ou le professionnel n’est plus actif."/>
      : <div className="blade-loyalty-grid"><LoyaltyCardView card={state.data}/></div>}
    {state.data && <p className="blade-note">Pour retrouver cette carte dans ton espace BLADE, connecte-toi avec l’adresse email à laquelle tu l’as reçue. <Link className="blade-text-link" to="/blade/connexion?espace=client">Se connecter</Link></p>}
  </main></div>;
}

// ---------------- Provider ----------------
export function ProLoyalty() { return <ProviderPage title="Fidélité">{data => <LoyaltyBody clients={data.clients}/>}</ProviderPage>; }

function LoyaltyBody({ clients }: { clients: ProviderClient[] }) {
  const [refresh, setRefresh] = useState(0);
  const ov = useAsync(() => loyaltyOverview(), [refresh]);
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState<LoyaltyCard | null>(null);
  const [findError, setFindError] = useState('');
  const [q, setQ] = useState('');
  const open = async (code: string) => { setFindError(''); try { setSelected(await findCard(code)); window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { setFindError(errText(e)); } };
  useEffect(() => { const c = codeFromScan(params.get('carte') ?? ''); if (c) void open(c); }, [params]);
  if (ov.loading && !ov.data) return <p role="status">Chargement…</p>;
  if (ov.error) return <Status error={ov.error}/>;
  const program = ov.data?.program ?? null;
  const cards = (ov.data?.cards ?? []).filter(c => `${c.client_name} ${c.client_email}`.toLowerCase().includes(q.toLowerCase()));
  const programForm = <Section key="program" title="Ma carte fidélité"><ProgramForm program={program} onSaved={() => setRefresh(n => n + 1)}/></Section>;
  const updated = (c: LoyaltyCard) => { setSelected(c); setRefresh(n => n + 1); };
  return <>
    {!program?.active && programForm}
    {selected && <Section title={`Carte de ${selected.client_name}`} action={<BladeButton onClick={() => { setSelected(null); setParams({}); }}>Fermer</BladeButton>}><CardActions card={selected} onChange={updated}/></Section>}
    {program?.active && <>
      <div className="blade-two-columns">
        <Section title="Scanner une carte"><ScanPanel onCode={open}/><Status error={findError}/></Section>
        <Section title="Offrir une carte"><IssueForm clients={clients} onIssued={c => updated(c)}/></Section>
      </div>
      <Section title={`Cartes offertes (${ov.data?.cards.length ?? 0})`}>
        <label className="blade-search"><input type="search" aria-label="Rechercher une carte" placeholder="Rechercher un client" value={q} onChange={e => setQ(e.target.value)}/></label>
        {cards.length ? <div className="blade-provider-list">{cards.map(c => <article key={c.id}><div><h3>{c.client_name}</h3><p>{c.client_email}</p><small>{c.sent_at ? `Email envoyé le ${when(c.sent_at)}` : 'Email non envoyé'}</small></div><strong>{c.points} pts</strong><BladeButton onClick={() => open(c.code)}>Ouvrir</BladeButton></article>)}</div>
          : <EmptyState icon="gift" title="Aucune carte" description="Offre ta première carte à un client." compact/>}
      </Section>
      {programForm}
    </>}
  </>;
}

function ProgramForm({ program, onSaved }: { program: LoyaltyProgram | null; onSaved: () => void }) {
  const [active, setActive] = useState(program?.active ?? true);
  const [name, setName] = useState(program?.name ?? 'Carte fidélité');
  const [kind, setKind] = useState<'visits' | 'euros'>(program?.kind ?? 'visits');
  const [ppv, setPpv] = useState(String(program?.points_per_visit ?? 1));
  const [ppe, setPpe] = useState(String(program?.points_per_euro ?? 1));
  const [rewards, setRewards] = useState<Reward[]>(program?.rewards?.length ? program.rewards : [{ id: shortId('r'), label: 'Coupe offerte', points: 10 }]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const setR = (i: number, patch: Partial<Reward>) => setRewards(r => r.map((x, j) => j === i ? { ...x, ...patch } : x));
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      await saveProgram({ active, name: name.trim(), kind, points_per_visit: Number(ppv), points_per_euro: Number(ppe.replace(',', '.')), rewards: rewards.map(r => ({ ...r, label: r.label.trim(), points: Math.round(Number(r.points)) })) });
      setMessage(active ? 'Carte fidélité enregistrée et active.' : 'Carte fidélité enregistrée (en pause).'); onSaved();
    } catch (err) { setError(errText(err)); } finally { setBusy(false); }
  }
  return <form className="blade-local-form" onSubmit={submit}>
    <p className="blade-note">Choisis comment tes clients gagnent des points et ce qu’ils peuvent obtenir.</p>
    <div className="blade-fields"><Field label="Nom de la carte" value={name} onChange={setName} required/></div>
    <div className="blade-choices" role="group" aria-label="Système de points">
      <button type="button" className={`blade-choice ${kind === 'visits' ? 'active' : ''}`} aria-pressed={kind === 'visits'} onClick={() => setKind('visits')}><strong>Par visite</strong><small>Le client gagne des points à chaque passage</small></button>
      <button type="button" className={`blade-choice ${kind === 'euros' ? 'active' : ''}`} aria-pressed={kind === 'euros'} onClick={() => setKind('euros')}><strong>Par euro dépensé</strong><small>Le client gagne des points selon le montant payé</small></button>
    </div>
    <div className="blade-fields">{kind === 'visits' ? <Field label="Points par visite" type="number" value={ppv} onChange={setPpv} required/> : <Field label="Points par euro dépensé" type="number" value={ppe} onChange={setPpe} required/>}</div>
    <h3>Récompenses</h3>
    {rewards.map((r, i) => <div key={r.id} className="blade-reward-row">
      <Field label="Récompense" value={r.label} onChange={v => setR(i, { label: v })} required/>
      <Field label="Points nécessaires" type="number" value={String(r.points)} onChange={v => setR(i, { points: Number(v) })} required/>
      <BladeButton aria-label={`Supprimer ${r.label || 'la récompense'}`} onClick={() => setRewards(x => x.filter(y => y.id !== r.id))}>Supprimer</BladeButton>
    </div>)}
    <BladeButton disabled={rewards.length >= 8} onClick={() => setRewards(r => [...r, { id: shortId('r'), label: '', points: 20 }])}><Plus size={16}/>Ajouter une récompense</BladeButton>
    <label className="blade-checkbox"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)}/>Carte active (les clients peuvent gagner et utiliser des points)</label>
    <Status error={error} message={message}/>
    <BladeButton type="submit" variant="default" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer ma carte fidélité'}</BladeButton>
  </form>;
}

function IssueForm({ clients, onIssued }: { clients: ProviderClient[]; onIssued: (c: LoyaltyCard) => void }) {
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [send, setSend] = useState(true);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const pick = (id: string) => { const c = clients.find(x => x.id === id); if (c) { setName(c.name); setEmail(c.email); } };
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const card = await issueCard(email, name);
      let note = 'Carte prête.';
      if (send) { const r = await sendCardEmail(card.id); note = r === 'sent' ? `Carte envoyée à ${card.client_email}.` : r === 'disabled' ? 'Carte prête. Les emails automatiques sont désactivés pour ton compte : copie le lien de la carte pour le partager.' : 'Carte prête, mais l’email n’a pas pu partir. Copie le lien de la carte.'; }
      setMessage(note); setName(''); setEmail(''); onIssued(card);
    } catch (err) { setError(errText(err)); } finally { setBusy(false); }
  }
  return <form className="blade-local-form" onSubmit={submit}>
    {clients.length > 0 && <label className="blade-field"><span>Choisir un client existant</span><select value="" onChange={e => pick(e.target.value)}><option value="">—</option>{clients.slice(0, 500).map(c => <option key={c.id} value={c.id}>{c.name} · {c.email}</option>)}</select></label>}
    <div className="blade-fields"><Field label="Nom du client" value={name} onChange={setName} required/><Field label="Email du client" type="email" value={email} onChange={setEmail} required/></div>
    <label className="blade-checkbox"><input type="checkbox" checked={send} onChange={e => setSend(e.target.checked)}/>Envoyer la carte par email (même sans compte BLADE)</label>
    <Status error={error} message={message}/>
    <BladeButton type="submit" variant="default" disabled={busy}>{busy ? 'Création…' : 'Offrir la carte'}</BladeButton>
  </form>;
}

function CardActions({ card, onChange }: { card: LoyaltyCard; onChange: (c: LoyaltyCard) => void }) {
  const p = card.program;
  const [amount, setAmount] = useState(''); const [adjust, setAdjust] = useState(''); const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const run = async (fn: () => Promise<LoyaltyCard>, ok: (c: LoyaltyCard) => string) => {
    setBusy(true); setError(''); setMessage('');
    try { const c = await fn(); onChange(c); setMessage(ok(c)); } catch (e) { setError(errText(e)); } finally { setBusy(false); }
  };
  const value = Number(amount.replace(',', '.'));
  const preview = pointsForAmount(value, Number(p.points_per_euro));
  const copy = async () => { try { await navigator.clipboard.writeText(cardLink(card.code)); setMessage('Lien de la carte copié.'); } catch { setMessage(cardLink(card.code)); } };
  return <div className="blade-card-actions">
    <p><span className="blade-loyalty-points">{card.points}</span> points · {card.client_email}</p>
    <div className="blade-inline">
      {p.kind === 'visits' ? <BladeButton variant="default" disabled={busy} onClick={() => run(() => addPoints(card.id, 'visit'), c => `Visite ajoutée : ${c.points} points.`)}><Plus size={16}/>Ajouter une visite (+{p.points_per_visit})</BladeButton>
        : <form className="blade-inline" onSubmit={e => { e.preventDefault(); void run(() => addPoints(card.id, 'amount', { amount: value }), c => `Dépense ajoutée : ${c.points} points.`); setAmount(''); }}>
          <Field label="Montant payé (€)" type="number" value={amount} onChange={setAmount} required/>
          <BladeButton type="submit" variant="default" disabled={busy || !(value > 0)}><Plus size={16}/>Ajouter {preview > 0 ? `(+${preview})` : ''}</BladeButton></form>}
    </div>
    {(p.rewards ?? []).length > 0 && <><h3>Utiliser une récompense</h3><div className="blade-inline">{p.rewards.map(r => <BladeButton key={r.id} disabled={busy || card.points < r.points} onClick={() => { if (confirm(`Utiliser « ${r.label} » (−${r.points} points) ?`)) void run(() => redeemReward(card.id, r.id), c => `Récompense utilisée. Reste ${c.points} points.`); }}>{r.label} · {r.points} pts</BladeButton>)}</div></>}
    <details><summary>Corriger le solde</summary><form className="blade-inline" onSubmit={e => { e.preventDefault(); void run(() => addPoints(card.id, 'manual', { points: Math.trunc(Number(adjust)), label: reason }), c => `Solde corrigé : ${c.points} points.`); setAdjust(''); setReason(''); }}>
      <label className="blade-field"><span>Points (négatif pour retirer)</span><input type="number" step="1" value={adjust} onChange={e => setAdjust(e.target.value)} required/></label>
      <Field label="Raison" value={reason} onChange={setReason}/>
      <BladeButton type="submit" disabled={busy || !Number(adjust)}>Appliquer</BladeButton></form></details>
    <div className="blade-inline">
      <BladeButton disabled={busy} onClick={async () => { setBusy(true); const r = await sendCardEmail(card.id); setBusy(false); setMessage(r === 'sent' ? `Carte envoyée à ${card.client_email}.` : r === 'disabled' ? 'Les emails automatiques sont désactivés pour ton compte : copie le lien.' : 'Email non envoyé. Copie le lien.'); }}>Envoyer par email</BladeButton>
      <BladeButton onClick={copy}>Copier le lien de la carte</BladeButton>
    </div>
    <Status error={error} message={message}/>
    {card.events.length > 0 && <><h3>Historique</h3><ul className="blade-loyalty-history">{card.events.map((e, i) => <li key={i}><span>{e.label ?? e.kind}<small>{when(e.created_at)}</small></span><strong>{e.delta > 0 ? `+${e.delta}` : e.delta}</strong></li>)}</ul></>}
  </div>;
}

type Detector = { detect: (s: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
function ScanPanel({ onCode }: { onCode: (code: string) => void }) {
  const [text, setText] = useState(''); const [scan, setScan] = useState(false); const [error, setError] = useState('');
  const supported = typeof window !== 'undefined' && 'BarcodeDetector' in window;
  return <>
    <p className="blade-note">{supported ? 'Scanne le QR code de la carte du client.' : 'Scanne le QR code avec l’appareil photo de ton téléphone : la carte s’ouvre directement ici.'}</p>
    {supported && <BladeButton variant="default" onClick={() => setScan(true)}>Scanner un QR code</BladeButton>}
    <form className="blade-inline" onSubmit={e => { e.preventDefault(); const c = codeFromScan(text); if (c) { onCode(c); setText(''); setError(''); } else setError('Code ou lien de carte invalide.'); }}>
      <Field label="Ou colle le lien / code de la carte" value={text} onChange={setText}/><BladeButton type="submit">Ouvrir</BladeButton>
    </form>
    <Status error={error}/>
    {scan && <Modal title="Scanner une carte" onClose={() => setScan(false)}><Scanner onCode={c => { setScan(false); onCode(c); }}/></Modal>}
  </>;
}
function Scanner({ onCode }: { onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null); const [error, setError] = useState(''); const cb = useRef(onCode); cb.current = onCode;
  useEffect(() => {
    let stream: MediaStream | null = null; let timer = 0; let stopped = false;
    const Ctor = (window as unknown as { BarcodeDetector: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
    const detector = new Ctor({ formats: ['qr_code'] });
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(s => {
      stream = s; if (stopped) { s.getTracks().forEach(t => t.stop()); return; }
      if (video.current) { video.current.srcObject = s; void video.current.play(); }
      const tick = async () => { if (stopped || !video.current) return; try { const found = await detector.detect(video.current); const code = found.map(f => codeFromScan(f.rawValue)).find(Boolean); if (code) { cb.current(code); return; } } catch { /* frame not ready */ } timer = window.setTimeout(tick, 350); };
      void tick();
    }).catch(() => setError('Caméra indisponible. Autorise l’accès à la caméra ou colle le lien de la carte.'));
    return () => { stopped = true; clearTimeout(timer); stream?.getTracks().forEach(t => t.stop()); };
  }, []);
  return <>{error ? <Status error={error}/> : <video ref={video} className="blade-scan-video" muted playsInline/>}</>;
}
