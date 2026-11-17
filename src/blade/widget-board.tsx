// Éditeur du profil en widgets : glisser-déposer, taille, titre, texte libre, ajout et retrait de blocs.
import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical, Maximize2, Minimize2, Plus, Trash2 } from 'lucide-react';
import { WIDGETS, WIDGET_TYPES, MAX_WIDGETS, addWidget, canAddWidget, moveWidget, type Widget, type WidgetType } from './customization-model';

export function WidgetBoard({ value, onChange }: { value: Widget[]; onChange: (w: Widget[]) => void }) {
  const drag = useRef<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const patch = (i: number, p: Partial<Widget>) => onChange(value.map((w, j) => j === i ? { ...w, ...p } : w));
  const drop = (to: number) => { const from = drag.current; drag.current = null; setOver(null); if (from !== null) onChange(moveWidget(value, from, to)); };

  return <div className="blade-wboard">
    <ul className="blade-wgrid" aria-label="Blocs de ton profil">
      {value.map((w, i) => { const meta = WIDGETS[w.type]; return <li key={w.id}
        className={`blade-wtile is-${w.size} ${over === i ? 'is-over' : ''}`}
        draggable onDragStart={e => { drag.current = i; e.dataTransfer.effectAllowed = 'move'; }}
        onDragOver={e => { e.preventDefault(); if (over !== i) setOver(i); }} onDragLeave={() => setOver(o => o === i ? null : o)}
        onDrop={e => { e.preventDefault(); drop(i); }} onDragEnd={() => { drag.current = null; setOver(null); }}>
        <div className="blade-wtile-head">
          <GripVertical size={18} className="blade-wtile-grip" aria-hidden="true" />
          <strong>{meta.label}</strong>
          <span className="blade-wtile-tools">
            <button type="button" aria-label={`Monter ${meta.label}`} disabled={i === 0} onClick={() => onChange(moveWidget(value, i, i - 1))}><ArrowUp size={16} /></button>
            <button type="button" aria-label={`Descendre ${meta.label}`} disabled={i === value.length - 1} onClick={() => onChange(moveWidget(value, i, i + 1))}><ArrowDown size={16} /></button>
            <button type="button" aria-label={w.size === 'full' ? 'Demi-largeur' : 'Pleine largeur'} title={w.size === 'full' ? 'Demi-largeur' : 'Pleine largeur'} onClick={() => patch(i, { size: w.size === 'full' ? 'half' : 'full' })}>{w.size === 'full' ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
            <button type="button" aria-label={`Retirer ${meta.label}`} onClick={() => onChange(value.filter((_, j) => j !== i))}><Trash2 size={16} /></button>
          </span>
        </div>
        <small>{meta.hint}</small>
        <label className="blade-wtile-field"><span>Titre affiché</span><input value={w.title ?? ''} maxLength={60} placeholder={w.type === 'booking' ? 'Réserve avec moi' : meta.label} onChange={e => patch(i, { title: e.target.value })} /></label>
        {w.type === 'text' && <label className="blade-wtile-field"><span>Texte</span><textarea rows={3} maxLength={1200} value={w.text ?? ''} placeholder="Ex. : -20 % le mardi, parking gratuit devant le salon…" onChange={e => patch(i, { text: e.target.value })} /></label>}
      </li>; })}
    </ul>
    {!value.length && <p className="blade-note">Ton profil est vide : ajoute au moins un bloc.</p>}
    <div className="blade-wadd">
      <strong>Ajouter un bloc {value.length >= MAX_WIDGETS && <small>(16 maximum)</small>}</strong>
      <div>{WIDGET_TYPES.map((t: WidgetType) => <button type="button" key={t} disabled={!canAddWidget(value, t)} onClick={() => onChange(addWidget(value, t))}><Plus size={14} aria-hidden="true" />{WIDGETS[t].label}</button>)}</div>
    </div>
  </div>;
}
