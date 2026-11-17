// Réglage du logo : glisser pour centrer, curseur pour la taille, remplir ou logo entier, couleur de fond.
import { useRef, type CSSProperties, type PointerEvent } from 'react';
import { BrandLogo } from './brand';
import { DEFAULT_LOGO_STYLE, cleanLogoStyle, type LogoStyle } from './customization-model';

const BGS: [string, string | null][] = [['Aucun', null], ['Blanc', '#FFFFFF'], ['Noir', '#0A0A0A']];

export function LogoTuner({ url, name, value, onChange }: { url: string; name: string; value: Partial<LogoStyle> | null; onChange: (s: LogoStyle) => void }) {
  const s = cleanLogoStyle(value);
  const drag = useRef<{ x: number; y: number; sx: number; sy: number } | null>(null);
  const set = (p: Partial<LogoStyle>) => onChange(cleanLogoStyle({ ...s, ...p }));

  // Glisser l'image déplace le point de centrage (l’image suit le doigt).
  const down = (e: PointerEvent<HTMLDivElement>) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, sx: s.x, sy: s.y }; };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current; if (!d) return;
    const k = 100 / 120;
    set({ x: Math.round(d.sx + (e.clientX - d.x) * k), y: Math.round(d.sy + (e.clientY - d.y) * k) });
  };
  const up = () => { drag.current = null; };

  return <div className="blade-logo-tuner">
    <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} title="Glisse pour centrer ton logo" style={{ touchAction: 'none' } as CSSProperties}>
      <BrandLogo url={url} name={name} logoStyle={s} />
    </div>
    <div className="blade-logo-tuner-ctrls">
      <strong>Ajuster le logo</strong>
      <label>Taille ({Math.round(s.zoom * 100)} %)<input type="range" min={0.5} max={3} step={0.05} value={s.zoom} onChange={e => set({ zoom: +e.target.value })} /></label>
      <label>Gauche ↔ droite<input type="range" min={0} max={100} value={s.x} onChange={e => set({ x: +e.target.value })} /></label>
      <label>Haut ↕ bas<input type="range" min={0} max={100} value={s.y} onChange={e => set({ y: +e.target.value })} /></label>
      <div className="blade-logo-tuner-row" role="group" aria-label="Affichage">
        <button type="button" aria-pressed={s.fit === 'cover'} onClick={() => set({ fit: 'cover' })}>Remplir le rond</button>
        <button type="button" aria-pressed={s.fit === 'contain'} onClick={() => set({ fit: 'contain' })}>Logo entier</button>
      </div>
      <div className="blade-logo-tuner-row" role="group" aria-label="Fond du logo">
        <span>Fond :</span>
        {BGS.map(([l, c]) => <button type="button" key={l} aria-pressed={(s.bg ?? null) === c} onClick={() => set({ bg: c })}>{l}</button>)}
        <input type="color" aria-label="Autre couleur de fond" value={s.bg ?? '#FFFFFF'} onChange={e => set({ bg: e.target.value.toUpperCase() })} />
      </div>
      <div className="blade-logo-tuner-row"><button type="button" onClick={() => onChange({ ...DEFAULT_LOGO_STYLE })}>Recentrer et réinitialiser</button></div>
      <small className="blade-note">Astuce : glisse le logo dans le rond pour le centrer.</small>
    </div>
  </div>;
}
