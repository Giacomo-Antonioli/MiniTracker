import type { OwnedUnit, Pipeline, StatusEvent } from '../collection/types'
import { records } from '../stats/more'
import { addedIn, counts, finishedIn, streakWeeks, targetIndex } from '../stats/stats'

export type Period = 'week' | 'month' | 'year'

/** Hobby goals (#90). Recurring goals (models, pile) start again each period and keep their past results. */
export type Goal = { id: string; title: string; createdAt: string } & (
  | { kind: 'models'; count: number; period: Period }
  | { kind: 'units'; unitIds: string[]; due?: string }
  | { kind: 'pile'; period: Period }
  | { kind: 'streak'; weeks: number }
)

export interface Progress {
  current: number
  target: number
  done: boolean
  /** e.g. "7 / 10 models", "+3 net" */
  text: string
  /** Period label or due date note. */
  when?: string
  overdue?: boolean
}

const DAY = 86_400_000

/** Start (inclusive) and end (exclusive) ISO dates of the period that contains `date`. */
export function periodRange(period: Period, date: string): [string, string] {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`)
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth()
  const iso = (t: number) => new Date(t).toISOString().slice(0, 10)
  if (period === 'year') return [`${y}-01-01`, `${y + 1}-01-01`]
  if (period === 'month') return [iso(Date.UTC(y, m, 1)), iso(Date.UTC(y, m + 1, 1))]
  const start = d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY
  return [iso(start), iso(start + 7 * DAY)]
}

/** The period before the one starting at `start`. */
const previous = (period: Period, start: string) => periodRange(period, new Date(new Date(`${start}T00:00:00Z`).getTime() - DAY).toISOString())

export function periodLabel(period: Period, start: string): string {
  if (period === 'year') return start.slice(0, 4)
  if (period === 'month') return new Date(`${start}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' })
  return `week of ${start}`
}

const inRange = ([a, b]: [string, string]) => (d: string) => d.slice(0, 10) >= a && d.slice(0, 10) < b

function periodProgress(g: Goal & { kind: 'models' | 'pile' }, range: [string, string], units: OwnedUnit[], events: StatusEvent[], p: Pipeline): Progress {
  const keep = inRange(range)
  const painted = finishedIn(events, p, keep, 'painted')
  const when = periodLabel(g.period, range[0])
  if (g.kind === 'models') return { current: painted, target: g.count, done: painted >= g.count, text: `${painted} / ${g.count} models`, when }
  const net = painted - addedIn(units, p, keep)
  return { current: Math.max(0, net), target: 0, done: net >= 0, text: `${painted} painted, ${painted - net} added (${net >= 0 ? '+' : ''}${net} net)`, when }
}

export function goalProgress(g: Goal, units: OwnedUnit[], events: StatusEvent[], p: Pipeline, now: string): Progress {
  if (g.kind === 'models' || g.kind === 'pile') return periodProgress(g, periodRange(g.period, now), units, events, p)
  if (g.kind === 'streak') {
    const cur = streakWeeks(events, p, now)
    const best = records(events, p).longestStreak
    return { current: cur, target: g.weeks, done: cur >= g.weeks, text: `${cur} / ${g.weeks} weeks`, when: `best ${best} wk` }
  }
  const t = targetIndex(p, 'painted')
  let owned = 0
  let painted = 0
  for (const u of units.filter((x) => g.unitIds.includes(x.id))) {
    const c = counts(u, p, t)
    owned += c.owned
    painted += c.painted
  }
  const done = owned > 0 && painted >= owned
  return {
    current: painted,
    target: owned,
    done,
    text: `${painted} / ${owned} models`,
    when: g.due ? `by ${g.due}` : undefined,
    overdue: !!g.due && !done && now.slice(0, 10) > g.due,
  }
}

/** Results of a recurring goal for the `n` periods before the current one, newest first; only periods since the goal was made. */
export function goalHistory(g: Goal, units: OwnedUnit[], events: StatusEvent[], p: Pipeline, now: string, n = 6): Progress[] {
  if (g.kind !== 'models' && g.kind !== 'pile') return []
  const out: Progress[] = []
  let range = periodRange(g.period, now)
  for (let i = 0; i < n; i++) {
    range = previous(g.period, range[0])
    if (range[1] <= g.createdAt.slice(0, 10)) break
    out.push(periodProgress(g, range, units, events, p))
  }
  return out
}

export function validateGoal(g: Goal): void {
  if (g.kind === 'models' && !(g.count > 0)) throw new Error('Set how many models')
  if (g.kind === 'streak' && !(g.weeks > 0)) throw new Error('Set how many weeks')
  if (g.kind === 'units' && g.unitIds.length === 0) throw new Error('Pick at least one unit')
}

/** Default title shown when the user leaves it empty. */
export function goalTitle(g: Goal): string {
  if (g.title.trim()) return g.title.trim()
  if (g.kind === 'models') return `Paint ${g.count} models a ${g.period}`
  if (g.kind === 'pile') return `Shrink the pile every ${g.period}`
  if (g.kind === 'streak') return `Paint every week for ${g.weeks} weeks`
  return `Finish ${g.unitIds.length} unit${g.unitIds.length === 1 ? '' : 's'}${g.due ? ` by ${g.due}` : ''}`
}

export function parseGoals(raw: unknown): Goal[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is Goal => !!x && typeof x.id === 'string' && ['models', 'units', 'pile', 'streak'].includes(x.kind))
}
