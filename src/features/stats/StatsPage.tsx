import { ShareCollection } from '../share/ShareCollection'
import { CostsSection } from '../costs/CostsSection'
import { PaintTimeSection } from '../paintTime/PaintTime'
import { useEffect, useMemo, useState } from 'react'
import { useShownUnits, useStore } from '../../app/store'
import { pointsFor } from '../../domain/catalogue/points'
import { factionsOf } from '../../domain/collection/backlog'
import { ownedModels } from '../../domain/collection/ownedUnit'
import type { OwnedUnit, StatusEvent } from '../../domain/collection/types'
import { stageColour } from '../backlog/BacklogTable'
import { gameStats, resultsOver, streaks } from '../../domain/games/games'
import { activityByDay, byRole, paintUsage, pileAge, pointsOverTime, records, spending, stageFlow, stageTimes } from '../../domain/stats/more'
import { ActivityCalendar, HBars, MonthArea, MonthBars, monthLabel } from './charts'
import { byMonth, byWeek, lastWeeks, monthsSince, byFaction, finishMonths, lastMonths, netThisYear, pace, paintedPerMonth, pileFlow, pileLevel, pileNow, streakWeeks } from '../../domain/stats/stats'
import { tr, useTx } from '../../i18n'
import { formatMoney } from '../../i18n/format'

