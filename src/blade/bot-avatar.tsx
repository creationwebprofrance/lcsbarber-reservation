// Affiche la mascotte 3D quand c'est possible, sinon l'image actuelle du bot.
// La 3D (Three.js) est chargée à la demande pour ne pas alourdir la première page.
import { Component, Suspense, lazy, useEffect, useState, type ReactNode } from 'react';
import type { BotMood } from './bot3d';

const Bot3D = lazy(() => import('./bot3d'));

function canUse3D() {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

class Fallback extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export function BotAvatar({ mood = 'idle', size, className = '' }: { mood?: BotMood; size: number; className?: string }) {
  const image = <img src="/blade/assistant.png" alt="" width={size} height={size} className="blade-bot-img" />;
  const [ready, setReady] = useState(false);
  // On attend que la page soit au repos avant de charger la 3D.
  useEffect(() => {
    if (!canUse3D()) return;
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) { const id = w.requestIdleCallback(() => setReady(true), { timeout: 2500 }); return () => (window as unknown as { cancelIdleCallback?: (i: number) => void }).cancelIdleCallback?.(id); }
    const id = window.setTimeout(() => setReady(true), 1200); return () => window.clearTimeout(id);
  }, []);
  return <span className={`blade-bot3d ${className}`} style={{ width: size, height: size }}>
    {ready ? <Fallback fallback={image}><Suspense fallback={image}><Bot3D mood={mood} /></Suspense></Fallback> : image}
  </span>;
}
