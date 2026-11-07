import type { Game, RoundScore, SideKey } from './games'

/**
 * Live game sync: two devices playing the same game keep it in step, field by field. Every field is a small
 * independent value ("cp:me", "score:me:2", "phase"); the newest change to a field wins (last writer wins),
 * so two people tapping different things never overwrite each other. Values are totals, never deltas, so a
 * change that arrives twice (or after a reconnect) does no harm.
 */
export interface LiveChange {
  field: string
  value: unknown
  /** When it was made, in the receiving device's clock (the session shifts it by the clock offset). */
  t: number
  /** The device that made it; breaks ties between equal times. */
  d: string
}

/** The newest change seen for each field. */
export type Stamps = Record<string, { t: number; d: string }>

type Values = Record<string, unknown>

const SIDES: SideKey[] = ['me', 'them']
const other = (k: SideKey): SideKey => (k === 'me' ? 'them' : 'me')

/** Every live field of a game with its current value. */
export function fieldValues(g: Game): Values {
  const v: Values = { round: g.round, turn: g.turn, phase: g.phase ?? 0, status: { status: g.status, notes: g.notes }, clock: g.clock ?? { me: 0, them: 0 } }
  for (const k of SIDES) {
    v[`cp:${k}`] = g[k].cp
    g[k].rounds.forEach((r, i) => (v[`score:${k}:${i}`] = { primary: r.primary, secondary: r.secondary }))
    for (const id of g[k].destroyed) v[`destroyed:${k}:${id}`] = true
  }
  for (const [id, w] of Object.entries(g.wounds ?? {})) v[`wounds:${id}`] = w
  return v
}

/** The fields whose value differs between two versions of a game (a field that vanished becomes false/null). */
export function diffGames(prev: Game, next: Game): { field: string; value: unknown }[] {
  const a = fieldValues(prev)
  const b = fieldValues(next)
  const out: { field: string; value: unknown }[] = []
  for (const f of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (JSON.stringify(a[f]) === JSON.stringify(b[f])) continue
    out.push({ field: f, value: f in b ? b[f] : f.startsWith('destroyed:') ? false : null })
  }
  return out
}

/** One field set to a value. Unknown fields are ignored. */
export function applyField(g: Game, field: string, value: unknown): Game {
  const [kind, a, b] = field.split(':')
  switch (kind) {
    case 'round':
      return { ...g, round: value as number }
    case 'turn':
      return { ...g, turn: value as SideKey }
    case 'phase':
      return { ...g, phase: value as number }
    case 'status': {
      const s = value as { status: Game['status']; notes: string }
      return { ...g, status: s.status, notes: s.notes }
    }
    case 'clock':
      return { ...g, clock: value as Game['clock'] }
    case 'cp':
      return { ...g, [a]: { ...g[a as SideKey], cp: value as number } }
    case 'score': {
      const k = a as SideKey
      const rounds = g[k].rounds.map((r, i) => (i === Number(b) ? (value as RoundScore) : r))
      return { ...g, [k]: { ...g[k], rounds } }
    }
    case 'destroyed': {
      const k = a as SideKey
      const rest = g[k].destroyed.filter((x) => x !== b)
      return { ...g, [k]: { ...g[k], destroyed: value ? [...rest, b] : rest } }
    }
    case 'wounds': {
      const { [a]: _gone, ...rest } = g.wounds ?? {}
      return { ...g, wounds: value ? { ...rest, [a]: value as number[] } : rest }
    }
    default:
      return g
  }
}

/** True when change (t, d) is newer than the stamp already held for the field. */
export const isNewer = (c: { t: number; d: string }, held?: { t: number; d: string }) => !held || c.t > held.t || (c.t === held.t && c.d > held.d)

/** Apply the changes that win over what each field already holds; returns the new game, stamps and applied count. */
export function mergeChanges(g: Game, stamps: Stamps, changes: LiveChange[]): { game: Game; stamps: Stamps; applied: number } {
  let game = g
  const next = { ...stamps }
  let applied = 0
  let latest = 0
  for (const c of changes) {
    if (!isNewer(c, next[c.field])) continue
    game = applyField(game, c.field, c.value)
    next[c.field] = { t: c.t, d: c.d }
    applied++
    latest = Math.max(latest, c.t)
  }
  return { game: applied ? { ...game, updatedAt: new Date(latest).toISOString() } : g, stamps: next, applied }
}

/** Stamp the fields that differ between two versions of a game as made now by this device. */
export function localChanges(prev: Game, next: Game, t: number, d: string): LiveChange[] {
  return diffGames(prev, next).map((c) => ({ ...c, t, d }))
}

/** Every stamped field with its current value, to resend after a reconnect (the other side keeps what is newer). */
export function allChanges(g: Game, stamps: Stamps): LiveChange[] {
  const v = fieldValues(g)
  return Object.entries(stamps).map(([field, s]) => ({ field, value: field in v ? v[field] : field.startsWith('destroyed:') ? false : null, t: s.t, d: s.d }))
}

/** A change seen from the other player's seat (for two players, option B): "me" and "them" swap. */
export function mirror(c: LiveChange): LiveChange {
  const swap = (s: string) => (s === 'me' ? 'them' : s === 'them' ? 'me' : s)
  const [kind, a, ...rest] = c.field.split(':')
  const field = kind === 'cp' || kind === 'score' || kind === 'destroyed' ? [kind, swap(a), ...rest].join(':') : c.field
  const v = c.value as { me?: number; them?: number; since?: string }
  const value = kind === 'turn' ? swap(c.value as string) : kind === 'clock' ? { ...v, me: v.them, them: v.me } : c.value
  return { ...c, field, value }
}

/** A clock change moved to the receiving device's time: the running-since time shifts by the clock offset (ms). */
export function shiftClock(c: LiveChange, offsetMs: number): LiveChange {
  if (c.field !== 'clock') return c
  const v = c.value as { since?: string }
  return v.since ? { ...c, value: { ...v, since: new Date(Date.parse(v.since) + offsetMs).toISOString() } } : c
}

export { other as otherSide }
