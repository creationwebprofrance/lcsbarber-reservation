// Profils enregistrés pour de vrai : coordonnées personnelles, préférences et, côté pro, l'identité publique.
import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { updateOwnProvider, useSession } from './data';
import { pageOf, savePage, usePublicPage, useAsync } from './customization-data';
import { BladeButton, Section, Icon, ArrowRight } from './common';

export type Prefs = { place?: string; channel?: string; hair?: string; travel_conditions?: string; notes?: string; notif_booking?: boolean; notif_payment?: boolean; notif_reminders?: boolean; consent_reminders?: boolean };
export type MyProfile = { first_name: string | null; last_name: string | null; phone: string | null; address: string | null; prefs: Prefs };
type Draft = { first_name: string; last_name: string; phone: string; address: string; prefs: Prefs };

const rpc = async <T,>(fn: string, args?: Record<string, unknown>): Promise<T> => {
  const { data, error } = await (supabase as SupabaseClient).rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
};
const loadProfile = () => rpc<MyProfile>('blade_my_profile');
export const saveMyProfile = (d: Draft) => rpc<MyProfile>('blade_save_my_profile', { p_values: d });
const toDraft = (p: MyProfile | null): Draft => ({ first_name: p?.first_name ?? '', last_name: p?.last_name ?? '', phone: p?.phone ?? '', address: p?.address ?? '', prefs: p?.prefs ?? {} });
const PHONE = /^[+0-9 ().-]{6,30}$/;

function Text({ label, value, onChange, kind = 'text', full, readOnly, hint, max }: { label: string; value: string; onChange?: (v: string) => void; kind?: string; full?: boolean; readOnly?: boolean; hint?: string; max?: number }) {
  const id = useId();
  return <div className={`blade-field${full ? ' blade-field-full' : ''}`}>
    <label htmlFor={id}>{label}</label>
    {kind === 'textarea'
      ? <textarea id={id} value={value} maxLength={max ?? 600} onChange={e => onChange?.(e.target.value)} />
      : <input id={id} type={kind} value={value} maxLength={max} readOnly={readOnly} onChange={e => onChange?.(e.target.value)} />}
    {hint && <small>{hint}</small>}
  </div>;
}
function Choice({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  const id = useId();
  return <div className="blade-field"><label htmlFor={id}>{label}</label><select id={id} value={value} onChange={e => onChange(e.target.value)}><option value="">Sélectionner</option>{options.map(o => <option key={o}>{o}</option>)}</select></div>;
}
function Check({ label, value, onChange }: { label: string; value?: boolean; onChange: (v: boolean) => void }) {
  return <label className="blade-checkbox"><input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} />{label}</label>;
}

/** Charge le profil du compte connecté et gère l'état d'enregistrement. */
function useProfileDraft() {
  const { session, ready } = useSession();
  const state = useAsync(() => session ? loadProfile() : Promise.resolve(null), [session?.user.id]);
  const [draft, setDraft] = useState<Draft>(toDraft(null));
  useEffect(() => { if (state.data) setDraft(toDraft(state.data)); }, [state.data]);
  const set = (p: Partial<Draft>) => setDraft(d => ({ ...d, ...p }));
  const setPref = (p: Partial<Prefs>) => setDraft(d => ({ ...d, prefs: { ...d.prefs, ...p } }));
  return { session, ready, loading: !ready || state.loading, draft, set, setPref };
}

