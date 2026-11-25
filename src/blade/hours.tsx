// Pro: weekly opening hours and dated exceptions ("Mes horaires").
// Reads go through RLS (own rows only); writes only through owner-checked RPCs.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { BladeButton, EmptyState, Section, Plus } from './common';
import { ProviderPage, Status } from './provider';
import { useAsync } from './customization-data';
import { fmtDate, isoDate, useSession } from './data';
import { DAY_NAMES, MODE_LABELS, WEEK_ORDER, daySummary, emptyWeek, rangeError, rulesFromWeek, weekError, weekFromRules, type HoursMode, type HoursRange, type Week } from './hours-model';

const db = supabase as SupabaseClient;
async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}
type Override = { id: string; date: string; is_available: boolean; start_time: string | null; end_time: string | null; mode: HoursMode };

export function ProHours() {
  const { isSuperadmin } = useSession();
  return <ProviderPage title="Mes horaires">{data => isSuperadmin
    ? <Section title="Horaires de LCS Barber"><p className="blade-note">Les horaires de LCS Barber restent gérés dans l’agenda historique (journées et disponibilités). Cet écran sert aux autres prestataires.</p><BladeButton asChild><Link to="/blade/pro/agenda">Ouvrir l’agenda</Link></BladeButton></Section>
    : <HoursBody providerId={data.provider_id}/>}</ProviderPage>;
}

const MODES: HoursMode[] = ['both', 'domicile', 'deplacement'];
const ModeSelect = ({ value, onChange, label }: { value: HoursMode; onChange: (m: HoursMode) => void; label: string }) =>
  <label className="blade-field"><span>{label}</span><select value={value} onChange={e => onChange(e.target.value as HoursMode)}>{MODES.map(m => <option key={m} value={m}>{MODE_LABELS[m]}</option>)}</select></label>;

function HoursBody({ providerId }: { providerId: string }) {
  const [tick, setTick] = useState(0);
  const hours = useAsync(async () => {
    const { data, error } = await db.from('blade_provider_hours').select('day_of_week,start_time,end_time,mode').eq('provider_id', providerId);
    if (error) throw new Error('Les horaires ne sont pas encore disponibles.');
    return weekFromRules(data ?? []);
  }, [providerId, tick]);
  const overrides = useAsync(async () => {
    const { data, error } = await db.from('blade_provider_date_overrides').select('id,date,is_available,start_time,end_time,mode').eq('provider_id', providerId).gte('date', isoDate(new Date())).order('date').order('start_time');
    if (error) throw new Error('Les exceptions ne sont pas encore disponibles.');
    return (data ?? []) as Override[];
  }, [providerId, tick]);

  if (hours.loading && !hours.data) return <p role="status">Chargement…</p>;
  if (hours.error) return <Status error={hours.error}/>;
  return <>
    <p className="blade-lead">Tes clients ne peuvent réserver que pendant ces plages, par tranches de 30 minutes. Les créneaux déjà réservés disparaissent d’eux-mêmes.</p>
    <WeekEditor initial={hours.data ?? emptyWeek()} onSaved={() => setTick(t => t + 1)}/>
    <OverridesEditor list={overrides.data ?? []} error={overrides.error} onChanged={() => setTick(t => t + 1)}/>
  </>;
}

function WeekEditor({ initial, onSaved }: { initial: Week; onSaved: () => void }) {
  const [week, setWeek] = useState<Week>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ error?: string; message?: string }>({});
  useEffect(() => setWeek(initial), [initial]);
  const setDay = (d: number, ranges: HoursRange[]) => { setWeek(w => ({ ...w, [d]: ranges })); setMsg({}); };
  const problem = weekError(week);
  const save = async () => {
    if (problem) { setMsg({ error: problem }); return; }
    setBusy(true);
    try { const n = await rpc<number>('blade_save_hours', { p_rules: rulesFromWeek(week) }); setMsg({ message: n ? `Horaires enregistrés (${n} plage${n > 1 ? 's' : ''}).` : 'Horaires enregistrés : aucune plage ouverte, personne ne peut réserver.' }); onSaved(); }
    catch (e) { setMsg({ error: (e as Error).message }); }
    finally { setBusy(false); }
  };
  return <Section title="Semaine type">
    <div className="blade-hours-week">{WEEK_ORDER.map(d => {
      const ranges = week[d] ?? [];
      return <fieldset key={d} className="blade-hours-day">
        <legend><strong>{DAY_NAMES[d]}</strong><small>{daySummary(ranges)}</small></legend>
        {ranges.map((r, i) => {
          const err = rangeError(r);
          const update = (patch: Partial<HoursRange>) => setDay(d, ranges.map((x, j) => j === i ? { ...x, ...patch } : x));
          return <div key={i} className="blade-hours-range">
            <label className="blade-field"><span>Début</span><input type="time" step={1800} value={r.start_time} onChange={e => update({ start_time: e.target.value })}/></label>
            <label className="blade-field"><span>Fin</span><input type="time" step={1800} value={r.end_time} onChange={e => update({ end_time: e.target.value })} aria-invalid={Boolean(err)}/></label>
            <ModeSelect label="Lieu" value={r.mode} onChange={mode => update({ mode })}/>
            <BladeButton onClick={() => setDay(d, ranges.filter((_, j) => j !== i))} aria-label={`Retirer la plage ${r.start_time}–${r.end_time} du ${DAY_NAMES[d].toLowerCase()}`}>Retirer</BladeButton>
            {err && <small className="blade-error">{err}</small>}
          </div>;
        })}
        <BladeButton onClick={() => { const last = ranges[ranges.length - 1]; setDay(d, [...ranges, last ? { start_time: last.end_time === '00:00' ? '09:00' : last.end_time, end_time: '19:00', mode: last.mode } : { start_time: '09:00', end_time: '19:00', mode: 'both' }]); }}><Plus size={16}/>{ranges.length ? 'Ajouter une plage' : 'Ouvrir ce jour'}</BladeButton>
      </fieldset>;
    })}</div>
    <div className="blade-inline">
      <BladeButton variant="default" disabled={busy} onClick={save}>{busy ? 'Enregistrement…' : 'Enregistrer la semaine'}</BladeButton>
      <BladeButton disabled={busy} onClick={() => { setWeek(initial); setMsg({}); }}>Annuler les changements</BladeButton>
    </div>
    <Status error={msg.error} message={msg.message}/>
  </Section>;
}

