import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../../app/store'
import { pointsFor } from '../../domain/catalogue/points'
import { factionsOf } from '../../domain/collection/backlog'
import { ownedModels } from '../../domain/collection/ownedUnit'
import type { OwnedUnit, StatusEvent } from '../../domain/collection/types'
import { byFaction, finishMonths, lastMonths, netThisYear, pace, paintedPerMonth, pileFlow, pileLevel, pileNow, streakWeeks } from '../../domain/stats/stats'

const MONTH = new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' })
const monthLabel = (m: string) => MONTH.format(new Date(`${m}-01T00:00:00Z`))

/** "about 14 months", "about 2 years", or a dash when there is no pace yet. */
export function forecast(months: number | undefined): string {
  if (months === undefined) return '—'
  if (months === 0) return 'Done'
  return months < 24 ? `about ${months} month${months === 1 ? '' : 's'}` : `about ${Math.round(months / 12)} years`
}

export function Tile({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="rounded border border-line p-2" title={hint}>
      <div className="text-xs uppercase tracking-wider text-muted">{label}</div>
      <div className={`font-display text-xl ${tone === 'good' ? 'text-green-500' : tone === 'bad' ? 'text-red-400' : 'text-accent'}`}>{value}</div>
      {hint && <div className="text-xs text-muted">{hint}</div>}
    </div>
  )
}

/** Plain SVG bars, one per month; an optional line drawn on top. */
export function MonthBars({ months, series, line, label }: { months: string[]; series: { name: string; values: number[]; className: string }[]; line?: { name: string; values: number[] }; label: string }) {
  const W = 40 * months.length
  const H = 140
  const max = Math.max(1, ...series.flatMap((s) => s.values), ...(line?.values ?? []))
  const bw = 30 / series.length
  const y = (v: number) => H - (Math.max(0, v) / max) * (H - 10)
  return (
    <figure className="grid gap-1">
      <svg role="img" aria-label={label} viewBox={`0 0 ${W} ${H + 16}`} className="h-44 w-full" preserveAspectRatio="none">
        {months.map((m, i) => (
          <g key={m}>
            {series.map((s, j) => (
              <rect key={s.name} x={i * 40 + 5 + j * bw} y={y(s.values[i])} width={bw - 1} height={H - y(s.values[i])} className={s.className}>
                <title>{`${monthLabel(m)} ${m.slice(0, 4)} · ${s.name}: ${s.values[i]}`}</title>
              </rect>
            ))}
            <text x={i * 40 + 20} y={H + 12} textAnchor="middle" className="fill-current text-[9px] text-muted">{monthLabel(m)}</text>
          </g>
        ))}
        {line && (
          <polyline fill="none" strokeWidth={2} className="stroke-current text-accent" points={line.values.map((v, i) => `${i * 40 + 20},${y(v)}`).join(' ')}>
            <title>{line.name}</title>
          </polyline>
        )}
      </svg>
      <figcaption className="flex flex-wrap gap-3 text-xs text-muted">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1"><svg width="10" height="10"><rect width="10" height="10" className={s.className} /></svg>{s.name}</span>
        ))}
        {line && <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-3 bg-accent" />{line.name}</span>}
      </figcaption>
    </figure>
  )
}

/** All moves of every unit, loaded once per visit. */
export function useAllEvents() {
  const allEvents = useStore((s) => s.allEvents)
  const units = useStore((s) => s.units)
  const [events, setEvents] = useState<StatusEvent[]>([])
  useEffect(() => {
    void allEvents().then(setEvents)
  }, [allEvents, units])
  return events
}

export function usePointsOf() {
  const catalogue = useStore((s) => s.catalogue)
  return useMemo(() => {
    const sheets = new Map(catalogue?.datasheets.map((d) => [d.id, d]) ?? [])
    const names = new Map(catalogue?.factions.map((f) => [f.id, f.name]) ?? [])
    const pointsOf = (u: OwnedUnit) => {
      const d = u.datasheetId ? sheets.get(u.datasheetId) : undefined
      try {
        return d ? pointsFor(d, ownedModels(u)) : undefined
      } catch {
        return undefined
      }
    }
    return { pointsOf, factionName: (id: string) => names.get(id) ?? id }
  }, [catalogue])
}

