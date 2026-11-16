import { useEffect, useState } from 'react';

// Animation d'arrivée : le logo BLADE apparaît puis le rideau se lève sur la page d'accueil.
// Jouée une fois par session, ignorée si l'utilisateur préfère réduire les animations.
const KEY = 'blade-intro-seen';
const DURATION = 2600;

function shouldPlay() {
  try {
    if (sessionStorage.getItem(KEY)) return false;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    return true;
  } catch { return false; }
}

export function BladeIntro() {
  const [visible, setVisible] = useState(shouldPlay);
  useEffect(() => {
    if (!visible) return;
    try { sessionStorage.setItem(KEY, '1'); } catch { /* stockage indisponible */ }
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => setVisible(false), DURATION);
    const skip = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') setVisible(false); };
    window.addEventListener('keydown', skip);
    return () => { window.clearTimeout(timer); window.removeEventListener('keydown', skip); document.body.style.overflow = previous; };
  }, [visible]);
  if (!visible) return null;
  return <div className="blade-intro" aria-hidden="true" onClick={() => setVisible(false)}>
    <div className="blade-intro-mark">
      <img src="/blade/logo-white.png" alt="" width="1920" height="402" />
      <span className="blade-intro-line" />
    </div>
  </div>;
}
