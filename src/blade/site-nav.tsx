import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, X, ArrowRight, UserRound } from 'lucide-react';
import { PreferenceControls, useBladePreferences, type Language } from './preferences';

const extra: Record<Language, { pricing: string; menu: string; close: string; nav: string }> = {
  fr: { pricing: 'Tarifs', menu: 'Ouvrir le menu', close: 'Fermer le menu', nav: 'Navigation principale' },
  en: { pricing: 'Pricing', menu: 'Open menu', close: 'Close menu', nav: 'Main navigation' },
  es: { pricing: 'Precios', menu: 'Abrir menú', close: 'Cerrar menú', nav: 'Navegación principal' },
};

function Logo() {
  return <Link to="/blade" className="bl3-logo" aria-label="BLADE Hairstyle — accueil">
    <span className="blade-lockup">
      <img className="bl3-logo-light" src="/blade/logo-black.png" alt="BLADE" width="1920" height="402" />
      <img className="bl3-logo-dark" src="/blade/logo-white.png" alt="" aria-hidden="true" width="1920" height="402" />
      <span className="blade-hairstyle" aria-hidden="true">Hairstyle</span>
    </span>
  </Link>;
}

// Barre de navigation des pages publiques BLADE (accueil, tarifs).
export function SiteNav() {
  const { t, language } = useBladePreferences();
  const x = extra[language] ?? extra.fr;
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => { setOpen(false); }, [location.pathname, location.hash]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc);
  }, [open]);
  const links = <>
    <NavLink to="/blade/client" className="bl3-link">{t('explore')}</NavLink>
    <Link to="/blade#blade-gallery" className="bl3-link">{t('how')}</Link>
    <NavLink to="/blade/tarifs" className="bl3-link">{x.pricing}</NavLink>
  </>;
  const actions = <>
    <Link to="/blade/connexion?espace=client" className="bl3-btn bl3-btn-ghost"><UserRound size={17} aria-hidden="true" />{t('personal')}</Link>
    <Link to="/blade/connexion?espace=pro" className="bl3-btn bl3-btn-solid">{t('professional')}<ArrowRight size={17} aria-hidden="true" /></Link>
  </>;
  return <header className={`bl3-header${scrolled ? ' is-scrolled' : ''}${open ? ' is-open' : ''}`}>
    <div className="bl3-bar">
      <Logo />
      <nav className="bl3-links" aria-label={x.nav}>{links}</nav>
      <div className="bl3-right">
        <PreferenceControls />
        <div className="bl3-actions">{actions}</div>
        <button type="button" className="bl3-burger" aria-expanded={open} aria-controls="bl3-panel" aria-label={open ? x.close : x.menu} onClick={() => setOpen(o => !o)}>{open ? <X size={22} /> : <Menu size={22} />}</button>
      </div>
    </div>
    {open && <div id="bl3-panel" className="bl3-panel">
      <nav className="bl3-panel-links" aria-label={x.nav}>{links}</nav>
      <div className="bl3-panel-actions">{actions}</div>
      <div className="bl3-panel-prefs"><PreferenceControls /></div>
    </div>}
  </header>;
}

export function SiteFooter() {
  const { t, language } = useBladePreferences();
  const x = extra[language] ?? extra.fr;
  return <footer className="bl2-footer"><span>© BLADE</span><nav aria-label="Liens"><Link to="/blade/tarifs">{x.pricing}</Link><Link to="/blade/barber">Barbers en Île-de-France</Link><Link to="/blade/outils/calculateur-barber">Calculateur barber</Link><Link to="/blade#blade-gallery">{t('help')}</Link></nav><div className="bl2-legal"><strong>Informations légales</strong><ul><li><a href="/mentions-legales">Mentions légales</a></li><li><a href="/cgv">CGV</a></li><li><a href="/politique-de-confidentialite">Politique de confidentialité</a></li><li><a href="/droit-de-retractation">Droit de rétractation</a></li></ul></div></footer>;
}

// Fait défiler jusqu'à l'ancre (#...) après un changement de page.
export function useHashScroll() {
  const { hash, pathname } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const timer = window.setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
    return () => window.clearTimeout(timer);
  }, [hash, pathname]);
}
