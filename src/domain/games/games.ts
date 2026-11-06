import type { Ctx } from '../collection/types'
import type { ArmyList } from '../lists/types'

/** Games played: live score keeping and history (#71). */
export type SideKey = 'me' | 'them'
export const ROUNDS = 5

export interface RoundScore {
  primary: number
  secondary: number
}

export interface Side {
  name: string
  faction?: string
  /** My army list (an id in Armies). */
  listId?: string
  /** The opponent's list, imported for this game only. */
  list?: ArmyList
  cp: number
  rounds: RoundScore[]
  /** Ids of list entries destroyed. */
  destroyed: string[]
}

export interface Game {
  id: string
  date: string
  status: 'live' | 'done'
  /** My Primary Mission (or any mission name). */
  mission: string
  deployment: string
  /** Mission cards (#194): the opponent's Primary Mission and the Twist, when used. */
  theirMission?: string
  twist?: string
  battleSize?: string
  round: number
  turn: SideKey
  first: SideKey
  me: Side
  them: Side
  notes: string
  /** Companion (#72): current phase index in PHASES. */
  phase?: number
  /** Companion: wounds left per model, by list entry id (my units). */
  wounds?: Record<string, number[]>
  /** Companion: time used per player in ms, and when the running clock started. */
  clock?: { me: number; them: number; since?: string }
  createdAt: string
  updatedAt: string
}

export interface NewGame {
  myListId?: string
  myFaction?: string
  opponent?: string
  theirFaction?: string
  theirList?: ArmyList
  mission?: string
  theirMission?: string
  deployment?: string
  twist?: string
  battleSize?: string
  first?: SideKey
}

const emptyRounds = () => Array.from({ length: ROUNDS }, () => ({ primary: 0, secondary: 0 }))
const side = (name: string, faction?: string): Side => ({ name, ...(faction ? { faction } : {}), cp: 0, rounds: emptyRounds(), destroyed: [] })

export function newGame(n: NewGame, ctx: Ctx): Game {
  const first = n.first ?? 'me'
  return {
    id: ctx.newId(),
    date: ctx.now,
    status: 'live',
    mission: n.mission ?? '',
    deployment: n.deployment ?? '',
    ...(n.theirMission ? { theirMission: n.theirMission } : {}),
    ...(n.twist ? { twist: n.twist } : {}),
    ...(n.battleSize ? { battleSize: n.battleSize } : {}),
    round: 1,
    turn: first,
    first,
    me: { ...side('Me', n.myFaction), ...(n.myListId ? { listId: n.myListId } : {}) },
    them: { ...side(n.opponent?.trim() || 'Opponent', n.theirFaction), ...(n.theirList ? { list: n.theirList } : {}) },
    notes: '',
    createdAt: ctx.now,
    updatedAt: ctx.now,
  }
}

const touch = (g: Game, ctx: Pick<Ctx, 'now'>, patch: Partial<Game>): Game => ({ ...g, ...patch, updatedAt: ctx.now })
const withSide = (g: Game, k: SideKey, s: Side, ctx: Pick<Ctx, 'now'>) => touch(g, ctx, { [k]: s } as Partial<Game>)

/** Add (or remove, with a negative delta) points in the current round; never below zero. */
export function addPoints(g: Game, k: SideKey, kind: keyof RoundScore, delta: number, ctx: Pick<Ctx, 'now'>): Game {
  const s = g[k]
  const rounds = s.rounds.map((r, i) => (i === g.round - 1 ? { ...r, [kind]: Math.max(0, r[kind] + delta) } : r))
  return withSide(g, k, { ...s, rounds }, ctx)
}

export function totals(s: Side) {
  const primary = s.rounds.reduce((n, r) => n + r.primary, 0)
  const secondary = s.rounds.reduce((n, r) => n + r.secondary, 0)
  return { primary, secondary, total: primary + secondary }
}

export const setCp = (g: Game, k: SideKey, delta: number, ctx: Pick<Ctx, 'now'>) => withSide(g, k, { ...g[k], cp: Math.max(0, g[k].cp + delta) }, ctx)

/** Next player's turn: both players gain 1 CP in its Command phase; after both turns the round goes up (to 5). */
export function nextTurn(g: Game, ctx: Pick<Ctx, 'now'>): Game {
  const other: SideKey = g.turn === 'me' ? 'them' : 'me'
  const newRound = other === g.first
  if (newRound && g.round >= ROUNDS) return g
  return touch(g, ctx, { turn: other, round: newRound ? g.round + 1 : g.round, me: { ...g.me, cp: g.me.cp + 1 }, them: { ...g.them, cp: g.them.cp + 1 } })
}

