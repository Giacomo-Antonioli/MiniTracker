import { ShareCollection } from '../share/ShareCollection'
import { CostsSection } from '../costs/CostsSection'
import { PaintTimeSection } from '../paintTime/PaintTime'
import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../../app/store'
import { pointsFor } from '../../domain/catalogue/points'
import { factionsOf } from '../../domain/collection/backlog'
import { ownedModels } from '../../domain/collection/ownedUnit'
import type { OwnedUnit, StatusEvent } from '../../domain/collection/types'
import { stageColour } from '../backlog/BacklogTable'
import { gameStats, resultsOver, streaks } from '../../domain/games/games'
import { activityByDay, byRole, paintUsage, pileAge, pointsOverTime, records, spending, stageFlow, stageTimes } from '../../domain/stats/more'
import { ActivityCalendar, HBars, MonthArea, MonthBars, monthLabel } from './charts'
import { byMonth, byWeek, lastWeeks, monthsSince, byFaction, finishMonths, lastMonths, netThisYear, pace, paintedPerMonth, pileFlow, pileLevel, pileNow, streakWeeks } from '../../domain/stats/stats'

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
    const roleOf = (u: OwnedUnit) => (u.datasheetId ? sheets.get(u.datasheetId)?.role : undefined)
    return { pointsOf, roleOf, factionName: (id: string) => names.get(id) ?? id }
  }, [catalogue])
}

