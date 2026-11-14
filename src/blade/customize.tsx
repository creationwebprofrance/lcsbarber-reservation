// Pro: customize the public profile and the booking page.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BladeButton, EmptyState, Section, Tabs, Plus, ArrowRight } from './common';
import { Field, ProviderPage, Status } from './provider';
import { ALL_SECTIONS, FONTS, FONT_KEYS, PALETTE, SECTIONS, moveItem, parseOptions, shortId, toggleSection, type FontKey } from './customization-model';
import { pageOf, savePage, uploadMedia, useMediaUrls, usePublicPage, type PageSettings } from './customization-data';
import { BrandScope, BrandLogo, useBrandFont } from './brand';
import { stepsFor, type BookingModes, type Question, type StepOrder } from '../../supabase/functions/_shared/blade-booking-rules';

export function ProCustomize() { return <ProviderPage title="Personnalisation">{data => <CustomizeBody providerId={data.provider_id}/>}</ProviderPage>; }

const MODE_CHOICES: [BookingModes, string, string][] = [
  ['both', 'Les deux', 'Le client choisit : chez toi ou chez lui'],
  ['domicile', 'Seulement sur place', 'Le client vient chez toi'],
  ['deplacement', 'Seulement à domicile', 'Tu te déplaces chez le client'],
];
const ORDER_CHOICES: StepOrder[] = ['service', 'place', 'date'];
const STEP_NAMES = { service: 'Prestation', place: 'Lieu', date: 'Date', time: 'Horaire', recap: 'Récapitulatif' };
const QUESTION_TYPES: [Question['type'], string][] = [['text', 'Réponse libre'], ['choice', 'Choix dans une liste'], ['yesno', 'Oui / Non']];

function FontSamples() { for (const k of FONT_KEYS) useBrandFont(k); return null; }

function MediaPicker({ label, url, busy, onPick, onRemove }: { label: string; url?: string; busy: boolean; onPick: (f: File) => void; onRemove: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return <div className="blade-media-picker"><strong>{label}</strong>
    {url ? <img src={url} alt=""/> : <div className="blade-media-empty">Aucune image</div>}
    <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ''; }}/>
    <div className="blade-inline"><BladeButton disabled={busy} onClick={() => ref.current?.click()}>{busy ? 'Envoi…' : url ? 'Changer' : 'Ajouter'}</BladeButton>{url && <BladeButton onClick={onRemove}>Retirer</BladeButton>}</div>
  </div>;
}

