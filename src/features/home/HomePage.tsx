import { useEffect, useMemo, type ReactNode } from 'react'
import { useStore } from '../../app/store'
import { modelsByStatus } from '../../domain/collection/ownedUnit'
import { WISHLISTED } from '../../domain/collection/pipeline'
import { missingForSchemes } from '../../domain/paints/missing'
import { totals } from '../../domain/shopping/shopping'
import { byFaction, finishMonths, lastMonths, netThisYear, pace, paintedPerMonth, pileLevel, pileNow, recentMoves, recentUnits, streakWeeks } from '../../domain/stats/stats'
import { QuickMove } from '../backlog/QuickMove'
import { StageBar } from '../backlog/BacklogTable'
import { activityByDay, pileAge, records } from '../../domain/stats/more'
import { ActivityCalendar, MonthBars } from '../stats/charts'
import { forecast, Tile, useAllEvents, usePointsOf } from '../stats/StatsPage'

type Go = 'backlog' | 'stats' | 'shopping' | 'paints'

const AGO = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
/** "today", "yesterday", "3 days ago", "2 months ago". */
export function ago(date: string, now: string): string {
  const days = Math.round((Date.parse(now.slice(0, 10)) - Date.parse(date.slice(0, 10))) / 86_400_000)
  return days < 45 ? AGO.format(-days, 'day') : AGO.format(-Math.round(days / 30), 'month')
}

function Card({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="panel grid content-start gap-3 p-4" aria-label={title}>
      <header className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  )
}

const Link = ({ onClick, children }: { onClick?: () => void; children: ReactNode }) =>
  onClick ? <button className="text-sm text-muted hover:text-accent" onClick={onClick}>{children}</button> : null