function SaveBar({ busy, message, error, label = 'Enregistrer' }: { busy: boolean; message: string; error: string; label?: string }) {
  return <div className="blade-save-bar">
    <BladeButton variant="default" type="submit" disabled={busy}><Icon name="user" size={18} />{busy ? 'Enregistrement…' : label}</BladeButton>
    {message && <span role="status" className="blade-save-ok">{message}</span>}
    {error && <span role="alert" className="blade-form-error">{error}</span>}
  </div>;
}
function NeedLogin({ space }: { space: 'client' | 'pro' }) {
  return <Section title="Connexion requise"><p className="blade-note">Connecte-toi pour modifier ton profil.</p><BladeButton asChild><Link to={`/blade/connexion?espace=${space}`}>Se connecter <ArrowRight size={16} /></Link></BladeButton></Section>;
}
function check(d: Draft): string {
  if (d.phone.trim() && !PHONE.test(d.phone.trim())) return 'Numéro de téléphone invalide.';
  return '';
}
function useSubmit(run: () => Promise<void>) {
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  const submit = async (e: FormEvent, validate: () => string) => {
    e.preventDefault(); setMessage(''); setError('');
    const problem = validate(); if (problem) { setError(problem); return; }
    setBusy(true);
    try { await run(); setMessage('Profil enregistré.'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Enregistrement impossible. Réessaie.'); }
    finally { setBusy(false); }
  };
  return { busy, message, error, submit };
}

const NotifChecks = ({ prefs, setPref, client }: { prefs: Prefs; setPref: (p: Partial<Prefs>) => void; client?: boolean }) => <>
  <Check label={client ? 'Recevoir des notifications de rendez-vous' : 'Notifications de rendez-vous'} value={prefs.notif_booking} onChange={v => setPref({ notif_booking: v })} />
  {client
    ? <Check label="Consentement aux relances" value={prefs.consent_reminders} onChange={v => setPref({ consent_reminders: v })} />
    : <><Check label="Notifications de paiement" value={prefs.notif_payment} onChange={v => setPref({ notif_payment: v })} /><Check label="Rappels et relances" value={prefs.notif_reminders} onChange={v => setPref({ notif_reminders: v })} /></>}
</>;

export function ClientProfileForm() {
  const { session, loading, draft, set, setPref } = useProfileDraft();
  const { busy, message, error, submit } = useSubmit(async () => { await saveMyProfile(draft); });
  if (loading) return <p role="status">Chargement…</p>;
  if (!session) return <NeedLogin space="client" />;
  return <form onSubmit={e => submit(e, () => check(draft))}>
    <Section title="Identité et coordonnées"><div className="blade-fields">
      <Text label="Prénom" value={draft.first_name} max={80} onChange={v => set({ first_name: v })} />
      <Text label="Nom" value={draft.last_name} max={80} onChange={v => set({ last_name: v })} />
      <Text label="E-mail" kind="email" value={session.user.email ?? ''} readOnly hint="L’e-mail est celui de ton compte." />
      <Text label="Téléphone" kind="tel" value={draft.phone} max={30} onChange={v => set({ phone: v })} />
      <Text label="Adresse" full value={draft.address} max={300} onChange={v => set({ address: v })} />
    </div></Section>
    <Section title="Préférences"><div className="blade-fields">
      <Choice label="Lieu préféré" value={draft.prefs.place ?? ''} options={['À domicile', 'Chez le professionnel']} onChange={v => setPref({ place: v })} />
      <Choice label="Canal de contact" value={draft.prefs.channel ?? ''} options={['E-mail', 'Message']} onChange={v => setPref({ channel: v })} />
      <Text label="Préférences de coiffure" kind="textarea" full value={draft.prefs.hair ?? ''} onChange={v => setPref({ hair: v })} />
    </div><NotifChecks prefs={draft.prefs} setPref={setPref} client /></Section>
    <SaveBar busy={busy} message={message} error={error} />
  </form>;
}

export function ProProfileForm() {
  const { provider } = useSession();
  const { session, loading, draft, set, setPref } = useProfileDraft();
  const page = usePublicPage(provider?.id ?? null);
  const current = page.data && provider && page.data.provider_id === provider.id ? pageOf(page.data) : null;
  const [biz, setBiz] = useState({ name: '', bio: '', city: '', salon_address: '' });
  useEffect(() => { if (provider) setBiz(b => ({ ...b, name: provider.display_name ?? '' })); }, [provider?.id, provider?.display_name]);
  useEffect(() => { if (current) setBiz(b => ({ ...b, bio: current.bio ?? '', city: current.city ?? '', salon_address: current.salon_address ?? '' })); }, [page.data]);
  const { busy, message, error, submit } = useSubmit(async () => {
    await saveMyProfile(draft);
    if (!provider) return;
    if (biz.name.trim() && biz.name.trim() !== (provider.display_name ?? '')) {
      const links = provider.opt_payment_links;
      await updateOwnProvider(biz.name.trim(), links ? provider.revolut_url ?? '' : '', links ? provider.stripe_link_url ?? '' : '');
    }
    await savePage({ bio: biz.bio.trim() || null, city: biz.city.trim() || null, salon_address: biz.salon_address.trim() || null });
  });
  if (loading) return <p role="status">Chargement…</p>;
  if (!session) return <NeedLogin space="pro" />;
  const b = (p: Partial<typeof biz>) => setBiz(x => ({ ...x, ...p }));
  return <form onSubmit={e => submit(e, () => check(draft) || (provider && !biz.name.trim() ? 'Le nom de l’activité est obligatoire.' : ''))}>
    <Section title="Identité et activité"><div className="blade-fields">
      <Text label="Prénom" value={draft.first_name} max={80} onChange={v => set({ first_name: v })} />
      <Text label="Nom" value={draft.last_name} max={80} onChange={v => set({ last_name: v })} />
      {provider && <Text label="Nom de l’activité" value={biz.name} max={80} onChange={v => b({ name: v })} hint="Affiché sur ton profil public et sur la carte." />}
      <Text label="E-mail" kind="email" value={session.user.email ?? ''} readOnly hint="L’e-mail est celui de ton compte." />
      <Text label="Téléphone" kind="tel" value={draft.phone} max={30} onChange={v => set({ phone: v })} />
      {provider && <Text label="Présentation" kind="textarea" full value={biz.bio} max={600} onChange={v => b({ bio: v })} />}
    </div></Section>
    <Section title="Photos et logo"><p className="blade-note">Ton logo, ta photo de couverture et ta galerie se gèrent dans la personnalisation de ton profil.</p><BladeButton asChild><Link to="/blade/pro/personnalisation"><Icon name="palette" />Gérer mes photos</Link></BladeButton></Section>
    <div className="blade-two-columns">
      <Section title="Disponibilités"><p className="blade-note">Tes horaires et tes créneaux se règlent dans l’agenda.</p><Link className="blade-text-link" to="/blade/pro/agenda">Ouvrir l’agenda <ArrowRight size={16} /></Link></Section>
      <Section title="Zone d’intervention"><div className="blade-fields">
        {provider && <Text label="Ville" value={biz.city} max={80} onChange={v => b({ city: v })} />}
        {provider && <Text label="Adresse du salon" value={biz.salon_address} max={300} onChange={v => b({ salon_address: v })} />}
        <Text label="Conditions de déplacement" kind="textarea" full value={draft.prefs.travel_conditions ?? ''} onChange={v => setPref({ travel_conditions: v })} />
      </div></Section>
    </div>
    <Section title="Notifications et préférences"><div className="blade-fields">
      <Choice label="Canal préféré" value={draft.prefs.channel ?? ''} options={['E-mail', 'Message']} onChange={v => setPref({ channel: v })} />
      <Text label="Préférences" kind="textarea" full value={draft.prefs.notes ?? ''} onChange={v => setPref({ notes: v })} />
    </div><NotifChecks prefs={draft.prefs} setPref={setPref} /></Section>
    <SaveBar busy={busy} message={message} error={error} />
  </form>;
}

/** Réglages des notifications seuls (page Paramètres). */
export function NotificationSettingsForm({ children }: { children?: ReactNode }) {
  const { session, loading, draft, setPref } = useProfileDraft();
  const { busy, message, error, submit } = useSubmit(async () => { await saveMyProfile(draft); });
  if (loading) return <p role="status">Chargement…</p>;
  if (!session) return <NeedLogin space="pro" />;
  return <form onSubmit={e => submit(e, () => '')}>
    <div className="blade-fields"><Choice label="Canal préféré" value={draft.prefs.channel ?? ''} options={['E-mail', 'Message']} onChange={v => setPref({ channel: v })} /></div>
    <NotifChecks prefs={draft.prefs} setPref={setPref} />{children}
    <SaveBar busy={busy} message={message} error={error} />
  </form>;
}
