import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from './data';
import { Search, ArrowRight, Pause, Play, User, Scissors, CalendarDays } from 'lucide-react';

function GoogleMark() {
  return <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>;
}

function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const v = ref.current; if (!v) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { v.pause(); setPlaying(false); return; }
    v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, []);
  const toggle = () => { const v = ref.current; if (!v) return; if (v.paused) v.play().then(() => setPlaying(true)).catch(() => {}); else { v.pause(); setPlaying(false); } };
  return <div className="bl-video">
    <video ref={ref} src="/blade/hero.mp4" poster="/blade/hero-poster.jpg" muted loop playsInline preload="metadata" aria-label="Vidéo de présentation : coiffures réalisées" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
    <button type="button" className="bl-video-toggle" onClick={toggle} aria-label={playing ? 'Mettre la vidéo en pause' : 'Lire la vidéo'}>{playing ? <Pause size={16} /> : <Play size={16} />}</button>
  </div>;
}

export function Landing() {
  return <div className="bl-landing blade-app">
    <a href="#bl-main" className="blade-skip">Aller au contenu</a>
    <header className="bl-header">
      <Link to="/blade" className="bl-logo" aria-label="BLADE — accueil"><img src="/blade/logo-black.png" alt="BLADE" width="1920" height="402" /></Link>
      <Link to="/blade/client" className="bl-btn bl-btn-dark bl-header-cta"><Search size={18} aria-hidden="true" />Trouver un professionnel</Link>
    </header>
    <main id="bl-main" className="bl-main">
      <section className="bl-hero">
        <div className="bl-hero-text">
          <h1>Votre style.<br />Votre lieu.</h1>
          <p>Barbers et coiffeuses, à domicile ou près de vous.</p>
          <Link to="/blade/client" className="bl-btn bl-btn-dark bl-btn-lg"><Search size={22} aria-hidden="true" />Trouver un professionnel</Link>
        </div>
        <HeroVideo />
      </section>
      <section className="bl-access" aria-label="Accès aux espaces">
        <article className="bl-access-group">
          <header className="bl-access-head">
            <span className="bl-access-bullet" aria-hidden="true"><User size={22} /></span>
            <h2>Je suis client</h2>
          </header>
          <div className="bl-access-body">
            <p>Trouvez votre professionnel et réservez.</p>
            <div className="bl-access-actions">
              <Link to="/blade/connexion?espace=client" className="bl-btn bl-btn-dark">Connexion client <ArrowRight size={18} aria-hidden="true" /></Link>
              <Link to="/blade/connexion?espace=client&mode=google" className="bl-btn bl-btn-outline"><GoogleMark />Continuer avec Google</Link>
              <Link to="/blade/connexion?espace=client&mode=inscription" className="bl-link">Créer un compte</Link>
            </div>
          </div>
        </article>
        <article className="bl-access-group bl-access-group-pro">
          <header className="bl-access-head">
            <span className="bl-access-bullet bl-access-bullet-dark" aria-hidden="true"><Scissors size={20} /><CalendarDays size={20} /></span>
            <h2>Je suis professionnel</h2>
          </header>
          <div className="bl-access-body">
            <p>Organisez vos rendez-vous et votre activité.</p>
            <div className="bl-access-actions">
              <Link to="/blade/connexion?espace=pro" className="bl-btn bl-btn-dark">Connexion professionnelle <ArrowRight size={18} aria-hidden="true" /></Link>
              <Link to="/blade/connexion?espace=pro&mode=google" className="bl-btn bl-btn-outline"><GoogleMark />Continuer avec Google</Link>
              <Link to="/blade/connexion?espace=pro&mode=inscription" className="bl-link">Créer un compte professionnel</Link>
            </div>
          </div>
        </article>
      </section>
    </main>
    <footer className="bl-footer"><span>© BLADE</span><nav aria-label="Liens"><span>Aide</span><span>Confidentialité</span></nav></footer>
  </div>;
}

export function DemoLogin() {
  const [params] = useSearchParams();
  const pro = params.get('espace') === 'pro';
  const signup = params.get('mode') === 'inscription';
  const target = pro ? '/blade/pro' : '/blade/client';
  const navigate = useNavigate();
  const { session } = useSession();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  useEffect(() => { if (session) navigate(target, { replace: true }); }, [session, navigate, target]);
  const title = signup ? (pro ? 'Créer un compte professionnel' : 'Créer un compte') : (pro ? 'Connexion professionnelle' : 'Connexion client');
  const google = async () => { setBusy(true); setMsg(''); const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}${target}` } }); if (error) { setMsg(error.message); setBusy(false); } };
  const submit = async (e: React.FormEvent) => { e.preventDefault(); setBusy(true); setMsg('');
    const { data, error } = signup ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}${target}` } }) : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false); if (error) setMsg(error.message); else if (signup && !data.session) setMsg('Vérifiez vos e-mails pour confirmer votre compte.'); };
  return <div className="bl-landing blade-app">
    <header className="bl-header"><Link to="/blade" className="bl-logo" aria-label="BLADE — accueil"><img src="/blade/logo-black.png" alt="BLADE" width="1920" height="402" /></Link></header>
    <main className="bl-main bl-demo">
      <article className={`bl-card ${pro ? 'bl-card-dark' : ''}`}>
        <h1>{title}</h1>
        <p>Mêmes comptes que LCS Barber.</p>
        <button type="button" className="bl-btn bl-btn-outline" onClick={google} disabled={busy}><GoogleMark />Continuer avec Google</button>
        <form className="bl-demo-form" onSubmit={submit}>
          <label>E-mail<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
          <label>Mot de passe<input type="password" autoComplete={signup ? 'new-password' : 'current-password'} required minLength={6} value={password} onChange={e => setPassword(e.target.value)} /></label>
          <button type="submit" className={`bl-btn ${pro ? 'bl-btn-light' : 'bl-btn-dark'}`} disabled={busy}>{busy ? 'Patientez…' : signup ? 'Créer mon compte' : 'Se connecter'}</button>
        </form>
        {msg && <p role="alert">{msg}</p>}
        <Link to={`/blade/connexion?espace=${pro ? 'pro' : 'client'}${signup ? '' : '&mode=inscription'}`} className="bl-link">{signup ? 'J’ai déjà un compte' : 'Créer un compte'}</Link>
        <Link to="/blade" className="bl-link">Retour à l’accueil</Link>
      </article>
    </main>
  </div>;
}