export function StatsPage() {
  const { units, pipeline } = useStore()
  const all = useAllEvents()
  const { pointsOf, factionName } = usePointsOf()
  const [faction, setFaction] = useState('')
  const [range, setRange] = useState(12)
  const now = new Date().toISOString()

  const shown = useMemo(() => (faction ? units.filter((u) => u.factionName === faction) : units), [units, faction])
  const events = useMemo(() => {
    const ids = new Set(shown.map((u) => u.id))
    return all.filter((e) => ids.has(e.unitId))
  }, [all, shown])
  const months = lastMonths(now, range)
  const pile = pileNow(shown, pipeline)
  const perMonth = pace(events, pipeline, now)
  const thisMonth = paintedPerMonth(events, pipeline, months.slice(-1))[0]
  const net = netThisYear(shown, events, pipeline, now)
  const streak = streakWeeks(events, pipeline, now)
  const flow = pileFlow(shown, events, pipeline, months)
  const armies = byFaction(shown, events, pipeline, now, pointsOf, factionName)

  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl text-accent">Stats</h1>
        <div className="flex gap-2">
          <select className="input" aria-label="Faction" value={faction} onChange={(e) => setFaction(e.target.value)}>
            <option value="">All factions</option>
            {factionsOf(units).map((f) => <option key={f}>{f}</option>)}
          </select>
          <select className="input" aria-label="Range" value={range} onChange={(e) => setRange(Number(e.target.value))}>
            {[6, 12, 24].map((n) => <option key={n} value={n}>Last {n} months</option>)}
          </select>
        </div>
      </header>

      <section className="panel grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 lg:grid-cols-6" aria-label="Summary">
        <Tile label="Painted this month" value={thisMonth} />
        <Tile label="Streak" value={`${streak} wk`} hint="Weeks in a row with models painted" />
        <Tile label="Pile" value={pile} hint={pileLevel(pile)} />
        <Tile label="Net pile this year" value={net > 0 ? `−${net}` : net < 0 ? `+${-net}` : '0'} hint="Painted minus added" tone={net > 0 ? 'good' : net < 0 ? 'bad' : undefined} />
        <Tile label="Pace" value={`${Math.round(perMonth * 10) / 10}/mo`} hint="Last 3 months" />
        <Tile label="Finish" value={forecast(finishMonths(pile, perMonth))} hint="At this pace" />
      </section>

      <section className="panel grid gap-2 p-4" aria-label="Painted per month">
        <h2 className="font-display text-lg">Painted per month</h2>
        <MonthBars label="Models painted per month" months={months} series={[{ name: 'Painted', values: paintedPerMonth(events, pipeline, months), className: 'fill-accent' }]} />
      </section>

      <section className="panel grid gap-2 p-4" aria-label="Pile in and out">
        <h2 className="font-display text-lg">Pile in vs out</h2>
        <MonthBars
          label="Models added and finished per month"
          months={months}
          series={[
            { name: 'Added', values: flow.map((r) => r.added), className: 'fill-red-400' },
            { name: 'Finished', values: flow.map((r) => r.finished), className: 'fill-green-500' },
          ]}
          line={{ name: 'Pile', values: flow.map((r) => r.pile) }}
        />
      </section>

      <section className="panel grid gap-2 p-4" aria-label="By faction">
        <h2 className="font-display text-lg">By faction</h2>
        {armies.length === 0 ? <p className="text-sm text-muted">No models yet</p> : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted">
              <tr><th className="py-1">Faction</th><th>Points painted</th><th>Models painted</th><th>Finish</th></tr>
            </thead>
            <tbody>
              {armies.map((a) => {
                const pct = a.points ? a.pointsPainted / a.points : a.painted / a.models
                return (
                  <tr key={a.faction} className="border-t border-line">
                    <td className="py-1.5">{a.faction}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-32 overflow-hidden rounded bg-panel-2"><div className="h-full bg-accent" style={{ width: `${pct * 100}%` }} /></div>
                        {a.points ? `${a.pointsPainted} / ${a.points} pts` : '—'}
                      </div>
                    </td>
                    <td>{a.painted} / {a.models} ({Math.round((a.painted / a.models) * 100)}%)</td>
                    <td>{forecast(a.finishMonths)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
