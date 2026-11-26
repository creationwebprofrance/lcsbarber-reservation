// Provider sign-up: creates a pending provider account that the superadmin must validate.
import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { BladeButton, BladeLogo, EmptyState } from './common';
import { registerProvider, useSession, type ProviderSignup } from './data';

const PHONE = /^\+?[0-9][0-9 .-]{6,18}[0-9]$/;
const HANDLE = /^@?[A-Za-z0-9._]{1,30}$/;

export function BecomeProvider() {
  const { ready, session, provider, isAdmin, firstName } = useSession();
  const [form, setForm] = useState<ProviderSignup>({ displayName: '', firstName: '', lastName: '', phone: '', instagram: '', snapchat: '', tiktok: '' });
  const set = (k: keyof ProviderSignup) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  if (!ready) return null;
  if (provider || isAdmin) return <Navigate to="/blade/pro" replace/>;
  async function submit(e: FormEvent) {
    e.preventDefault();
    // Contrôles indicatifs : le serveur (blade_register_provider) refait les mêmes vérifications.
    const v = form.displayName.trim();
    if (v.length < 2 || v.length > 80) { setError('Indique un nom affiché entre 2 et 80 caractères.'); return; }
    if (!form.firstName.trim() || !form.lastName.trim()) { setError('Indique ton prénom et ton nom.'); return; }
    if (!PHONE.test(form.phone.trim()) || form.phone.replace(/\D/g, '').length < 8 || form.phone.replace(/\D/g, '').length > 15) { setError('Indique un numéro de téléphone valide.'); return; }
    for (const [k, label] of [['instagram', 'Instagram'], ['snapchat', 'Snapchat'], ['tiktok', 'TikTok']] as const) {
      const h = form[k].trim(); if (h && !HANDLE.test(h)) { setError(`Pseudo ${label} invalide : lettres, chiffres, point ou tiret bas (30 caractères au plus).`); return; }
    }
    setBusy(true); setError('');
    try { await registerProvider(form); } catch (err) { setError(err instanceof Error ? err.message : 'Inscription impossible'); } finally { setBusy(false); }
  }
  return <div className="blade-app"><main className="blade-main" id="blade-content">
    <BladeLogo/>
    {!session ? <EmptyState icon="user" title="Devenir prestataire BLADE" description="Connecte-toi d’abord, puis crée ton compte prestataire. LCS Barber validera ton inscription." action={<BladeButton variant="default" asChild><Link to="/blade/connexion?espace=pro&next=/blade/devenir-pro">Se connecter</Link></BladeButton>}/>
      : <form className="blade-local-form" onSubmit={submit} style={{ maxWidth: 520, margin: '32px auto' }}>
          <h1>Devenir prestataire</h1>
          <p className="blade-lead">Crée ton compte professionnel. Il sera actif dès que LCS Barber l’aura validé.</p>
          <div className="blade-fields">
            <label className="blade-field"><span>Prénom</span><input value={form.firstName} onChange={set('firstName')} autoComplete="given-name" required maxLength={60}/></label>
            <label className="blade-field"><span>Nom</span><input value={form.lastName} onChange={set('lastName')} autoComplete="family-name" required maxLength={60}/></label>
          </div>
          <label className="blade-field"><span>Téléphone</span><input type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" inputMode="tel" placeholder="06 12 34 56 78" required maxLength={20}/></label>
          <label className="blade-field"><span>Nom affiché aux clients</span><input value={form.displayName} onChange={set('displayName')} placeholder={firstName ? `${firstName} Coiffure` : 'Ton nom ou ton salon'} required minLength={2} maxLength={80}/></label>
          <fieldset className="blade-fields blade-socials"><legend>Réseaux sociaux (facultatif)</legend>
            <label className="blade-field"><span>Instagram</span><input value={form.instagram} onChange={set('instagram')} placeholder="@tonpseudo" autoCapitalize="none" spellCheck={false} maxLength={31}/></label>
            <label className="blade-field"><span>Snapchat</span><input value={form.snapchat} onChange={set('snapchat')} placeholder="@tonpseudo" autoCapitalize="none" spellCheck={false} maxLength={31}/></label>
            <label className="blade-field"><span>TikTok</span><input value={form.tiktok} onChange={set('tiktok')} placeholder="@tonpseudo" autoCapitalize="none" spellCheck={false} maxLength={31}/></label>
          </fieldset>
          <p className="blade-note">Ton prénom, ton nom, ton téléphone et tes réseaux sont traités par Lucas Chipan, éditeur de BLADE, pour étudier ta demande d’inscription et te contacter (mesures précontractuelles). Seuls toi et l’équipe BLADE les voient : ils n’apparaissent pas sur ta page publique. Ils sont conservés tant que ton compte prestataire existe ; si ta demande est refusée, tu peux en obtenir la suppression sur simple demande. Tes droits : <a className="blade-text-link" href="/politique-de-confidentialite">politique de confidentialité</a>.</p>
          {error && <p className="blade-form-error" role="alert">{error}</p>}
          <BladeButton type="submit" variant="default" disabled={busy}>{busy ? 'Envoi…' : 'Créer mon compte prestataire'}</BladeButton>
        </form>}
  </main></div>;
}
