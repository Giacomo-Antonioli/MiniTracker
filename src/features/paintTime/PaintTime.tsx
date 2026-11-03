import { useEffect, useMemo, useState } from 'react'
import { ctx, useStore } from '../../app/store'
import type { OwnedUnit } from '../../domain/collection/types'
import {
  elapsedMs, formatClock, formatMinutes, minutesByFaction, minutesByStage, minutesByUnit, minutesPer, minutesThisWeek, newTimer,
  pauseTimer, resumeTimer, totalMinutes, validateSession, type PaintSession, type PaintTimer, type TimerTarget,
} from '../../domain/paintTime/paintTime'
import { HBars, MonthBars } from '../stats/charts'

/** Re-renders every second while `on`, for running clocks. */
export function useTick(on: boolean): string {
  const [now, setNow] = useState(() => new Date().toISOString())
  useEffect(() => {
    if (!on) return
    const id = setInterval(() => setNow(new Date().toISOString()), 1000)
    return () => clearInterval(id)
  }, [on])
  return on ? now : new Date().toISOString()
}

export function useLabels() {
  const { units, pipeline } = useStore()
  return useMemo(() => {
    const stage = (id?: string) => (id ? pipeline.stages.find((s) => s.id === id)?.name ?? id : '')
    const unit = new Map(units.map((u) => [u.id, u]))
    const group = (unitId: string, groupId: string) => {
      const u = unit.get(unitId)
      const g = u?.groups.find((x) => x.id === groupId)
      if (!u) return 'Deleted unit'
      return u.groups.length > 1 && g ? `${u.customName} (${g.count}× ${stage(g.status)})` : u.customName
    }
    return { stage, group, unitName: (id: string) => unit.get(id)?.customName ?? 'Deleted unit' }
  }, [units, pipeline])
}

/** Model groups of active units, for pickers. */
function groupOptions(units: OwnedUnit[]) {
  return units
    .filter((u) => u.lifecycle === 'active')
    .flatMap((u) => u.groups.map((g) => ({ unit: u, group: g })))
    .sort((a, b) => a.unit.customName.localeCompare(b.unit.customName))
}

export function StageSelect({ value, onChange, label }: { value?: string; onChange: (v?: string) => void; label: string }) {
  const { pipeline } = useStore()
  return (
    <select className="input" aria-label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
      <option value="">No stage</option>
      {pipeline.stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
  )
}

/** Picks model groups (several for batch painting) and starts a timer. */
function StartTimer({ onDone }: { onDone: () => void }) {
  const { units, saveTimer } = useStore()
  const { stage } = useLabels()
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<TimerTarget[]>([])
  const [st, setSt] = useState<string>()
  const [note, setNote] = useState('')
  const opts = groupOptions(units).filter((o) => o.unit.customName.toLowerCase().includes(q.toLowerCase()))
  const on = (u: string, g: string) => picked.some((x) => x.unitId === u && x.groupId === g)
  const toggle = (u: string, g: string, count: number) =>
    setPicked(on(u, g) ? picked.filter((x) => !(x.unitId === u && x.groupId === g)) : [...picked, { unitId: u, groupId: g, count }])
  return (
    <form
      className="grid gap-2 rounded border border-line p-3"
      aria-label="Start timer"
      onSubmit={(e) => {
        e.preventDefault()
        void saveTimer(newTimer(picked, ctx(), st, note.trim())).then(onDone)
      }}
    >
      <input className="input" placeholder="Search units…" aria-label="Search units" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="grid max-h-48 gap-1 overflow-auto text-sm">
        {opts.map(({ unit: u, group: g }) => (
          <li key={g.id}>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={on(u.id, g.id)} onChange={() => toggle(u.id, g.id, g.count)} />
              {u.customName} <span className="text-muted">· {g.count}× {stage(g.status)}</span>
            </label>
          </li>
        ))}
        {!opts.length && <li className="text-muted">No units found</li>}
      </ul>
      {picked.length > 1 && <p className="text-xs text-muted">Batch: the time is split by the number of minis in each group.</p>}
      <div className="flex flex-wrap gap-2">
        <StageSelect label="Timer stage" value={st} onChange={setSt} />
        <input className="input flex-1" placeholder="Note" aria-label="Timer note" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <button className="btn btn-primary" disabled={!picked.length}>▶ Start</button>
        <button type="button" className="btn" onClick={onDone}>Cancel</button>
      </div>
    </form>
  )
}

export function TimerRow({ t, now, onPaused }: { t: PaintTimer; now: string; onPaused?: () => void }) {
  const { saveTimer, deleteTimer, stopTimer, openCompanion, companion } = useStore()
  const { group, stage } = useLabels()
  const running = !!t.runningSince
  const minis = t.targets.reduce((a, x) => a + x.count, 0)
  return (
    <li className="grid gap-1 rounded border border-line p-2" aria-label="Timer">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`font-mono text-xl ${running ? 'text-accent' : 'text-muted'}`}>{formatClock(elapsedMs(t, now))}{running ? '' : ' ⏸'}</span>
        <div className="flex gap-1">
          {running
            ? <button className="btn" onClick={() => void saveTimer(pauseTimer(t, new Date().toISOString())).then(onPaused)}>⏸ Pause</button>
            : <button className="btn" onClick={() => void saveTimer(resumeTimer(t, new Date().toISOString()))}>▶ Resume</button>}
          <button className="btn btn-primary" onClick={() => void stopTimer(t.id)}>■ Stop</button>
          {!companion && <button className="btn" title="Painter companion" aria-label="Open painter companion" onClick={() => openCompanion('paint', t.targets[0].unitId, t.id)}>🎨</button>}
          {!companion && <button className="btn" title="Builder companion" aria-label="Open builder companion" onClick={() => openCompanion('build', t.targets[0].unitId, t.id)}>🔨</button>}
          <button className="btn" aria-label="Discard timer" onClick={() => confirm('Discard this timer without logging its time?') && void deleteTimer(t.id)}>✕</button>
        </div>
      </div>
      <span className="text-sm">
        {t.targets.map((x) => group(x.unitId, x.groupId)).join(', ')}
        <span className="text-muted">{t.targets.length > 1 ? ` · ${minis} minis` : ''}{t.stage ? ` · ${stage(t.stage)}` : ''}{t.note ? ` · ${t.note}` : ''}</span>
      </span>
    </li>
  )
}