export function StatsPage() {
  const [sharing, setSharing] = useState(false)
  const { units, pipeline, shopItems, schemes, paints, paintStock, loadPaints, games: allGames, lists } = useStore()
  useEffect(() => {
    void loadPaints()
  }, [loadPaints])
  const all = useAllEvents()
  const { pointsOf, roleOf, factionName } = usePointsOf()
  const [faction, setFaction] = useState('')
  const [range, setRange] = useState<number | 'all'>(12)
  const now = new Date().toISOString()

  const shown = useMemo(() => (faction ? units.filter((u) => u.factionName === faction) : units), [units, faction])
  const events = useMemo(() => {
    const ids = new Set(shown.map((u) => u.id))
    return all.filter((e) => ids.has(e.unitId))
  }, [all, shown])
  // Short ranges are drawn by week, longer ones by month.
  const weekly = range !== 'all' && range <= 3
  const keyOf = weekly ? byWeek : byMonth
  const first = [...shown.map((u) => u.createdAt), ...events.map((e) => e.date)].sort()[0]
  const months = range === 'all' ? monthsSince(first, now) : weekly ? lastWeeks(now, range === 1 ? 5 : 13) : lastMonths(now, range)
  const pile = pileNow(shown, pipeline)
  const perMonth = pace(events, pipeline, now)
  const thisMonth = paintedPerMonth(events, pipeline, lastMonths(now, 1))[0]
  const net = netThisYear(shown, events, pipeline, now)
  const streak = streakWeeks(events, pipeline, now)
  const flow = pileFlow(shown, events, pipeline, months, 'painted', keyOf)
  const armies = byFaction(shown, events, pipeline, now, pointsOf, factionName)
  const games = allGames.filter((g) => g.status === 'done' && (!faction || g.me.faction === faction) && months.some((m) => keyOf(g.date) === m))
  const gStats = gameStats(games, (id) => lists.find((l) => l.id === id)?.name)
  const gOver = resultsOver(games, months, keyOf)
  const gStreak = streaks(allGames.filter((g) => !faction || g.me.faction === faction))
  const best = records(events, pipeline)
  const times = stageTimes(shown, events, pipeline)
  const age = pileAge(shown, pipeline, now)
  const flowByStage = stageFlow(events, pipeline, months, keyOf)
  const roles = byRole(shown, pipeline, roleOf)
  const pointsLine = pointsOverTime(shown, events, pipeline, months, keyOf, pointsOf)
  const spent = spending(shopItems, months, keyOf)
  const usage = paintUsage(schemes.filter((x) => shown.some((u) => u.schemeId === x.id)), shown, paintStock)
  const paintById = new Map(paints.map((x) => [x.id, x]))
  const bucketName = (k: string | undefined) => (k ? (k.length === 10 ? `week of ${k.slice(5)}` : monthLabel(k) + ' ' + k.slice(0, 4)) : '—')
  const euro = (v: number) => `€${v.toFixed(v % 1 ? 2 : 0)}`

  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl text-accent">Stats</h1>
        <div className="flex gap-2">
          <button className="btn" onClick={() => setSharing(true)}>🔗 Share</button>
          {sharing && <ShareCollection onClose={() => setSharing(false)} />}
          <select className="input" aria-label="Faction" value={faction} onChange={(e) => setFaction(e.target.value)}>
            <option value="">All factions</option>
            {factionsOf(units).map((f) => <option key={f}>{f}</option>)}
          </select>
          <div className="flex overflow-hidden rounded border border-line" role="group" aria-label="Range">
            {([1, 3, 6, 12, 24, 'all'] as const).map((r) => (
              <button key={r} aria-pressed={range === r} className={`px-2.5 py-1 text-sm ${range === r ? 'bg-accent text-accent-fg' : 'hover:bg-panel-2'}`} onClick={() => setRange(r)}>
                {r === 'all' ? 'All' : r < 12 ? `${r}M` : `${r / 12}Y`}
              </button>
            ))}
          </div>
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

      <CostsSection />

      <PaintTimeSection months={months} keyOf={keyOf} faction={faction || undefined} />

      <section className="panel grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 lg:grid-cols-5" aria-label="Records">
        <Tile label="Best month" value={best.bestMonth?.count ?? 0} hint={bucketName(best.bestMonth?.key)} />
        <Tile label="Best week" value={best.bestWeek?.count ?? 0} hint={bucketName(best.bestWeek?.key)} />
        <Tile label="Best day" value={best.bestDay?.count ?? 0} hint={best.bestDay?.key ?? '—'} />
        <Tile label="Longest streak" value={`${best.longestStreak} wk`} />
        <Tile label="Built → Painted" value={times.toPaint.days === undefined ? '—' : `${times.toPaint.days} d`} hint={`Average over ${times.toPaint.units} unit${times.toPaint.units === 1 ? '' : 's'}`} />
      </section>

      <section className="panel grid gap-2 p-4" aria-label="Activity">
        <h2 className="font-display text-lg">Activity</h2>
        <ActivityCalendar counts={activityByDay(events)} now={now} />
      </section>

      <section className="panel grid gap-2 p-4" aria-label="Painted per month">
        <h2 className="font-display text-lg">Models painted per {weekly ? 'week' : 'month'}</h2>
        <MonthBars label="Models painted per month" months={months} series={[{ name: 'Painted', values: paintedPerMonth(events, pipeline, months, 'painted', keyOf), fill: 'fill-accent', swatch: 'bg-accent' }]} />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="panel grid gap-2 p-4" aria-label="Pile in and out">
          <h2 className="font-display text-lg">Pile in vs out</h2>
          <MonthBars
            label="Models added and finished per month"
            months={months}
            series={[
              { name: 'Added', values: flow.map((r) => r.added), fill: 'fill-muted/60', swatch: 'bg-muted/60' },
              { name: 'Finished', values: flow.map((r) => r.finished), fill: 'fill-accent', swatch: 'bg-accent' },
            ]}
          />
        </section>

        <section className="panel grid gap-2 p-4" aria-label="Pile size">
          <h2 className="font-display text-lg">Pile size</h2>
          <MonthArea label="Unpainted models over time" name="Pile" months={months} values={flow.map((r) => r.pile)} />
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="panel grid gap-2 p-4" aria-label="Where the work goes">
          <h2 className="font-display text-lg">Where the work goes</h2>
          <p className="text-xs text-muted">Models moved into each stage</p>
          <MonthBars stacked label="Models moved into each stage" months={months} series={flowByStage.filter((x) => x.values.some((v) => v)).map((x) => ({ name: x.stage.name, values: x.values, color: stageColour(pipeline, x.stage.id) }))} />
        </section>

        <section className="panel grid content-start gap-3 p-4" aria-label="Time per stage">
          <h2 className="font-display text-lg">Time per stage</h2>
          {times.stages.length ? (
            <HBars label="Average days in each stage" format={(v) => `${v} d`} rows={times.stages.map((x) => ({ key: x.stage.id, name: x.stage.name, value: x.days!, hint: `Average over ${x.units} unit${x.units === 1 ? '' : 's'}` }))} />
          ) : <p className="text-sm text-muted">Move models through a few stages to see how long each takes.</p>}
        </section>

        <section className="panel grid gap-2 p-4" aria-label="Points painted">
          <h2 className="font-display text-lg">Points painted</h2>
          <MonthArea label="Painted points over time" name="Points" months={months} values={pointsLine} />
        </section>

        <section className="panel grid content-start gap-3 p-4" aria-label="Pile age">
          <h2 className="font-display text-lg">Pile age</h2>
          <HBars label="Unpainted models by age" rows={age.buckets.map((b) => ({ key: b.label, name: b.label, value: b.models }))} />
          {age.oldest.length > 0 && (
            <div className="grid gap-1 text-sm">
              <div className="text-xs uppercase tracking-wider text-muted">Oldest in the pile</div>
              {age.oldest.map((o) => (
                <div key={o.unit.id} className="flex justify-between gap-2"><span className="truncate">{o.unit.customName}</span><span className="shrink-0 text-muted">{o.models} models · {o.months < 1 ? 'this month' : o.months < 24 ? `${o.months} mo` : `${Math.floor(o.months / 12)} yr`}</span></div>
              ))}
            </div>
          )}
        </section>
      </div>

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
                        <div className="h-2 w-32 overflow-hidden rounded-full bg-panel-2"><div className="h-full rounded-full bg-accent" style={{ width: `${pct * 100}%` }} /></div>
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
      <div className="grid gap-4 xl:grid-cols-3">
        <section className="panel grid content-start gap-3 p-4" aria-label="By role">
          <h2 className="font-display text-lg">By role</h2>
          {roles.length ? <HBars label="Models painted by role" rows={roles.map((r) => ({ key: r.role, name: r.role, value: r.painted, of: r.models }))} /> : <p className="text-sm text-muted">No models yet</p>}
        </section>

        <section className="panel grid content-start gap-3 p-4" aria-label="Spending">
          <header className="flex items-baseline justify-between"><h2 className="font-display text-lg">Spending</h2><span className="text-sm text-muted">{euro(spent.total)} in this range</span></header>
          <MonthBars label="Money spent" months={months} format={euro} series={[{ name: 'Spent', values: spent.values, fill: 'fill-accent', swatch: 'bg-accent' }]} />
          <p className="text-xs text-muted">Priced items ticked as bought on the shopping list.</p>
        </section>

        <section className="panel grid content-start gap-3 p-4" aria-label="Paint usage">
          <h2 className="font-display text-lg">Paint usage</h2>
          <p className="text-sm text-muted">{usage.ownedUsed} of your {usage.owned} paints are in your units' schemes</p>
          {usage.top.length ? (
            <HBars label="Paints used by most units" rows={usage.top.map((x) => {
              const paint = paintById.get(x.paintId)
              return { key: x.paintId, value: x.units, name: <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 shrink-0 rounded-full border border-line" style={{ background: paint?.hex }} />{paint?.name ?? x.paintId}</span> }
            })} format={(v) => `${v} unit${v === 1 ? '' : 's'}`} />
          ) : <p className="text-sm text-muted">Give your units a paint scheme to see which paints they use most.</p>}
        </section>
      </div>
      {games.length > 0 && (
        <section className="panel grid gap-4 p-4" aria-label="Game stats">
          <h2 className="font-display text-lg">Games</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Tile label="Played" value={gStats.overall.played} />
            <Tile label="Win rate" value={`${Math.round((gStats.overall.wins / gStats.overall.played) * 100)}%`} hint={`${gStats.overall.wins}-${gStats.overall.losses}-${gStats.overall.draws}`} />
            <Tile label="Avg score" value={`${gStats.overall.avgFor}–${gStats.overall.avgAgainst}`} />
            <Tile label="Win streak" value={gStreak.current} hint={`Best: ${gStreak.best}`} />
            <Tile label="Best list" value={[...gStats.byList].sort((a, b) => b.wins / b.played - a.wins / a.played)[0]?.key ?? '—'} />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="grid gap-1">
              <h3 className="text-sm text-muted">Results</h3>
              <MonthBars stacked label="Game results" months={months} series={[
                { name: 'Wins', values: gOver.wins, fill: 'fill-ok', swatch: 'bg-ok' },
                { name: 'Draws', values: gOver.draws, fill: 'fill-muted/60', swatch: 'bg-muted/60' },
                { name: 'Losses', values: gOver.losses, fill: 'fill-danger', swatch: 'bg-danger' },
              ]} />
            </div>
            <div className="grid gap-1">
              <h3 className="text-sm text-muted">Average score</h3>
              <MonthBars label="Average score" months={months} series={[
                { name: 'Me', values: gOver.avgFor, fill: 'fill-accent', swatch: 'bg-accent' },
                { name: 'Opponent', values: gOver.avgAgainst, fill: 'fill-muted/60', swatch: 'bg-muted/60' },
              ]} />
            </div>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="grid gap-1">
              <h3 className="text-sm text-muted">Wins by opponent faction</h3>
              <HBars label="Wins by opponent faction" rows={gStats.byOpponent.map((r) => ({ key: r.key, name: r.key, value: r.wins, of: r.played }))} />
            </div>
            <div className="grid gap-1">
              <h3 className="text-sm text-muted">Wins by list</h3>
              <HBars label="Wins by list" rows={gStats.byList.map((r) => ({ key: r.key, name: r.key, value: r.wins, of: r.played }))} />
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
