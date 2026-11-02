import { isGone, WISHLISTED } from '../collection/pipeline'
import type { OwnedUnit, Pipeline, Stage, StageId, StatusEvent } from '../collection/types'
import type { PaintStock } from '../paints/types'
import { paintIdsOf } from '../schemes/scheme'
import type { PaintScheme } from '../schemes/types'
import type { ShopItem } from '../shopping/types'
import { byMonth, byWeek, type KeyOf } from './stats'

const DAY = 86_400_000
const dayOf = (d: string) => d.slice(0, 10)
const days = (a: string, b: string) => Math.round((Date.parse(dayOf(b)) - Date.parse(dayOf(a))) / DAY)
const idxIn = (p: Pipeline) => (id: StageId) => p.stages.findIndex((s) => s.id === id)
function target(p: Pipeline, t: StageId) {
  const i = idxIn(p)(t)
  return i < 0 ? p.stages.length - 1 : i
}
/** Models a move takes past the painted stage (negative when moved back below it). */
function finished(e: StatusEvent, p: Pipeline, t: number) {
  const idx = idxIn(p)
  const from = idx(e.from) >= t
  const to = idx(e.to) >= t
  return from === to ? 0 : to ? e.count : -e.count
}
function owned(u: OwnedUnit, p: Pipeline, t: number) {
  const idx = idxIn(p)
  let models = 0
  let painted = 0
  for (const g of u.groups) {
    if (g.status === WISHLISTED) continue
    models += g.count
    if (idx(g.status) >= t) painted += g.count
  }
  return { models, painted }
}
const live = (units: OwnedUnit[]) => units.filter((u) => !isGone(u.lifecycle))

/** Models moved per day ('YYYY-MM-DD'), any stage. */
export function activityByDay(events: StatusEvent[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const e of events) out[dayOf(e.date)] = (out[dayOf(e.date)] ?? 0) + e.count
  return out
}

export interface Best {
  key: string
  count: number
}
export interface Records {
  bestMonth?: Best
  bestWeek?: Best
  bestDay?: Best
  /** Most weeks in a row with models painted. */
  longestStreak: number
}

export function records(events: StatusEvent[], p: Pipeline, painted: StageId = 'painted'): Records {
  const t = target(p, painted)
  const best = (keyOf: KeyOf): Best | undefined => {
    const sums = new Map<string, number>()
    for (const e of events) sums.set(keyOf(e.date), (sums.get(keyOf(e.date)) ?? 0) + finished(e, p, t))
    let top: Best | undefined
    for (const [key, count] of sums) if (count > 0 && (!top || count > top.count)) top = { key, count }
    return top
  }
  const weeks = [...new Set(events.filter((e) => finished(e, p, t) > 0).map((e) => Date.parse(byWeek(e.date))))].sort((a, b) => a - b)
  let longest = 0
  let run = 0
  weeks.forEach((w, i) => {
    run = i > 0 && w - weeks[i - 1] === 7 * DAY ? run + 1 : 1
    longest = Math.max(longest, run)
  })
  const r: Records = { longestStreak: longest }
  const m = best(byMonth)
  if (m) Object.assign(r, { bestMonth: m, bestWeek: best(byWeek), bestDay: best(dayOf) })
  return r
}

const AGE = [
  { label: '< 3 months', max: 3 },
  { label: '3–6 months', max: 6 },
  { label: '6–12 months', max: 12 },
  { label: '1–2 years', max: 24 },
  { label: '2+ years', max: Infinity },
]

/** Unpainted models by how long ago their unit was added, and the `n` oldest units still unpainted. */
export function pileAge(units: OwnedUnit[], p: Pipeline, now: string, n = 5, painted: StageId = 'painted') {
  const t = target(p, painted)
  const months = (d: string) => (Number(now.slice(0, 4)) - Number(d.slice(0, 4))) * 12 + Number(now.slice(5, 7)) - Number(d.slice(5, 7))
  const rows = live(units)
    .map((unit) => {
      const c = owned(unit, p, t)
      const m = months(unit.createdAt)
      // A missing or broken date counts as new rather than breaking the buckets.
      return { unit, months: Number.isFinite(m) ? Math.max(0, m) : 0, models: c.models - c.painted }
    })
    .filter((r) => r.models > 0)
  const buckets = AGE.map((b) => ({ label: b.label, models: 0 }))
  for (const r of rows) buckets[AGE.findIndex((b) => r.months < b.max)].models += r.models
  return { oldest: [...rows].sort((a, b) => a.unit.createdAt.localeCompare(b.unit.createdAt)).slice(0, n), buckets }
}

/** Models moved forward into each stage (Wishlisted excluded) per bucket. */
export function stageFlow(events: StatusEvent[], p: Pipeline, keys: string[], keyOf: KeyOf): { stage: Stage; values: number[] }[] {
  const at = new Map(keys.map((k, i) => [k, i]))
  return p.stages
    .filter((s) => s.id !== WISHLISTED)
    .map((stage) => {
      const values = keys.map(() => 0)
      for (const e of events) {
        const i = at.get(keyOf(e.date))
        if (i !== undefined && e.to === stage.id && e.direction === 'forward') values[i] += e.count
      }
      return { stage, values }
    })
}

