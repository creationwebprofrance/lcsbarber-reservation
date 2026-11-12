// Provider sign-up: creates a pending provider account that the superadmin must validate.
import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { BladeButton, BladeLogo, EmptyState } from './common';
import { registerProvider, useSession } from './data';

export function BecomeProvider() {
  const { ready, session, provider, isAdmin, firstName } = useSession();
  const [name, setName] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  if (!ready) return null;
  if (provider || isAdmin) return <Navigate to="/blade/pro" replace/>;
  async function submit(e: FormEvent) {
    e.preventDefault(); const v = name.trim();
    if (v.length < 2 || v.length > 80) { setError('Indique un nom entre 2 et 80 caractères.'); return; }
    setBusy(true); setError('');
    try { await registerProvider(v); } catch (err) { setError(err instanceof Error ? err.message : 'Inscription impossible'); } finally { setBusy(false); }
  }
  return <div className="blade-app"><main className="blade-main" id="blade-content">
    <BladeLogo/>
    {!session ? <EmptyState icon="user" title="Devenir prestataire BLADE" description="Connecte-toi d’abord, puis crée ton compte prestataire. LCS Barber validera ton inscription." action={<BladeButton variant="default" asChild><Link to="/blade/connexion?espace=pro&next=/blade/devenir-pro">Se connecter</Link></BladeButton>}/>
      : <form className="blade-local-form" onSubmit={submit} style={{ maxWidth: 520, margin: '32px auto' }}>
          <h1>Devenir prestataire</h1>
          <p className="blade-lead">Crée ton compte professionnel. Il sera actif dès que LCS Barber l’aura validé.</p>
          <label className="blade-field"><span>Nom affiché aux clients</span><input value={name} onChange={e => setName(e.target.value)} placeholder={firstName ? `${firstName} Coiffure` : 'Ton nom ou ton salon'} required minLength={2} maxLength={80}/></label>
          {error && <p className="blade-form-error" role="alert">{error}</p>}
          <BladeButton type="submit" variant="default" disabled={busy}>{busy ? 'Envoi…' : 'Créer mon compte prestataire'}</BladeButton>
        </form>}
  </main></div>;
}