/** Running and paused timers plus this week's total; used by the Home card. */
export function TimerPanel() {
  const { paintTimers, paintSessions } = useStore()
  const [starting, setStarting] = useState(false)
  const now = useTick(paintTimers.some((t) => t.runningSince))
  return (
    <div className="grid gap-2">
      {paintTimers.length > 0 && <ul className="grid gap-2">{paintTimers.map((t) => <TimerRow key={t.id} t={t} now={now} />)}</ul>}
      {starting ? <StartTimer onDone={() => setStarting(false)} /> : <button className="btn justify-self-start" onClick={() => setStarting(true)}>▶ Start timer</button>}
      <p className="text-sm text-muted">This week: {formatMinutes(minutesThisWeek(paintSessions, now))}</p>
    </div>
  )
}

const today = () => new Date().toISOString().slice(0, 10)

function SessionForm({ start, onDone }: { start?: PaintSession; onDone: () => void }) {
  const { units, saveSession } = useStore()
  const { stage } = useLabels()
  const [s, setS] = useState<PaintSession>(start ?? { id: crypto.randomUUID(), unitId: '', groupId: '', minutes: 30, date: today(), note: '' })
  const [err, setErr] = useState('')
  const opts = groupOptions(units)
  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded border border-line p-3"
      aria-label={start ? 'Edit session' : 'Add session'}
      onSubmit={(e) => {
        e.preventDefault()
        try {
          validateSession(s)
          void saveSession(s).then(onDone)
        } catch (x) {
          setErr((x as Error).message)
        }
      }}
    >
      <select className="input" aria-label="Model group" value={s.groupId ? `${s.unitId}/${s.groupId}` : ''} onChange={(e) => { const [unitId, groupId] = e.target.value.split('/'); setS({ ...s, unitId: unitId ?? '', groupId: groupId ?? '' }) }}>
        <option value="">Model group…</option>
        {start && !opts.some((o) => o.group.id === start.groupId) && <option value={`${start.unitId}/${start.groupId}`}>(current)</option>}
        {opts.map(({ unit: u, group: g }) => <option key={g.id} value={`${u.id}/${g.id}`}>{u.customName} · {g.count}× {stage(g.status)}</option>)}
      </select>
      <input className="input w-24" type="number" min={1} aria-label="Minutes" value={s.minutes} onChange={(e) => setS({ ...s, minutes: Number(e.target.value) })} />
      <input className="input" type="date" aria-label="Date" value={s.date} onChange={(e) => setS({ ...s, date: e.target.value })} />
      <StageSelect label="Session stage" value={s.stage} onChange={(v) => setS({ ...s, stage: v })} />
      <input className="input flex-1" placeholder="Note" aria-label="Session note" value={s.note} onChange={(e) => setS({ ...s, note: e.target.value })} />
      <button className="btn btn-primary">Save</button>
      <button type="button" className="btn" onClick={onDone}>Cancel</button>
      {err && <p className="w-full text-sm text-danger" role="alert">{err}</p>}
    </form>
  )
}

