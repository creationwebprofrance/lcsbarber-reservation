// Carrousel à défilement automatique continu (boucle sans fin), pause au survol ou au toucher,
// flèches pour avancer à la main. Mouvement réduit : défilement manuel uniquement.
import { Children, cloneElement, isValidElement, useEffect, useRef, type ReactElement, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Carousel({ label, children, speed = 38, className = '' }: { label: string; children: ReactNode; speed?: number; className?: string }) {
  const track = useRef<HTMLUListElement>(null);
  const hold = useRef(0);            // pause jusqu'à cet instant (ms)
  const hover = useRef(false);
  const pos = useRef(0);
  const items = Children.toArray(children).filter(isValidElement) as ReactElement[];
  const auto = items.length > 1 && typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Les copies servent seulement à boucler sans à-coup : invisibles pour le clavier et les lecteurs d'écran.
  useEffect(() => { track.current?.querySelectorAll('[data-dup]').forEach(e => { e.setAttribute('inert', ''); e.setAttribute('aria-hidden', 'true'); }); });

  useEffect(() => {
    const el = track.current; if (!el || !auto) return;
    let frame = 0; let last = performance.now(); let visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }); io.observe(el);
    pos.current = el.scrollLeft;
    const loopWidth = () => { const dup = el.querySelector<HTMLElement>('[data-dup]'); const first = el.firstElementChild as HTMLElement | null; return dup && first ? dup.offsetLeft - first.offsetLeft : 0; };
    const tick = (t: number) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min(64, t - last); last = t;
      if (!visible || hover.current || t < hold.current || document.visibilityState !== 'visible') { pos.current = el.scrollLeft; return; }
      const w = loopWidth(); if (!w) return;
      pos.current += (speed * dt) / 1000;
      if (pos.current >= w) pos.current -= w;
      el.scrollLeft = pos.current;
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); io.disconnect(); };
  }, [auto, speed, items.length]);

  const step = (dir: 1 | -1) => {
    const el = track.current; if (!el) return;
    const item = el.querySelector<HTMLElement>(':scope > li');
    const gap = parseFloat(getComputedStyle(el).columnGap) || 16;
    hold.current = performance.now() + 900;
    let target = el.scrollLeft + dir * ((item?.offsetWidth ?? el.clientWidth) + gap);
    if (!auto) { const max = el.scrollWidth - el.clientWidth; target = target > max + 4 ? 0 : target < -4 ? max : target; }
    else if (target < 0) { const dup = el.querySelector<HTMLElement>('[data-dup]'); const w = dup ? dup.offsetLeft - (el.firstElementChild as HTMLElement).offsetLeft : 0; el.scrollLeft += w; target += w; }
    el.scrollTo({ left: target, behavior: 'smooth' });
  };

  return <div className={`bl-carousel ${auto ? 'is-auto' : ''} ${className}`} role="region" aria-roledescription="carrousel" aria-label={label}
    onMouseEnter={() => { hover.current = true; }} onMouseLeave={() => { hover.current = false; }}
    onTouchStart={() => { hold.current = performance.now() + 60000; }} onTouchEnd={() => { hold.current = performance.now() + 2500; }}
    onFocus={() => { hold.current = performance.now() + 60000; }} onBlur={() => { hold.current = performance.now() + 1500; }}>
    <ul ref={track} className="bl-carousel-track">
      {items}
      {auto && items.map((c, i) => cloneElement(c as ReactElement<Record<string, unknown>>, { key: `dup-${c.key ?? i}`, 'data-dup': '' }))}
    </ul>
    <div className="bl-carousel-nav">
      <button type="button" onClick={() => step(-1)} aria-label="Précédent"><ChevronLeft size={20} aria-hidden="true" /></button>
      <button type="button" onClick={() => step(1)} aria-label="Suivant"><ChevronRight size={20} aria-hidden="true" /></button>
    </div>
  </div>;
}
