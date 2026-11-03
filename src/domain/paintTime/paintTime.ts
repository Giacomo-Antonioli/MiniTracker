import type { Ctx, OwnedUnit, StageId } from '../collection/types'

/** A model group a timer covers; `count` is the number of minis, used to split the time. */
export interface TimerTarget {
  unitId: string
  groupId: string
  count: number
}

/**
 * A painting timer (#89). Running while `runningSince` is set; paused otherwise.
 * Paused timers are kept (also across days) until stopped, which turns them into sessions.
 */
export interface PaintTimer {
  id: string
  targets: TimerTarget[]
  stage?: StageId
  note: string
  /** Time already counted before the current run, in ms. */
  elapsedMs: number
  runningSince?: string
  createdAt: string
}

/** Logged painting time on one model group. */
export interface PaintSession {
  id: string
  unitId: string
  groupId: string
  minutes: number
  /** ISO date (YYYY-MM-DD). */
  date: string
  stage?: StageId
  note: string
}

const ms = (iso: string) => new Date(iso).getTime()

export function elapsedMs(t: PaintTimer, now: string): number {
  return t.elapsedMs + (t.runningSince ? Math.max(0, ms(now) - ms(t.runningSince)) : 0)
}

export function newTimer(targets: TimerTarget[], c: Ctx, stage?: StageId, note = ''): PaintTimer {
  if (!targets.length) throw new Error('Pick at least one model group')
  return { id: c.newId(), targets, stage, note, elapsedMs: 0, runningSince: c.now, createdAt: c.now }
}

export const pauseTimer = (t: PaintTimer, now: string): PaintTimer =>
  t.runningSince ? { ...t, elapsedMs: elapsedMs(t, now), runningSince: undefined } : t

export const resumeTimer = (t: PaintTimer, now: string): PaintTimer => (t.runningSince ? t : { ...t, runningSince: now })

/** Splits whole minutes by weight; the rounding leftovers go to the largest remainders so the sum stays `total`. */
export function splitMinutes(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + Math.max(0, b), 0)
  const w = sum > 0 ? weights.map((x) => Math.max(0, x)) : weights.map(() => 1)
  const all = sum > 0 ? sum : w.length
  const exact = w.map((x) => (total * x) / all)
  const out = exact.map(Math.floor)
  let left = total - out.reduce((a, b) => a + b, 0)
  const order = exact.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1])
  for (const [, i] of order) {
    if (left <= 0) break
    out[i]++
    left--
  }
  return out
}

/** Stops a timer: its time, rounded to minutes, is split over its groups by mini count. Empty groups are skipped. */
export function stopTimer(t: PaintTimer, c: Ctx): PaintSession[] {
  const total = Math.round(elapsedMs(t, c.now) / 60000)
  const parts = splitMinutes(total, t.targets.map((x) => x.count))
  return t.targets
    .map((x, i) => ({ id: c.newId(), unitId: x.unitId, groupId: x.groupId, minutes: parts[i], date: c.now.slice(0, 10), stage: t.stage, note: t.note }))
    .filter((s) => s.minutes > 0)
}

export function validateSession(s: PaintSession): void {
  if (!s.unitId || !s.groupId) throw new Error('Pick a model group')
  if (!Number.isFinite(s.minutes) || s.minutes <= 0) throw new Error('Minutes must be more than 0')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date)) throw new Error('Pick a date')
}

/** "1 h 05 min", "45 min". */
export function formatMinutes(m: number): string {
  const r = Math.round(m)
  if (r < 60) return `${r} min`
  return `${Math.floor(r / 60)} h ${String(r % 60).padStart(2, '0')} min`
}

/** "1:02:03" for a running clock. */
export function formatClock(msTotal: number): string {
  const s = Math.floor(msTotal / 1000)
  return `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

const sumBy = (sessions: PaintSession[], key: (s: PaintSession) => string | undefined) => {
  const m = new Map<string, number>()
  for (const s of sessions) {
    const k = key(s)
    if (k !== undefined) m.set(k, (m.get(k) ?? 0) + s.minutes)
  }
  return m
}

const sorted = (m: Map<string, number>) => [...m].map(([key, minutes]) => ({ key, minutes })).sort((a, b) => b.minutes - a.minutes || a.key.localeCompare(b.key))

export const totalMinutes = (sessions: PaintSession[]) => sessions.reduce((a, s) => a + s.minutes, 0)

export const minutesByUnit = (sessions: PaintSession[]) => sorted(sumBy(sessions, (s) => s.unitId))

export const minutesByStage = (sessions: PaintSession[]) => sorted(sumBy(sessions, (s) => s.stage ?? ''))

/** Per army (faction name); units without a faction count as "No faction". */
export function minutesByFaction(sessions: PaintSession[], units: OwnedUnit[]) {
  const f = new Map(units.map((u) => [u.id, u.factionName || 'No faction']))
  return sorted(sumBy(sessions, (s) => f.get(s.unitId) ?? 'No faction'))
}

/** Minutes per period key (month 'YYYY-MM' by default), in the order of `keys`. */
export function minutesPer(sessions: PaintSession[], keys: string[], keyOf: (date: string) => string = (d) => d.slice(0, 7)): number[] {
  const m = sumBy(sessions, (s) => keyOf(s.date))
  return keys.map((k) => m.get(k) ?? 0)
}

/** Minutes since Monday of the week containing `now`. */
export function minutesThisWeek(sessions: PaintSession[], now: string): number {
  const d = new Date(now.slice(0, 10) + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  const from = d.toISOString().slice(0, 10)
  return totalMinutes(sessions.filter((s) => s.date >= from && s.date <= now.slice(0, 10)))
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object'

export function parseSessions(x: unknown): PaintSession[] {
  if (!Array.isArray(x)) return []
  return x.filter((s): s is PaintSession => isObj(s) && typeof s.id === 'string' && typeof s.unitId === 'string' && typeof s.minutes === 'number' && typeof s.date === 'string').map((s) => ({ ...s, note: s.note ?? '' }))
}

export function parseTimers(x: unknown): PaintTimer[] {
  if (!Array.isArray(x)) return []
  return x.filter((t): t is PaintTimer => isObj(t) && typeof t.id === 'string' && Array.isArray(t.targets) && typeof t.elapsedMs === 'number').map((t) => ({ ...t, note: t.note ?? '' }))
}

/** Drops timer targets of units or groups that no longer exist; timers left with no targets go too. */
export function pruneTimers(timers: PaintTimer[], units: OwnedUnit[]): PaintTimer[] {
  const groups = new Set(units.flatMap((u) => u.groups.map((g) => `${u.id}/${g.id}`)))
  return timers.map((t) => ({ ...t, targets: t.targets.filter((x) => groups.has(`${x.unitId}/${x.groupId}`)) })).filter((t) => t.targets.length > 0)
}

/** Timers that cover any group of the unit. */
export const timersForUnit = (timers: PaintTimer[], unitId: string) => timers.filter((t) => t.targets.some((x) => x.unitId === unitId))

/** Pauses every running timer except `keepId`, to switch to other units; returns only the changed ones. */
export const pauseOthers = (timers: PaintTimer[], keepId: string | undefined, now: string): PaintTimer[] =>
  timers.filter((t) => t.id !== keepId && t.runningSince).map((t) => pauseTimer(t, now))
