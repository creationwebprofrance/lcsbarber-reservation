// Carrousel léger : défilement natif (glisser au doigt), flèches, défilement automatique en pause au survol.
import { useEffect, useRef, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Carousel({ label, children, autoMs = 4500, className = '' }: { label: string; children: ReactNode; autoMs?: number; className?: string }) {
  const track = useRef<HTMLUListElement>(null);
  const paused = useRef(false);

  const step = (dir: 1 | -1) => {
    const el = track.current; if (!el) return;
    const item = el.querySelector<HTMLElement>(':scope > li');
    const gap = parseFloat(getComputedStyle(el).columnGap) || 16;
    const w = (item?.offsetWidth ?? el.clientWidth) + gap;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 8;
    if (dir === 1 && atEnd) el.scrollTo({ left: 0, behavior: 'smooth' });
    else if (dir === -1 && el.scrollLeft <= 8) el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
    else el.scrollBy({ left: dir * w, behavior: 'smooth' });
  };

  useEffect(() => {
    if (!autoMs || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => { if (!paused.current && document.visibilityState === 'visible') step(1); }, autoMs);
    return () => window.clearInterval(id);
  }, [autoMs]);

  const pause = (v: boolean) => () => { paused.current = v; };
  return <div className={`bl-carousel ${className}`} role="region" aria-roledescription="carrousel" aria-label={label}
    onMouseEnter={pause(true)} onMouseLeave={pause(false)} onFocus={pause(true)} onBlur={pause(false)} onTouchStart={pause(true)}>
    <ul ref={track} className="bl-carousel-track">{children}</ul>
    <div className="bl-carousel-nav">
      <button type="button" onClick={() => step(-1)} aria-label="Précédent"><ChevronLeft size={20} aria-hidden="true" /></button>
      <button type="button" onClick={() => step(1)} aria-label="Suivant"><ChevronRight size={20} aria-hidden="true" /></button>
    </div>
  </div>;
}
