import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from './data';
import { ArrowRight, Pause, Play, Home, MapPin, Check } from 'lucide-react';
import { Gallery } from './gallery';
import { BladeButton } from './common';
import { PreferenceControls, useBladePreferences } from './preferences';

function GoogleMark() {
  return <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>;
}

function HeroVideo() {
  const {t}=useBladePreferences();
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const v = ref.current; if (!v) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { v.pause(); setPlaying(false); return; }
    v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    const pause=()=>{v.pause();setPlaying(false);};document.addEventListener('blade-reader-open',pause);return()=>document.removeEventListener('blade-reader-open',pause);
  }, []);
  const toggle = () => { const v = ref.current; if (!v) return; if (v.paused) v.play().then(() => setPlaying(true)).catch(() => {}); else { v.pause(); setPlaying(false); } };
  return <div className="bl-video">
    <video ref={ref} src="/blade/hero.mp4" poster="/blade/hero-poster.jpg" muted loop playsInline preload="metadata" aria-label="Vidéo de présentation : coiffures réalisées" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
    <BladeButton type="button" className="bl-video-toggle" onClick={toggle} aria-label={playing ? t('pause') : t('play')}>{playing ? <Pause size={16} /> : <Play size={16} />}</BladeButton>
  </div>;
}

export function Landing() {
  const {t}=useBladePreferences();const {session,isAdmin}=useSession();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'chez' | 'pres'>('chez');
  const [city, setCity] = useState('');
  const go = (e?: React.FormEvent) => { e?.preventDefault(); const p = new URLSearchParams({ mode: mode === 'chez' ? 'Chez vous' : 'Près de vous' }); if (city.trim()) p.set('q', city.trim()); navigate(`/blade/client?${p}`); };
  return <div className="bl-landing bl2 blade-app">
    <a href="#bl-main" className="blade-skip">Aller au contenu</a>
    <header className="bl2-header">
      <Link to="/blade" className="bl-logo" aria-label="BLADE — accueil"><img src="/blade/logo-black.png" alt="BLADE" width="1920" height="402" /></Link>
      <nav className="bl2-nav" aria-label="Navigation principale">
        <Link to="/blade/client" className="bl2-navlink">{t('explore')}</Link>
        <span className="bl2-sep" aria-hidden="true" />
        <a href="#blade-gallery" className="bl2-navlink">{t('how')}</a>
        <Link to="/blade/connexion?espace=client" className="bl2-pill bl2-pill-outline">{t('personal')}</Link>
        <Link to="/blade/connexion?espace=pro" className="bl2-pill bl2-pill-dark">{t('professional')}</Link>
        <PreferenceControls/>
      </nav>
    </header>
    <main id="bl-main" className="bl2-main">
      <section className="bl2-hero">
        <div className="bl2-hero-text">
          <h1>{t('slogan1')}<br />{t('slogan2')}</h1>
          <p className="bl2-lead">{t('lead')}</p>
          <form className="bl2-search" onSubmit={go}>
            <div className="bl2-modes" role="radiogroup" aria-label="Lieu de prestation">
              <BladeButton type="button" role="radio" aria-checked={mode === 'chez'} className={`bl2-mode ${mode === 'chez' ? 'active' : ''}`} onClick={() => setMode('chez')}><Home size={26} aria-hidden="true" /><span>{t('home')}</span>{mode === 'chez' && <i className="bl2-check"><Check size={16} /></i>}</BladeButton>
              <BladeButton type="button" role="radio" aria-checked={mode === 'pres'} className={`bl2-mode ${mode === 'pres' ? 'active' : ''}`} onClick={() => setMode('pres')}><MapPin size={26} aria-hidden="true" /><span>{t('near')}</span>{mode === 'pres' && <i className="bl2-check"><Check size={16} /></i>}</BladeButton>
            </div>
            <div className="bl2-row">
              <label className="bl2-input"><MapPin size={22} aria-hidden="true" /><span className="sr-only">{t('city')}</span><input value={city} onChange={e => setCity(e.target.value)} placeholder={t('city')} /></label>
              <BladeButton type="submit" variant="default" className="bl2-submit">{t('find')} <ArrowRight size={20} aria-hidden="true" /></BladeButton>
            </div>
            <p className="bl2-note">{t('public')}</p>
          </form>
        </div>
        <HeroVideo />
      </section>
      <section id="bl-map" className="bl2-map" aria-label="Carte">
        <div className="bl2-map-text">
          <MapPin size={44} className="bl2-map-pin" aria-hidden="true" />
          <div>
            <h2>{t('mapTitle')}</h2>
            <p>{t('mapText')}</p>
            <Link to="/blade/client" className="bl2-pill bl2-pill-outline bl2-map-cta">{t('map')} <ArrowRight size={18} aria-hidden="true" /></Link>
          </div>
          <span className="bl2-tag">— barbers</span>
        </div>
        <div className="bl2-map-art" aria-hidden="true"><span className="bl2-map-halo"><MapPin size={40} /></span></div>
      </section>
      <Gallery/>
      <section className="blade-collaboration blade-reveal"><div><h2>{t('collaborationTitle')}</h2><p>{t('collaborationText')}</p><ul>{(['recommend','availability','collaborate'] as const).map(key=><li key={key}><Check size={18}/>{t(key)}</li>)}</ul><BladeButton asChild><Link to={session&&isAdmin?'/blade/pro/messages':'/blade/connexion?espace=pro'}>{session&&isAdmin?t('messages'):t('network')} <ArrowRight size={18}/></Link></BladeButton></div></section>
      <section className="blade-travel-band blade-reveal"><MapPin size={32}/><div><h2>{t('slogan1')} {t('slogan2')}</h2><p>{t('travel')}</p></div><BladeButton asChild variant="default"><Link to="/blade/client">{t('find')} <ArrowRight size={18}/></Link></BladeButton></section>
    </main>
    <footer className="bl2-footer"><span>© BLADE</span><nav aria-label="Liens"><a href="#blade-gallery">{t('help')}</a></nav><div className="bl2-legal"><strong>Informations légales</strong><ul><li><a href="/mentions-legales">Mentions légales</a></li><li><a href="/cgv">CGV</a></li><li><a href="/politique-de-confidentialite">Politique de confidentialité</a></li><li><a href="/droit-de-retractation">Droit de rétractation</a></li></ul></div></footer>
  </div>;
}

export function DemoLogin() {
  const [params] = useSearchParams();
  const pro = params.get('espace') === 'pro';
  const signup = params.get('mode') === 'inscription';
  const target = pro ? '/blade/pro' : '/blade/client';
  const navigate = useNavigate();
  const { session, isAdmin, ready } = useSession();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  useEffect(() => { if (ready && session) navigate(isAdmin ? '/blade/pro' : '/blade/client', { replace: true }); }, [ready, session, isAdmin, navigate]);
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