/**
 * Average days in each stage (from first entering it to first entering a later one) and from Built
 * (or the unit's creation) to Painted, over units that have the moves to tell.
 */
export function stageTimes(units: OwnedUnit[], events: StatusEvent[], p: Pipeline, painted: StageId = 'painted') {
  const t = target(p, painted)
  const idx = idxIn(p)
  const first = new Map<string, Map<number, string>>()
  for (const e of events) {
    if (e.direction !== 'forward') continue
    const m = first.get(e.unitId) ?? new Map<number, string>()
    const i = idx(e.to)
    if (i >= 0 && (!m.has(i) || e.date < m.get(i)!)) m.set(i, e.date)
    first.set(e.unitId, m)
  }
  const per = p.stages.map(() => [] as number[])
  const toPaint: number[] = []
  for (const u of units) {
    const m = first.get(u.id)
    if (!m) continue
    const entered = [...m.entries()].sort((a, b) => a[0] - b[0])
    entered.forEach(([i, d], k) => {
      const next = entered[k + 1]
      if (i < t && next && next[1] >= d) per[i].push(days(d, next[1]))
    })
    const done = entered.filter(([i]) => i >= t).map(([, d]) => d).sort()[0]
    if (done) toPaint.push(days(m.get(idx('built')) ?? u.createdAt, done))
  }
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : undefined)
  return {
    toPaint: { days: avg(toPaint), units: toPaint.length },
    stages: p.stages.map((stage, i) => ({ stage, days: avg(per[i]), units: per[i].length })).filter((s) => s.units > 0),
  }
}

/** Painted points at the end of each bucket, worked back from today's. */
export function pointsOverTime(units: OwnedUnit[], events: StatusEvent[], p: Pipeline, keys: string[], keyOf: KeyOf, pointsOf: (u: OwnedUnit) => number | undefined, painted: StageId = 'painted'): number[] {
  const t = target(p, painted)
  const perModel = new Map<string, number>()
  let now = 0
  for (const u of live(units)) {
    const c = owned(u, p, t)
    const pts = pointsOf(u) ?? 0
    if (!c.models || !pts) continue
    perModel.set(u.id, pts / c.models)
    now += (pts * c.painted) / c.models
  }
  const gained = (keep: (k: string) => boolean) => events.reduce((s, e) => (keep(keyOf(e.date)) ? s + finished(e, p, t) * (perModel.get(e.unitId) ?? 0) : s), 0)
  const end = keys.at(-1) ?? ''
  let value = now - gained((k) => k > end)
  const out = keys.map(() => 0)
  for (let i = keys.length - 1; i >= 0; i--) {
    out[i] = Math.round(value)
    value -= gained((k) => k === keys[i])
  }
  return out
}

/** Models and painted models per battlefield role; units without one count as Other. */
export function byRole(units: OwnedUnit[], p: Pipeline, roleOf: (u: OwnedUnit) => string | undefined, painted: StageId = 'painted') {
  const t = target(p, painted)
  const rows = new Map<string, { role: string; models: number; painted: number }>()
  for (const u of live(units)) {
    const c = owned(u, p, t)
    if (!c.models) continue
    const role = roleOf(u) || 'Other'
    const r = rows.get(role) ?? { role, models: 0, painted: 0 }
    r.models += c.models
    r.painted += c.painted
    rows.set(role, r)
  }
  return [...rows.values()].sort((a, b) => b.models - a.models)
}

/** Money spent per bucket: priced items ticked as bought, dated by their last change. */
export function spending(items: ShopItem[], keys: string[], keyOf: KeyOf) {
  const values = keys.map(() => 0)
  const at = new Map(keys.map((k, i) => [k, i]))
  for (const x of items) {
    const i = at.get(keyOf(x.updatedAt))
    if (x.bought && x.price !== undefined && i !== undefined) values[i] += x.price
  }
  const round = (v: number) => Math.round(v * 100) / 100
  return { values: values.map(round), total: round(values.reduce((a, b) => a + b, 0)) }
}

/** Paints ranked by how many units' schemes use them; how many of your paints any scheme uses. */
export function paintUsage(schemes: PaintScheme[], units: OwnedUnit[], stocks: Map<string, PaintStock>, n = 10) {
  const byId = new Map(schemes.map((s) => [s.id, paintIdsOf(s)]))
  const count = new Map<string, number>()
  for (const u of live(units)) for (const id of (u.schemeId && byId.get(u.schemeId)) || []) count.set(id, (count.get(id) ?? 0) + 1)
  const used = new Set(schemes.flatMap((s) => byId.get(s.id)!))
  const mine = [...stocks.values()].filter((s) => s.quantity > 0)
  return {
    top: [...count].map(([paintId, units]) => ({ paintId, units })).sort((a, b) => b.units - a.units).slice(0, n),
    owned: mine.length,
    ownedUsed: mine.filter((s) => used.has(s.paintId)).length,
  }
}