function CustomizeBody({ providerId }: { providerId: string }) {
  const [refresh, setRefresh] = useState(0);
  const state = usePublicPage(providerId, refresh);
  const [draft, setDraft] = useState<PageSettings | null>(null);
  const [tab, setTab] = useState('Profil');
  const [busy, setBusy] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const galleryRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (state.data) setDraft(pageOf(state.data)); }, [state.data]);
  const urls = useMediaUrls(draft ? [draft.logo_path, draft.cover_path, ...draft.gallery_paths] : []);
  if (state.loading && !draft) return <p role="status">Chargement…</p>;
  if (!state.data || !draft) return <EmptyState icon="user" title="Profil indisponible" description={state.error ?? 'Ton compte doit être actif pour personnaliser ton profil.'}/>;
  const name = state.data.name;
  const set = (patch: Partial<PageSettings>) => { setDraft(d => d ? { ...d, ...patch } : d); setMessage(''); };
  const setQ = (i: number, patch: Partial<Question>) => set({ custom_questions: draft.custom_questions.map((q, j) => j === i ? { ...q, ...patch } : q) });

  async function upload(file: File, kind: 'logo' | 'cover' | 'gallery') {
    setBusy(kind); setError('');
    try {
      const path = await uploadMedia(providerId, file, kind);
      setDraft(d => !d ? d : kind === 'gallery' ? { ...d, gallery_paths: [...d.gallery_paths, path].slice(0, 12) } : { ...d, [`${kind}_path`]: path });
      setMessage('Photo ajoutée. Pense à enregistrer.');
    } catch (e) { setError((e as Error).message); } finally { setBusy(''); }
  }
  async function save() {
    const bad = draft!.custom_questions.find(q => q.label.trim().length < 2 || (q.type === 'choice' && (q.options ?? []).length < 2));
    if (bad) { setError('Chaque question doit avoir un intitulé, et une question à choix au moins 2 réponses (séparées par des virgules).'); setTab('Réservation'); return; }
    setSaving(true); setError(''); setMessage('');
    try {
      await savePage({ ...draft!, custom_questions: draft!.custom_questions.map(q => ({ id: q.id, label: q.label.trim(), type: q.type, required: q.required, ...(q.type === 'choice' ? { options: q.options } : {}) })) });
      setMessage('Enregistré. Ton profil et ta page de réservation sont à jour.'); setRefresh(n => n + 1);
    } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  }

  const ordered = [...draft.sections, ...ALL_SECTIONS.filter(k => !draft.sections.includes(k))];
  const saveBar = <div className="blade-save-bar"><BladeButton variant="default" disabled={saving || !!busy} onClick={save}>{saving ? 'Enregistrement…' : 'Enregistrer'}</BladeButton>
    <Link className="blade-text-link" to={`/blade/profil/${providerId}`} target="_blank">Voir mon profil <ArrowRight size={16}/></Link>
    <Link className="blade-text-link" to={`/blade/client/reserver?pro=${providerId}`} target="_blank">Voir ma page de réservation <ArrowRight size={16}/></Link>
    <Status error={error} message={message}/></div>;

  return <>
    <FontSamples/>
    <Tabs options={['Profil', 'Réservation']} value={tab} onChange={setTab}/>
    {tab === 'Profil' ? <>
      <div className="blade-two-columns">
        <Section title="Couleur et police">
          <div className="blade-swatches" role="group" aria-label="Couleur principale">
            {PALETTE.map(c => <button type="button" key={c} className="blade-swatch" style={{ background: c }} aria-label={`Couleur ${c}`} aria-pressed={draft.accent_color.toLowerCase() === c.toLowerCase()} onClick={() => set({ accent_color: c })}/>)}
            <label className="blade-swatch-custom">Autre<input type="color" value={draft.accent_color} onChange={e => set({ accent_color: e.target.value.toUpperCase() })}/></label>
          </div>
          <div className="blade-choices blade-choices-small" role="group" aria-label="Police">
            {FONT_KEYS.map(k => <button type="button" key={k} className={`blade-choice ${draft.font_key === k ? 'active' : ''}`} aria-pressed={draft.font_key === k} onClick={() => set({ font_key: k as FontKey })} style={{ fontFamily: FONTS[k].heading }}><strong>{FONTS[k].label}</strong><small style={{ fontFamily: FONTS[k].body }}>Aa · {name}</small></button>)}
          </div>
        </Section>
        <Section title="Aperçu">
          <BrandScope accent={draft.accent_color} font={draft.font_key}><div className="blade-preview-box">
            <div className="blade-brand-identity blade-preview-identity"><BrandLogo url={draft.logo_path ? urls[draft.logo_path] : undefined} name={name}/><div><h2>{name}</h2>{draft.city && <p>{draft.city}</p>}</div></div>
            <p>{draft.bio || 'Ta présentation apparaîtra ici.'}</p>
            <div className="blade-inline"><BladeButton variant="default">Réserver</BladeButton><BladeButton>Voir les prestations</BladeButton></div>
          </div></BrandScope>
        </Section>
      </div>
      <Section title="Logo et couverture">
        <div className="blade-media-row">
          <MediaPicker label="Logo" url={draft.logo_path ? urls[draft.logo_path] : undefined} busy={busy === 'logo'} onPick={f => upload(f, 'logo')} onRemove={() => set({ logo_path: null })}/>
          <MediaPicker label="Photo de couverture" url={draft.cover_path ? urls[draft.cover_path] : undefined} busy={busy === 'cover'} onPick={f => upload(f, 'cover')} onRemove={() => set({ cover_path: null })}/>
        </div>
        <p className="blade-note">JPEG, PNG ou WebP, 5 Mo maximum.</p>
      </Section>
      <Section title="Présentation">
        <div className="blade-fields">
          <div className="blade-field-full"><Field label="Présentation (bio)" type="textarea" value={draft.bio ?? ''} onChange={v => set({ bio: v })}/></div>
          <Field label="Ville" value={draft.city ?? ''} onChange={v => set({ city: v })}/>
          <Field label="Adresse du salon (si le client vient)" value={draft.salon_address ?? ''} onChange={v => set({ salon_address: v })}/>
          <Field label="Instagram (sans @)" value={draft.instagram ?? ''} onChange={v => set({ instagram: v })}/>
          <Field label="TikTok (sans @)" value={draft.tiktok ?? ''} onChange={v => set({ tiktok: v })}/>
        </div>
      </Section>
      <Section title="Sections du profil">
        <p className="blade-note">Coche les sections à afficher et choisis leur ordre.</p>
        <ol className="blade-order-list">{ordered.map(k => { const on = draft.sections.includes(k); const i = draft.sections.indexOf(k); return <li key={k} className={on ? '' : 'off'}>
          <label className="blade-checkbox"><input type="checkbox" checked={on} onChange={() => set({ sections: toggleSection(draft.sections, k) })}/>{SECTIONS[k]}</label>
          {on && <span className="blade-inline"><BladeButton aria-label={`Monter ${SECTIONS[k]}`} disabled={i === 0} onClick={() => set({ sections: moveItem(draft.sections, i, -1) })}>↑</BladeButton><BladeButton aria-label={`Descendre ${SECTIONS[k]}`} disabled={i === draft.sections.length - 1} onClick={() => set({ sections: moveItem(draft.sections, i, 1) })}>↓</BladeButton></span>}
        </li>; })}</ol>
      </Section>
      <Section title={`Galerie (${draft.gallery_paths.length}/12)`} action={<BladeButton disabled={draft.gallery_paths.length >= 12 || busy === 'gallery'} onClick={() => galleryRef.current?.click()}><Plus size={16}/>{busy === 'gallery' ? 'Envoi…' : 'Ajouter'}</BladeButton>}>
        <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f, 'gallery'); e.target.value = ''; }}/>
        {draft.gallery_paths.length ? <div className="blade-gallery-grid">{draft.gallery_paths.map((p, i) => <figure key={p}>{urls[p] ? <img src={urls[p]} alt={`Photo ${i + 1}`}/> : <div className="blade-media-empty">…</div>}<BladeButton onClick={() => set({ gallery_paths: draft.gallery_paths.filter(x => x !== p) })}>Retirer</BladeButton></figure>)}</div>
          : <EmptyState icon="image" title="Aucune photo" description="Ajoute tes réalisations (uniquement avec l’accord de tes clients)." compact/>}
      </Section>
    </> : <>
      <Section title="Lieux proposés">
        <div className="blade-choices">{MODE_CHOICES.map(([v, l, d]) => <button type="button" key={v} className={`blade-choice ${draft.booking_modes === v ? 'active' : ''}`} aria-pressed={draft.booking_modes === v} onClick={() => set({ booking_modes: v })}><strong>{l}</strong><small>{d}</small></button>)}</div>
      </Section>
      <Section title="Ordre des étapes">
        <div className="blade-choices">{ORDER_CHOICES.map(o => <button type="button" key={o} className={`blade-choice ${draft.step_order === o ? 'active' : ''}`} aria-pressed={draft.step_order === o} onClick={() => set({ step_order: o })}><strong>{stepsFor(o, draft.booking_modes).filter(s => s !== 'recap').map(s => STEP_NAMES[s]).join(' → ')}</strong></button>)}</div>
      </Section>
      <Section title="Message et conditions">
        <div className="blade-fields">
          <div className="blade-field-full"><Field label="Message d’accueil (affiché en haut de la réservation)" type="textarea" value={draft.welcome_message ?? ''} onChange={v => set({ welcome_message: v })}/></div>
          <div className="blade-field-full"><Field label="Conditions (annulation, retard, consignes…)" type="textarea" value={draft.booking_rules ?? ''} onChange={v => set({ booking_rules: v })}/></div>
        </div>
        <p className="blade-note">Si tu écris des conditions, le client doit les accepter avant de réserver.</p>
      </Section>
      <Section title={`Questions au client (${draft.custom_questions.length}/5)`} action={<BladeButton disabled={draft.custom_questions.length >= 5} onClick={() => set({ custom_questions: [...draft.custom_questions, { id: shortId('q'), label: '', type: 'text', required: false }] })}><Plus size={16}/>Ajouter une question</BladeButton>}>
        {!draft.custom_questions.length && <EmptyState icon="message" title="Aucune question" description="Ex. : type de cheveux, longueur souhaitée, allergies…" compact/>}
        {draft.custom_questions.map((q, i) => <div key={q.id} className="blade-question-row">
          <div className="blade-fields">
            <div className="blade-field-full"><Field label={`Question ${i + 1}`} value={q.label} onChange={v => setQ(i, { label: v })}/></div>
            <label className="blade-field"><span>Type de réponse</span><select value={q.type} onChange={e => setQ(i, { type: e.target.value as Question['type'] })}>{QUESTION_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            {q.type === 'choice' && <ChoiceOptions value={q.options ?? []} onChange={options => setQ(i, { options })}/>}
          </div>
          <div className="blade-inline"><label className="blade-checkbox"><input type="checkbox" checked={q.required} onChange={e => setQ(i, { required: e.target.checked })}/>Réponse obligatoire</label>
            <BladeButton disabled={i === 0} onClick={() => set({ custom_questions: moveItem(draft.custom_questions, i, -1) })}>↑</BladeButton>
            <BladeButton onClick={() => set({ custom_questions: draft.custom_questions.filter(x => x.id !== q.id) })}>Supprimer</BladeButton></div>
        </div>)}
      </Section>
    </>}
    {saveBar}
  </>;
}

function ChoiceOptions({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState(value.join(', '));
  return <Field label="Réponses proposées (séparées par des virgules)" value={text} onChange={v => { setText(v); onChange(parseOptions(v)); }}/>;
}
