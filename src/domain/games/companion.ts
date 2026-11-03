import type { Ctx } from '../collection/types'
import type { Stratagem } from '../stratagems/stratagems'
import { nextTurn, type Game } from './games'

/** Match companion (#72): phases, wounds per model, chess clock and what applies now. */
export const PHASES = ['Command', 'Movement', 'Shooting', 'Charge', 'Fight'] as const
export type Phase = (typeof PHASES)[number]

const ms = (iso: string) => Date.parse(iso)

/** Time used so far, counting the running clock up to `now`. */
export function clockTotals(g: Game, now: string) {
  const c = g.clock ?? { me: 0, them: 0 }
  const running = c.since ? Math.max(0, ms(now) - ms(c.since)) : 0
  const me = c.me + (g.turn === 'me' ? running : 0)
  const them = c.them + (g.turn === 'them' ? running : 0)
  return { me, them, total: me + them, running: !!c.since }
}

/** Fold the running time into the current player's total. */
function settle(g: Game, now: string): Game['clock'] {
  if (!g.clock?.since) return g.clock
  const t = clockTotals(g, now)
  return { me: t.me, them: t.them, since: now }
}

export const startClock = (g: Game, ctx: Pick<Ctx, 'now'>): Game => (g.clock?.since ? g : { ...g, clock: { me: g.clock?.me ?? 0, them: g.clock?.them ?? 0, since: ctx.now }, updatedAt: ctx.now })

export function pauseClock(g: Game, ctx: Pick<Ctx, 'now'>): Game {
  const c = settle(g, ctx.now)
  return c ? { ...g, clock: { me: c.me, them: c.them }, updatedAt: ctx.now } : g
}

/** Next phase; after Fight, the next player's turn (CP and rounds as in the game), clock switching over. */
export function nextPhase(g: Game, ctx: Pick<Ctx, 'now'>): Game {
  const p = g.phase ?? 0
  if (p < PHASES.length - 1) return { ...g, phase: p + 1, updatedAt: ctx.now }
  return advanceTurn(g, ctx)
}

/** Wounds left per model of a unit (full until first hit). */
export const woundsLeft = (g: Game, entryId: string, full: number[]) => g.wounds?.[entryId] ?? full

/**
 * One wound off (delta −1) or back (+1). Damage goes to an already wounded model first; healing goes to
 * the most hurt living model, else brings back a dead one. The unit is destroyed when no model is left.
 */
export function damage(g: Game, entryId: string, full: number[], delta: 1 | -1, ctx: Pick<Ctx, 'now'>): Game {
  const w = [...woundsLeft(g, entryId, full)]
  const alive = w.map((v, i) => ({ v, i })).filter((x) => x.v > 0)
  if (delta < 0) {
    if (!alive.length) return g
    const hurt = alive.filter((x) => x.v < full[x.i]).sort((a, b) => a.v - b.v)[0] ?? alive[0]
    w[hurt.i]--
  } else {
    const hurt = alive.filter((x) => x.v < full[x.i]).sort((a, b) => a.v - b.v)[0]
    const dead = w.findIndex((v) => v === 0)
    if (hurt) w[hurt.i]++
    else if (dead >= 0) w[dead] = 1
    else return g
  }
  const gone = w.every((v) => v === 0)
  const destroyed = g.me.destroyed.filter((x) => x !== entryId)
  return { ...g, wounds: { ...g.wounds, [entryId]: w }, me: { ...g.me, destroyed: gone ? [...destroyed, entryId] : destroyed }, updatedAt: ctx.now }
}

/** Stratagems usable now: right player's turn ("Your", "Opponent's" or "Either") and phase (or "Any phase"). */
export function stratagemsNow(all: Stratagem[], myTurn: boolean, phase: Phase): Stratagem[] {
  return all.filter((s) => {
    const t = s.turn.toLowerCase()
    const turnOk = t.includes('either') || (myTurn ? t.startsWith('your') : t.startsWith('opponent'))
    const p = s.phase.toLowerCase()
    return turnOk && (p.includes('any phase') || p.includes(phase.toLowerCase()))
  })
}

/** Unit abilities whose text mentions this phase. */
export function abilitiesNow<T extends { text: string }>(all: T[], phase: Phase): T[] {
  const p = `${phase.toLowerCase()} phase`
  return all.filter((a) => a.text.toLowerCase().includes(p))
}

/** Next player's turn from anywhere in the turn (the live score board's button): clock switches, phase back to Command. */
export function advanceTurn(g: Game, ctx: Pick<Ctx, 'now'>): Game {
  const settled = { ...g, clock: settle(g, ctx.now) }
  const next = nextTurn(settled, ctx)
  return next === settled ? g : { ...next, phase: 0 }
}

/** Wounds per model of a list unit: models × the W of its first stat line (1 if unknown). */
export function fullWounds(models: number, stats?: { values: [string, string][] }[]): number[] {
  const w = Number.parseInt(stats?.[0]?.values.find(([k]) => k === 'W')?.[1] ?? '', 10)
  return Array.from({ length: Math.max(1, models) }, () => (Number.isFinite(w) && w > 0 ? w : 1))
}