export function toggleDestroyed(g: Game, k: SideKey, entryId: string, ctx: Pick<Ctx, 'now'>): Game {
  const d = g[k].destroyed
  return withSide(g, k, { ...g[k], destroyed: d.includes(entryId) ? d.filter((x) => x !== entryId) : [...d, entryId] }, ctx)
}

export const endGame = (g: Game, notes: string, ctx: Pick<Ctx, 'now'>) => touch(g, ctx, { status: 'done', notes })

export function result(g: Game): 'win' | 'loss' | 'draw' {
  const a = totals(g.me).total
  const b = totals(g.them).total
  return a > b ? 'win' : a < b ? 'loss' : 'draw'
}

export interface StatRow {
  key: string
  played: number
  wins: number
  losses: number
  draws: number
  avgFor: number
  avgAgainst: number
}

function rows(games: Game[], keyOf: (g: Game) => string): StatRow[] {
  const map = new Map<string, Game[]>()
  for (const g of games) map.set(keyOf(g), [...(map.get(keyOf(g)) ?? []), g])
  return [...map].map(([key, gs]) => ({
    key,
    played: gs.length,
    wins: gs.filter((g) => result(g) === 'win').length,
    losses: gs.filter((g) => result(g) === 'loss').length,
    draws: gs.filter((g) => result(g) === 'draw').length,
    avgFor: Math.round(gs.reduce((n, g) => n + totals(g.me).total, 0) / gs.length),
    avgAgainst: Math.round(gs.reduce((n, g) => n + totals(g.them).total, 0) / gs.length),
  }))
}

/** Results of finished games: overall, per army list and per opponent faction (most played first). */
export function gameStats(games: Game[], listName: (id: string) => string | undefined) {
  const done = games.filter((g) => g.status === 'done')
  const sort = (r: StatRow[]) => r.sort((a, b) => b.played - a.played || a.key.localeCompare(b.key))
  return {
    overall: rows(done, () => 'All games')[0] ?? { key: 'All games', played: 0, wins: 0, losses: 0, draws: 0, avgFor: 0, avgAgainst: 0 },
    byList: sort(rows(done, (g) => (g.me.listId && listName(g.me.listId)) || 'No list')),
    byOpponent: sort(rows(done, (g) => g.them.faction || 'Unknown faction')),
  }
}

/** Finished games a backlog unit played in (through the list entries it fills), and how often it was destroyed. */
export function unitRecord(unitId: string, games: Game[], lists: ArmyList[], entriesOf: (unitId: string, l: ArmyList) => string[]) {
  const byId = new Map(lists.map((l) => [l.id, l]))
  let played = 0
  let destroyed = 0
  for (const g of games) {
    const l = g.status === 'done' && g.me.listId ? byId.get(g.me.listId) : undefined
    const mine = l ? entriesOf(unitId, l) : []
    if (!mine.length) continue
    played++
    if (mine.some((id) => g.me.destroyed.includes(id))) destroyed++
  }
  return { played, destroyed }
}

/** Saved games, keeping well-formed ones. */
export function parseGames(raw: unknown): Game[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((g): g is Game => !!g && typeof g.id === 'string' && !!g.me && !!g.them && Array.isArray(g.me.rounds))
}

/** Finished games per bucket (month or week): results and average scores. */
export function resultsOver(games: Game[], keys: string[], keyOf: (date: string) => string) {
  const at = new Map(keys.map((k, i) => [k, i]))
  const zero = () => keys.map(() => 0)
  const out = { wins: zero(), losses: zero(), draws: zero(), avgFor: zero(), avgAgainst: zero() }
  const n = zero()
  for (const g of games) {
    const i = at.get(keyOf(g.date))
    if (g.status !== 'done' || i === undefined) continue
    const r = result(g)
    out[r === 'win' ? 'wins' : r === 'loss' ? 'losses' : 'draws'][i]++
    out.avgFor[i] += totals(g.me).total
    out.avgAgainst[i] += totals(g.them).total
    n[i]++
  }
  out.avgFor = out.avgFor.map((v, i) => (n[i] ? Math.round(v / n[i]) : 0))
  out.avgAgainst = out.avgAgainst.map((v, i) => (n[i] ? Math.round(v / n[i]) : 0))
  return out
}

/** Wins in a row: the current run (up to the latest game) and the best ever. */
export function streaks(games: Game[]) {
  const done = games.filter((g) => g.status === 'done').sort((a, b) => a.date.localeCompare(b.date))
  let run = 0
  let best = 0
  for (const g of done) {
    run = result(g) === 'win' ? run + 1 : 0
    best = Math.max(best, run)
  }
  return { current: run, best }
}