/** Stats ▸ Painting time: totals, charts and the editable session log. */
export function PaintTimeSection({ months, keyOf = (d) => d.slice(0, 7), faction }: { months: string[]; keyOf?: (date: string) => string; faction?: string }) {
  const { paintSessions: allSessions, units, deleteSession } = useStore()
  const factionOf = new Map(units.map((u) => [u.id, u.factionName]))
  const paintSessions = faction ? allSessions.filter((s) => factionOf.get(s.unitId) === faction) : allSessions
  const { group, stage, unitName } = useLabels()
  const [editing, setEditing] = useState<PaintSession | 'new' | null>(null)
  const [all, setAll] = useState(false)
  const now = new Date().toISOString()
  const list = paintSessions.filter((s) => months.includes(keyOf(s.date)))
  const thisMonth = paintSessions.filter((s) => s.date.slice(0, 7) === now.slice(0, 7))
  const log = [...paintSessions].sort((a, b) => b.date.localeCompare(a.date))
  const shown = all ? log : log.slice(0, 10)
  const fmt = (v: number) => formatMinutes(v)
  return (
    <section className="panel grid gap-3 p-4" aria-label="Painting time">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg">Painting time</h2>
        <span className="text-sm text-muted">{formatMinutes(totalMinutes(list))} in this range · {formatMinutes(totalMinutes(thisMonth))} this month · {formatMinutes(minutesThisWeek(paintSessions, now))} this week</span>
      </header>
      {list.length > 0 && (
        <>
          <MonthBars label="Painting hours per month" months={months} format={(v) => `${v} h`} series={[{ name: 'Hours', values: minutesPer(list, months, keyOf).map((m) => Math.round(m / 6) / 10), fill: 'fill-accent', swatch: 'bg-accent' }]} />
          <div className="grid gap-4 xl:grid-cols-3">
            <div><h3 className="text-sm text-muted">By army</h3><HBars label="Painting time by army" format={fmt} rows={minutesByFaction(list, units).map((r) => ({ key: r.key, name: r.key, value: r.minutes }))} /></div>
            <div><h3 className="text-sm text-muted">By unit</h3><HBars label="Painting time by unit" format={fmt} rows={minutesByUnit(list).slice(0, 10).map((r) => ({ key: r.key, name: unitName(r.key), value: r.minutes }))} /></div>
            <div><h3 className="text-sm text-muted">By stage</h3><HBars label="Painting time by stage" format={fmt} rows={minutesByStage(list).map((r) => ({ key: r.key || '-', name: stage(r.key) || 'No stage', value: r.minutes }))} /></div>
          </div>
        </>
      )}
      <div className="flex items-center justify-between">
        <h3 className="text-sm text-muted">Sessions</h3>
        {editing === null && <button className="btn" onClick={() => setEditing('new')}>+ Add session</button>}
      </div>
      {editing !== null && <SessionForm key={editing === 'new' ? 'new' : editing.id} start={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />}
      {log.length === 0 ? <p className="text-sm text-muted">No painting time yet. Start a timer on Home or add a session.</p> : (
        <table className="w-full text-sm" aria-label="Painting sessions">
          <thead className="text-left text-xs uppercase tracking-wider text-muted">
            <tr><th className="py-1">Date</th><th>Model group</th><th>Time</th><th>Stage</th><th>Note</th><th /></tr>
          </thead>
          <tbody>
            {shown.map((s) => (
              <tr key={s.id} className="border-t border-line">
                <td className="py-1.5">{s.date}</td>
                <td>{group(s.unitId, s.groupId)}</td>
                <td>{formatMinutes(s.minutes)}</td>
                <td>{stage(s.stage)}</td>
                <td>{s.note}</td>
                <td className="text-right">
                  <button className="btn px-2 py-0.5" aria-label="Edit session" onClick={() => setEditing(s)}>✎</button>
                  <button className="btn px-2 py-0.5" aria-label="Delete session" onClick={() => confirm('Delete this session?') && void deleteSession(s.id)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {log.length > 10 && <button className="btn justify-self-start" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${log.length}`}</button>}
    </section>
  )
}
