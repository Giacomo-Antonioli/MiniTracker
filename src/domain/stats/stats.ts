import { isGone, WISHLISTED } from '../collection/pipeline'
import type { OwnedUnit, Pipeline, StageId, StatusEvent } from '../collection/types'

/** 'YYYY-MM' of an ISO date. */
const monthOf = (date: string) => date.slice(0, 7)
const DAY = 86_400_000

/** The last `n` months up to the month of `now`, oldest first. */
export function lastMonths(now: string, n: number): string[] {
  const y = Number(now.slice(0, 4))
  const m = Number(now.slice(5, 7)) - 1
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - (n - 1 - i), 1))
    return d.toISOString().slice(0, 7)
  })
}

/** Index of the painted stage, or the last stage when the pipeline has none. */
function targetIndex(p: Pipeline, target: StageId) {
  const i = p.stages.findIndex((s) => s.id === target)
  return i < 0 ? p.stages.length - 1 : i
}

/** +count when a move reaches painted, -count when it goes back below it, else 0. */
function finishedBy(e: StatusEvent, p: Pipeline, t: number) {
  const idx = (id: StageId) => p.stages.findIndex((s) => s.id === id)
  const from = idx(e.from) >= t
  const to = idx(e.to) >= t
  return from === to ? 0 : to ? e.count : -e.count
}

function finishedIn(events: StatusEvent[], p: Pipeline, keep: (date: string) => boolean, target: StageId) {
  const t = targetIndex(p, target)
  return events.reduce((sum, e) => (keep(e.date) ? sum + finishedBy(e, p, t) : sum), 0)
}

export function paintedPerMonth(events: StatusEvent[], p: Pipeline, months: string[], target: StageId = 'painted'): number[] {
  return months.map((m) => finishedIn(events, p, (d) => monthOf(d) === m, target))
}

/** Owned models of a unit (not wishlisted), and how many of them are painted. */
function counts(u: OwnedUnit, p: Pipeline, t: number) {
  let owned = 0
  let painted = 0
  for (const g of u.groups) {
    if (g.status === WISHLISTED) continue
    owned += g.count
    if (p.stages.findIndex((s) => s.id === g.status) >= t) painted += g.count
  }
  return { owned, painted }
}

/** Owned, unpainted models still in the collection. */
export function pileNow(units: OwnedUnit[], p: Pipeline, target: StageId = 'painted'): number {
  const t = targetIndex(p, target)
  return units.filter((u) => !isGone(u.lifecycle)).reduce((s, u) => {
    const c = counts(u, p, t)
    return s + c.owned - c.painted
  }, 0)
}

export function pileLevel(pile: number): string {
  if (pile === 0) return 'Clear'
  if (pile < 20) return 'Molehill'
  if (pile < 100) return 'Hill'
  if (pile < 300) return 'Mountain'
  return 'Everest'
}

function addedIn(units: OwnedUnit[], p: Pipeline, keep: (date: string) => boolean) {
  const t = targetIndex(p, 'painted')
  return units.filter((u) => !isGone(u.lifecycle) && keep(u.createdAt)).reduce((s, u) => s + counts(u, p, t).owned, 0)
}

export interface FlowRow {
  month: string
  added: number
  finished: number
  pile: number
}

/** Models added (by unit creation) and finished per month, with the pile at each month's end, worked back from today's pile. */
export function pileFlow(units: OwnedUnit[], events: StatusEvent[], p: Pipeline, months: string[], target: StageId = 'painted'): FlowRow[] {
  const rows = months.map((month) => ({ month, added: addedIn(units, p, (d) => monthOf(d) === month), finished: finishedIn(events, p, (d) => monthOf(d) === month, target), pile: 0 }))
  let pile = pileNow(units, p, target)
  for (let i = rows.length - 1; i >= 0; i--) {
    rows[i].pile = pile
    pile -= rows[i].added - rows[i].finished
  }
  return rows
}

/** Average models painted per month over the last `months` months (this one included). */
export function pace(events: StatusEvent[], p: Pipeline, now: string, months = 3, target: StageId = 'painted'): number {
  const keep = new Set(lastMonths(now, months))
  return finishedIn(events, p, (d) => keep.has(monthOf(d)), target) / months
}

/** Months to paint the pile at this pace; undefined when there is a pile but no pace. */
export function finishMonths(pile: number, perMonth: number): number | undefined {
  if (pile <= 0) return 0
  if (perMonth <= 0) return undefined
  return Math.ceil(pile / perMonth)
}

/** Monday (UTC) of the week holding `date`, in ms. */
function weekStart(date: string) {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`)
  return d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY
}

/** Weeks in a row with models painted, counted back from this week (or last week, if none yet this week). */
export function streakWeeks(events: StatusEvent[], p: Pipeline, now: string, target: StageId = 'painted'): number {
  const t = targetIndex(p, target)
  const weeks = new Set(events.filter((e) => finishedBy(e, p, t) > 0).map((e) => weekStart(e.date)))
  let w = weekStart(now)
  if (!weeks.has(w)) w -= 7 * DAY
  let n = 0
  while (weeks.has(w)) {
    n++
    w -= 7 * DAY
  }
  return n
}

/** Models painted this year minus owned models added this year: positive means the pile shrank. */
export function netThisYear(units: OwnedUnit[], events: StatusEvent[], p: Pipeline, now: string, target: StageId = 'painted'): number {
  const year = now.slice(0, 4)
  const inYear = (d: string) => d.startsWith(year)
  return finishedIn(events, p, inYear, target) - addedIn(units, p, inYear)
}

export interface FactionRow {
  faction: string
  models: number
  painted: number
  points: number
  pointsPainted: number
  finishMonths: number | undefined
}

/**
 * Painting progress per faction. `pointsOf` gives a unit's points (undefined when unknown);
 * painted points are its share of painted models.
 */
export function byFaction(
  units: OwnedUnit[],
  events: StatusEvent[],
  p: Pipeline,
  now: string,
  pointsOf: (u: OwnedUnit) => number | undefined,
  factionName: (id: string) => string,
  target: StageId = 'painted',
): FactionRow[] {
  const t = targetIndex(p, target)
  const NONE = 'No faction'
  const rows = new Map<string, FactionRow & { ids: Set<string> }>()
  for (const u of units) {
    if (isGone(u.lifecycle)) continue
    const c = counts(u, p, t)
    if (c.owned === 0) continue
    const name = u.factionName || (u.factionId ? factionName(u.factionId) : NONE)
    const r = rows.get(name) ?? { faction: name, models: 0, painted: 0, points: 0, pointsPainted: 0, finishMonths: undefined, ids: new Set() }
    const pts = pointsOf(u) ?? 0
    r.models += c.owned
    r.painted += c.painted
    r.points += pts
    r.pointsPainted += Math.round((pts * c.painted) / c.owned)
    r.ids.add(u.id)
    rows.set(name, r)
  }
  return [...rows.values()]
    .map(({ ids, ...r }) => ({ ...r, finishMonths: finishMonths(r.models - r.painted, pace(events.filter((e) => ids.has(e.unitId)), p, now, 3, target)) }))
    .sort((a, b) => Number(a.faction === NONE) - Number(b.faction === NONE) || b.models - a.models)
}