function OverridesEditor({ list, error, onChanged }: { list: Override[]; error: string | null; onChanged: () => void }) {
  const today = isoDate(new Date());
  const [date, setDate] = useState(today);
  const [closed, setClosed] = useState(true);
  const [range, setRange] = useState<HoursRange>({ start_time: '09:00', end_time: '19:00', mode: 'both' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ error?: string; message?: string }>({});
  const add = async () => {
    const err = closed ? '' : rangeError(range);
    if (!date) { setMsg({ error: 'Choisis une date' }); return; }
    if (err) { setMsg({ error: err }); return; }
    setBusy(true);
    try {
      await rpc('blade_add_date_override', { p_date: date, p_closed: closed, p_start: closed ? null : range.start_time, p_end: closed ? null : range.end_time, p_mode: range.mode });
      setMsg({ message: closed ? `Fermé le ${fmtDate(date)}.` : `Horaires spéciaux ajoutés le ${fmtDate(date)}.` }); onChanged();
    } catch (e) { setMsg({ error: (e as Error).message }); }
    finally { setBusy(false); }
  };
  const remove = async (o: Override) => {
    setBusy(true);
    try { await rpc('blade_delete_date_override', { p_id: o.id }); setMsg({ message: `Exception du ${fmtDate(o.date)} retirée.` }); onChanged(); }
    catch (e) { setMsg({ error: (e as Error).message }); }
    finally { setBusy(false); }
  };
  return <Section title="Congés et jours particuliers">
    <p className="blade-note">Une fermeture bloque toute la journée. Des horaires spéciaux remplacent ceux de la semaine type, seulement ce jour-là.</p>
    <div className="blade-hours-range">
      <label className="blade-field"><span>Date</span><input type="date" min={today} value={date} onChange={e => setDate(e.target.value)}/></label>
      <label className="blade-field"><span>Ce jour-là</span><select value={closed ? 'closed' : 'open'} onChange={e => setClosed(e.target.value === 'closed')}><option value="closed">Fermé toute la journée</option><option value="open">Horaires spéciaux</option></select></label>
      {!closed && <>
        <label className="blade-field"><span>Début</span><input type="time" step={1800} value={range.start_time} onChange={e => setRange(r => ({ ...r, start_time: e.target.value }))}/></label>
        <label className="blade-field"><span>Fin</span><input type="time" step={1800} value={range.end_time} onChange={e => setRange(r => ({ ...r, end_time: e.target.value }))}/></label>
        <ModeSelect label="Lieu" value={range.mode} onChange={mode => setRange(r => ({ ...r, mode }))}/>
      </>}
      <BladeButton variant="default" disabled={busy} onClick={add}>Ajouter</BladeButton>
    </div>
    <Status error={msg.error ?? error ?? undefined} message={msg.message}/>
    {list.length ? <ul className="blade-hours-overrides">{list.map(o => <li key={o.id}>
      <span><strong>{fmtDate(o.date)}</strong> {o.is_available ? `${String(o.start_time).slice(0, 5)}–${String(o.end_time).slice(0, 5)} · ${MODE_LABELS[o.mode] ?? ''}` : 'Fermé'}</span>
      <BladeButton disabled={busy} onClick={() => remove(o)} aria-label={`Retirer l’exception du ${fmtDate(o.date)}`}>Retirer</BladeButton>
    </li>)}</ul> : <EmptyState compact icon="calendar" title="Aucune exception à venir"/>}
  </Section>;
}