export function HomePage({ onOpenUnit, onGo, onAddUnit }: { onOpenUnit?: (id: string) => void; onGo?: (p: Go) => void; onAddUnit?: () => void }) {
  const { units, pipeline, shopItems, schemes, paints, paintStock, loadPaints } = useStore()
  const events = useAllEvents()
  const { pointsOf, factionName } = usePointsOf()
  useEffect(() => {
    void loadPaints()
  }, [loadPaints])
  const now = new Date().toISOString()

  const pile = pileNow(units, pipeline)
  const perMonth = pace(events, pipeline, now)
  const net = netThisYear(units, events, pipeline, now)
  const months = lastMonths(now, 6)
  const painted = paintedPerMonth(events, pipeline, months)
  const continueUnits = recentUnits(units, events, pipeline, 3)
  const moves = recentMoves(events, 5)
  const closest = byFaction(units, events, pipeline, now, pointsOf, factionName)
    .filter((f) => f.painted < f.models)
    .map((f) => ({ ...f, pct: f.points ? f.pointsPainted / f.points : f.painted / f.models }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 3)
  const shop = totals(shopItems)
  const best = records(events, pipeline)
  const oldest = pileAge(units, pipeline, now, 3).oldest
  const usedSchemes = useMemo(() => schemes.filter((s) => units.some((u) => u.schemeId === s.id)), [schemes, units])
  const missing = paints.length ? missingForSchemes(usedSchemes, paints, paintStock).length : 0
  const names = new Map(units.map((u) => [u.id, u.customName]))
  const stageName = (id: string) => pipeline.stages.find((s) => s.id === id)?.name ?? id

  if (units.length === 0) {
    return (
      <div className="grid h-full place-items-center">
        <div className="panel grid max-w-md gap-3 p-6 text-center">
          <h1 className="font-display text-2xl text-accent">Welcome to MiniTracker</h1>
          <p className="text-muted">Add your first unit to start tracking your pile, painting progress and stats.</p>
          {onAddUnit && <button className="btn btn-primary justify-self-center" onClick={onAddUnit}>+ Add your first unit</button>}
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <h1 className="font-display text-2xl text-accent">Home</h1>

      <section className="grid grid-cols-2 gap-2 lg:grid-cols-4" aria-label="Summary">
        <Tile label="Painted this month" value={painted.at(-1)!} hint={`Streak: ${streakWeeks(events, pipeline, now)} wk`} />
        <Tile label="Pile" value={pile} hint={pileLevel(pile)} />
        <Tile label="Net pile this year" value={net > 0 ? `−${net}` : net < 0 ? `+${-net}` : '0'} hint="Painted minus added" tone={net > 0 ? 'good' : net < 0 ? 'bad' : undefined} />
        <Tile label="Finish" value={forecast(finishMonths(pile, perMonth))} hint="At your 3-month pace" />
      </section>

      {events.length > 0 && (
        <Card title="Activity" action={<Link onClick={onGo && (() => onGo('stats'))}>Stats →</Link>}>
          <ActivityCalendar counts={activityByDay(events)} now={now} />
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {continueUnits.length > 0 && (
          <Card title="Continue painting" action={<Link onClick={onGo && (() => onGo('backlog'))}>Backlog →</Link>}>
            <ul className="grid gap-3">
              {continueUnits.map((u) => {
                const by = modelsByStatus(u)
                const stages = pipeline.stages.filter((s) => by[s.id]).map((s) => ({ id: s.id, name: s.name, count: by[s.id] }))
                const at = (id: string) => pipeline.stages.findIndex((s) => s.id === id)
                const group = u.groups.filter((g) => g.status !== WISHLISTED).sort((a, b) => at(a.status) - at(b.status))[0]
                return (
                  <li key={u.id} className="grid gap-1.5 rounded border border-line p-2">
                    <div className="flex items-center justify-between gap-2">
                      <button className="truncate text-left font-semibold hover:text-accent" onClick={() => onOpenUnit?.(u.id)}>{u.customName}</button>
                      <span className="text-xs text-muted">{u.factionName}</span>
                    </div>
                    <StageBar stages={stages} pipeline={pipeline} />
                    {group && <div className="flex items-center gap-2 text-xs text-muted"><span>{group.count} {stageName(group.status)}</span><QuickMove unit={u} group={group} /></div>}
                  </li>
                )
              })}
            </ul>
          </Card>
        )}

        {painted.some((v) => v) && (
          <Card title="Last 6 months" action={<Link onClick={onGo && (() => onGo('stats'))}>Stats →</Link>}>
            <MonthBars label="Models painted in the last 6 months" months={months} series={[{ name: 'Painted', values: painted, fill: 'fill-accent', swatch: 'bg-accent' }]} />
          </Card>
        )}

        {closest.length > 0 && (
          <Card title="Closest to done" action={<Link onClick={onGo && (() => onGo('stats'))}>Stats →</Link>}>
            <ul className="grid gap-2.5">
              {closest.map((f) => (
                <li key={f.faction} className="grid gap-1">
                  <div className="flex justify-between text-sm"><span>{f.faction}</span><span className="text-muted">{Math.round(f.pct * 100)}% · {forecast(f.finishMonths)}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-panel-2"><div className="h-full rounded-full bg-accent" style={{ width: `${f.pct * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {best.bestMonth && (
          <Card title="Records">
            <div className="grid grid-cols-2 gap-2">
              <Tile label="Best month" value={best.bestMonth.count} hint={best.bestMonth.key} />
              <Tile label="Best week" value={best.bestWeek!.count} hint={`Week of ${best.bestWeek!.key}`} />
              <Tile label="Best day" value={best.bestDay!.count} hint={best.bestDay!.key} />
              <Tile label="Longest streak" value={`${best.longestStreak} wk`} />
            </div>
          </Card>
        )}

        {oldest.length > 0 && (
          <Card title="Oldest in the pile">
            <ul className="grid gap-1.5 text-sm">
              {oldest.map((o) => (
                <li key={o.unit.id} className="flex justify-between gap-2">
                  <button className="truncate text-left hover:text-accent" onClick={() => onOpenUnit?.(o.unit.id)}>{o.unit.customName}</button>
                  <span className="shrink-0 text-muted">{o.models} models · {o.months < 1 ? 'this month' : o.months < 24 ? `${o.months} mo` : `${Math.floor(o.months / 12)} yr`}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {moves.length > 0 && (
          <Card title="Recent activity">
            <ul className="grid gap-1.5 text-sm">
              {moves.map((e) => (
                <li key={e.id} className="flex justify-between gap-2">
                  <button className="truncate text-left hover:text-accent" onClick={() => onOpenUnit?.(e.unitId)}>
                    {e.count} × {names.get(e.unitId) ?? 'Deleted unit'} → {stageName(e.to)}
                  </button>
                  <span className="shrink-0 text-muted">{ago(e.date, now)}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {(shop.toBuy > 0 || missing > 0) && (
          <Card title="Shopping" action={<Link onClick={onGo && (() => onGo('shopping'))}>Shopping →</Link>}>
            <div className="grid grid-cols-3 gap-2">
              <Tile label="To buy" value={shop.toBuy} />
              <Tile label="Total" value={`€${shop.price.toFixed(2)}`} hint={shop.unpriced ? `${shop.unpriced} without price` : undefined} />
              <Tile label="Missing paints" value={missing} hint="For your units' schemes" />
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