/** "about 14 months", "about 2 years", or a dash when there is no pace yet. */
export function forecast(months: number | undefined): string {
  if (months === undefined) return '—'
  if (months === 0) return tr('home.forecast.done')
  return months < 24 ? tr('home.forecast.months', { count: months }) : tr('home.forecast.years', { count: Math.round(months / 12) })
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
  const units = useShownUnits()
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
  const tx = useTx()
  const [sharing, setSharing] = useState(false)
  const units = useShownUnits()
  const { pipeline, shopItems, schemes, paints, paintStock, loadPaints, games: allGames, lists } = useStore()
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
  const bucketName = (k: string | undefined) => (k ? (k.length === 10 ? tx('week of {{date}}', { date: k.slice(5) }) : monthLabel(k) + ' ' + k.slice(0, 4)) : '—')
  const euro = (v: number) => formatMoney(v, '€')

  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl text-accent" data-tour="stats-title">{tx('Stats')}</h1>
        <div className="flex gap-2">
          <button className="btn" onClick={() => setSharing(true)}>{tx('🔗 Share')}</button>
          {sharing && <ShareCollection onClose={() => setSharing(false)} />}
          <select className="input" aria-label={tx('Faction')} value={faction} onChange={(e) => setFaction(e.target.value)}>
            <option value="">{tx('All factions')}</option>
            {factionsOf(units).map((f) => <option key={f}>{f}</option>)}
          </select>
          <div className="flex overflow-hidden rounded border border-line" role="group" aria-label={tx('Range')}>
            {([1, 3, 6, 12, 24, 'all'] as const).map((r) => (
              <button key={r} aria-pressed={range === r} className={`px-2.5 py-1 text-sm ${range === r ? 'bg-accent text-accent-fg' : 'hover:bg-panel-2'}`} onClick={() => setRange(r)}>
                {r === 'all' ? tx('All') : r < 12 ? tx('{{n}}M', { n: r }) : tx('{{n}}Y', { n: r / 12 })}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="panel grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 lg:grid-cols-6" aria-label={tx('Summary')}>
        <Tile label={tx('Painted this month')} value={thisMonth} />
        <Tile label={tx('Streak')} value={tx('{{n}} wk', { n: streak })} hint={tx('Weeks in a row with models painted')} />
        <Tile label={tx('Pile')} value={pile} hint={pileLevel(pile)} />
        <Tile label={tx('Net pile this year')} value={net > 0 ? `−${net}` : net < 0 ? `+${-net}` : '0'} hint={tx('Painted minus added')} tone={net > 0 ? 'good' : net < 0 ? 'bad' : undefined} />
        <Tile label={tx('Pace')} value={tx('{{n}}/mo', { n: Math.round(perMonth * 10) / 10 })} hint={tx('Last 3 months')} />
        <Tile label={tx('Finish')} value={forecast(finishMonths(pile, perMonth))} hint={tx('At this pace')} />
      </section>

      <CostsSection />

      <PaintTimeSection months={months} keyOf={keyOf} faction={faction || undefined} />

      <section className="panel grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 lg:grid-cols-5" aria-label={tx('Records')}>
        <Tile label={tx('Best month')} value={best.bestMonth?.count ?? 0} hint={bucketName(best.bestMonth?.key)} />
        <Tile label={tx('Best week')} value={best.bestWeek?.count ?? 0} hint={bucketName(best.bestWeek?.key)} />
        <Tile label={tx('Best day')} value={best.bestDay?.count ?? 0} hint={best.bestDay?.key ?? '—'} />
        <Tile label={tx('Longest streak')} value={tx('{{n}} wk', { n: best.longestStreak })} />
        <Tile label={tx('Built → Painted')} value={times.toPaint.days === undefined ? '—' : tx('{{n}} d', { n: times.toPaint.days })} hint={times.toPaint.units === 1 ? tx('Average over 1 unit') : tx('Average over {{n}} units', { n: times.toPaint.units })} />
      </section>

      <section className="panel grid gap-2 p-4" aria-label={tx('Activity')}>
        <h2 className="font-display text-lg">{tx('Activity')}</h2>
        <ActivityCalendar counts={activityByDay(events)} now={now} />
      </section>

      <section className="panel grid gap-2 p-4" aria-label={tx('Painted per month')}>
        <h2 className="font-display text-lg">{weekly ? tx('Models painted per week') : tx('Models painted per month')}</h2>
        <MonthBars label={tx('Models painted per month')} months={months} series={[{ name: tx('Painted'), values: paintedPerMonth(events, pipeline, months, 'painted', keyOf), fill: 'fill-accent', swatch: 'bg-accent' }]} />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="panel grid gap-2 p-4" aria-label={tx('Pile in and out')}>
          <h2 className="font-display text-lg">{tx('Pile in vs out')}</h2>
          <MonthBars
            label={tx('Models added and finished per month')}
            months={months}
            series={[
              { name: tx('Added'), values: flow.map((r) => r.added), fill: 'fill-muted/60', swatch: 'bg-muted/60' },
              { name: tx('Finished'), values: flow.map((r) => r.finished), fill: 'fill-accent', swatch: 'bg-accent' },
            ]}
          />
        </section>

        <section className="panel grid gap-2 p-4" aria-label={tx('Pile size')}>
          <h2 className="font-display text-lg">{tx('Pile size')}</h2>
          <MonthArea label={tx('Unpainted models over time')} name={tx('Pile')} months={months} values={flow.map((r) => r.pile)} />
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="panel grid gap-2 p-4" aria-label={tx('Where the work goes')}>
          <h2 className="font-display text-lg">{tx('Where the work goes')}</h2>
          <p className="text-xs text-muted">{tx('Models moved into each stage')}</p>
          <MonthBars stacked label={tx('Models moved into each stage')} months={months} series={flowByStage.filter((x) => x.values.some((v) => v)).map((x) => ({ name: x.stage.name, values: x.values, color: stageColour(pipeline, x.stage.id) }))} />
        </section>

        <section className="panel grid content-start gap-3 p-4" aria-label={tx('Time per stage')}>
          <h2 className="font-display text-lg">{tx('Time per stage')}</h2>
          {times.stages.length ? (
            <HBars label={tx('Average days in each stage')} format={(v) => tx('{{n}} d', { n: v })} rows={times.stages.map((x) => ({ key: x.stage.id, name: x.stage.name, value: x.days!, hint: x.units === 1 ? tx('Average over 1 unit') : tx('Average over {{n}} units', { n: x.units }) }))} />
          ) : <p className="text-sm text-muted">{tx('Move models through a few stages to see how long each takes.')}</p>}
        </section>

        <section className="panel grid gap-2 p-4" aria-label={tx('Points painted')}>
          <h2 className="font-display text-lg">{tx('Points painted')}</h2>
          <MonthArea label={tx('Painted points over time')} name={tx('Points')} months={months} values={pointsLine} />
        </section>

        <section className="panel grid content-start gap-3 p-4" aria-label={tx('Pile age')}>
          <h2 className="font-display text-lg">{tx('Pile age')}</h2>
          <HBars label={tx('Unpainted models by age')} rows={age.buckets.map((b) => ({ key: b.label, name: b.label, value: b.models }))} />
          {age.oldest.length > 0 && (
            <div className="grid gap-1 text-sm">
              <div className="text-xs uppercase tracking-wider text-muted">{tx('Oldest in the pile')}</div>
              {age.oldest.map((o) => (
                <div key={o.unit.id} className="flex justify-between gap-2"><span className="truncate">{o.unit.customName}</span><span className="shrink-0 text-muted">{tx('{{n}} models', { n: o.models })} · {o.months < 1 ? tx('this month') : o.months < 24 ? tx('{{n}} mo', { n: o.months }) : tx('{{n}} yr', { n: Math.floor(o.months / 12) })}</span></div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="panel grid gap-2 p-4" aria-label={tx('By faction')}>
        <h2 className="font-display text-lg">{tx('By faction')}</h2>
        {armies.length === 0 ? <p className="text-sm text-muted">{tx('No models yet')}</p> : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted">
              <tr><th className="py-1">{tx('Faction')}</th><th>{tx('Points painted')}</th><th>{tx('Models painted')}</th><th>{tx('Finish')}</th></tr>
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
                        {a.points ? tx('{{done}} / {{total}} pts', { done: a.pointsPainted, total: a.points }) : '—'}
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
        <section className="panel grid content-start gap-3 p-4" aria-label={tx('By role')}>
          <h2 className="font-display text-lg">{tx('By role')}</h2>
          {roles.length ? <HBars label={tx('Models painted by role')} rows={roles.map((r) => ({ key: r.role, name: r.role, value: r.painted, of: r.models }))} /> : <p className="text-sm text-muted">{tx('No models yet')}</p>}
        </section>

        <section className="panel grid content-start gap-3 p-4" aria-label={tx('Spending')}>
          <header className="flex items-baseline justify-between"><h2 className="font-display text-lg">{tx('Spending')}</h2><span className="text-sm text-muted">{tx('{{amount}} in this range', { amount: euro(spent.total) })}</span></header>
          <MonthBars label={tx('Money spent')} months={months} format={euro} series={[{ name: tx('Spent'), values: spent.values, fill: 'fill-accent', swatch: 'bg-accent' }]} />
          <p className="text-xs text-muted">{tx('Priced items ticked as bought on the shopping list.')}</p>
        </section>

        <section className="panel grid content-start gap-3 p-4" aria-label={tx('Paint usage')}>
          <h2 className="font-display text-lg">{tx('Paint usage')}</h2>
          <p className="text-sm text-muted">{tx("{{used}} of your {{owned}} paints are in your units' schemes", { used: usage.ownedUsed, owned: usage.owned })}</p>
          {usage.top.length ? (
            <HBars label={tx('Paints used by most units')} rows={usage.top.map((x) => {
              const paint = paintById.get(x.paintId)
              return { key: x.paintId, value: x.units, name: <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 shrink-0 rounded-full border border-line" style={{ background: paint?.hex }} />{paint?.name ?? x.paintId}</span> }
            })} format={(v) => (v === 1 ? tx('1 unit') : tx('{{n}} units', { n: v }))} />
          ) : <p className="text-sm text-muted">{tx('Give your units a paint scheme to see which paints they use most.')}</p>}
        </section>
      </div>
      {games.length > 0 && (
        <section className="panel grid gap-4 p-4" aria-label={tx('Game stats')}>
          <h2 className="font-display text-lg">{tx('Games')}</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Tile label={tx('Played')} value={gStats.overall.played} />
            <Tile label={tx('Win rate')} value={`${Math.round((gStats.overall.wins / gStats.overall.played) * 100)}%`} hint={`${gStats.overall.wins}-${gStats.overall.losses}-${gStats.overall.draws}`} />
            <Tile label={tx('Avg score')} value={`${gStats.overall.avgFor}–${gStats.overall.avgAgainst}`} />
            <Tile label={tx('Win streak')} value={gStreak.current} hint={tx('Best: {{n}}', { n: gStreak.best })} />
            <Tile label={tx('Best list')} value={[...gStats.byList].sort((a, b) => b.wins / b.played - a.wins / a.played)[0]?.key ?? '—'} />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="grid gap-1">
              <h3 className="text-sm text-muted">{tx('Results')}</h3>
              <MonthBars stacked label={tx('Game results')} months={months} series={[
                { name: tx('Wins'), values: gOver.wins, fill: 'fill-ok', swatch: 'bg-ok' },
                { name: tx('Draws'), values: gOver.draws, fill: 'fill-muted/60', swatch: 'bg-muted/60' },
                { name: tx('Losses'), values: gOver.losses, fill: 'fill-danger', swatch: 'bg-danger' },
              ]} />
            </div>
            <div className="grid gap-1">
              <h3 className="text-sm text-muted">{tx('Average score')}</h3>
              <MonthBars label={tx('Average score')} months={months} series={[
                { name: tx('Me'), values: gOver.avgFor, fill: 'fill-accent', swatch: 'bg-accent' },
                { name: tx('Opponent'), values: gOver.avgAgainst, fill: 'fill-muted/60', swatch: 'bg-muted/60' },
              ]} />
            </div>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="grid gap-1">
              <h3 className="text-sm text-muted">{tx('Wins by opponent faction')}</h3>
              <HBars label={tx('Wins by opponent faction')} rows={gStats.byOpponent.map((r) => ({ key: r.key, name: r.key, value: r.wins, of: r.played }))} />
            </div>
            <div className="grid gap-1">
              <h3 className="text-sm text-muted">{tx('Wins by list')}</h3>
              <HBars label={tx('Wins by list')} rows={gStats.byList.map((r) => ({ key: r.key, name: r.key, value: r.wins, of: r.played }))} />
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
