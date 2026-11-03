import { describe, expect, it } from 'vitest'
import type { ArmyList } from '../lists/types'
import { resultsOver, streaks, addPoints, endGame, gameStats, newGame, nextTurn, parseGames, result, setCp, toggleDestroyed, totals, unitRecord } from './games'

let n = 0
const ctx = { now: '2026-11-03T10:00:00Z', newId: () => `g${++n}` }
const list = (id: string, entries: string[]) => ({ id, name: id, entries: entries.map((e) => ({ id: e, datasheetId: `d-${e}`, models: 1, wargear: [] })) }) as unknown as ArmyList

describe('a live game', () => {
  it('starts in round 1 with the first player, CP 0 and empty scores', () => {
    const g = newGame({ myListId: 'L', myFaction: 'Testers', opponent: 'Bob', theirFaction: 'Orks', mission: 'Take and Hold', first: 'them' }, ctx)
    expect(g).toMatchObject({ status: 'live', round: 1, turn: 'them', first: 'them', mission: 'Take and Hold', me: { name: 'Me', listId: 'L', faction: 'Testers', cp: 0, destroyed: [] }, them: { name: 'Bob', faction: 'Orks', cp: 0 } })
    expect(g.me.rounds).toEqual([{ primary: 0, secondary: 0 }, { primary: 0, secondary: 0 }, { primary: 0, secondary: 0 }, { primary: 0, secondary: 0 }, { primary: 0, secondary: 0 }])
  })

  it('scores per round, never below zero, and sums totals', () => {
    let g = newGame({}, ctx)
    g = addPoints(g, 'me', 'primary', 5, ctx)
    g = addPoints(g, 'me', 'secondary', 3, ctx)
    g = addPoints(g, 'me', 'secondary', -9, ctx)
    g = nextTurn(nextTurn(g, ctx), ctx)
    g = addPoints(g, 'me', 'primary', 10, ctx)
    expect(g.me.rounds.slice(0, 2)).toEqual([{ primary: 5, secondary: 0 }, { primary: 10, secondary: 0 }])
    expect(totals(g.me)).toEqual({ primary: 15, secondary: 0, total: 15 })
  })

  it('moves turn by turn: both gain 1 CP each Command phase; round goes up after both turns; stops after round 5', () => {
    let g = newGame({ first: 'me' }, ctx)
    g = nextTurn(g, ctx)
    expect([g.round, g.turn, g.me.cp, g.them.cp]).toEqual([1, 'them', 1, 1])
    g = nextTurn(g, ctx)
    expect([g.round, g.turn, g.me.cp]).toEqual([2, 'me', 2])
    g = setCp(g, 'me', -5, ctx)
    expect(g.me.cp).toBe(0)
    for (let i = 0; i < 20; i++) g = nextTurn(g, ctx)
    expect([g.round, g.turn]).toEqual([5, 'them'])
  })

  it('ticks destroyed units on either side', () => {
    let g = newGame({}, ctx)
    g = toggleDestroyed(g, 'them', 'x', ctx)
    g = toggleDestroyed(g, 'me', 'a', ctx)
    g = toggleDestroyed(g, 'them', 'x', ctx)
    expect([g.me.destroyed, g.them.destroyed]).toEqual([['a'], []])
  })

  it('ends with a result from the totals', () => {
    let g = addPoints(newGame({}, ctx), 'me', 'primary', 10, ctx)
    expect(result(g)).toBe('win')
    g = addPoints(g, 'them', 'primary', 10, ctx)
    expect(result(g)).toBe('draw')
    g = endGame(addPoints(g, 'them', 'secondary', 1, ctx), 'GG', ctx)
    expect(g).toMatchObject({ status: 'done', notes: 'GG' })
    expect(result(g)).toBe('loss')
  })
})

describe('history', () => {
  const done = (listId: string | undefined, faction: string, me: number, them: number) => endGame(addPoints(addPoints(newGame({ myListId: listId, theirFaction: faction }, ctx), 'me', 'primary', me, ctx), 'them', 'primary', them, ctx), '', ctx)
  const games = [done('L', 'Orks', 80, 60), done('L', 'Orks', 50, 70), done('L', 'Tau', 60, 60), done(undefined, 'Tau', 90, 10), newGame({ myListId: 'L' }, ctx)]

  it('sums finished games by list and by opponent faction', () => {
    const s = gameStats(games, (id) => (id === 'L' ? 'My list' : undefined))
    expect(s.overall).toEqual({ key: 'All games', played: 4, wins: 2, losses: 1, draws: 1, avgFor: 70, avgAgainst: 50 })
    expect(s.byList).toEqual([{ key: 'My list', played: 3, wins: 1, losses: 1, draws: 1, avgFor: 63, avgAgainst: 63 }, { key: 'No list', played: 1, wins: 1, losses: 0, draws: 0, avgFor: 90, avgAgainst: 10 }])
    expect(s.byOpponent.map((r) => [r.key, r.played])).toEqual([['Orks', 2], ['Tau', 2]])
    expect(gameStats([], () => undefined).overall.played).toBe(0)
  })

  it('tells how often a unit played and was destroyed, through the list entries it fills', () => {
    const g1 = toggleDestroyed(newGame({ myListId: 'L' }, ctx), 'me', 'a', ctx)
    const g2 = endGame(newGame({ myListId: 'L' }, ctx), '', ctx)
    const g3 = endGame(newGame({ myListId: 'M' }, ctx), '', ctx)
    const lists = [list('L', ['a', 'b']), list('M', ['c'])]
    const entriesOf = (unitId: string, l: ArmyList) => (unitId === 'u1' ? l.entries.filter((e) => e.id === 'a').map((e) => e.id) : [])
    expect(unitRecord('u1', [endGame(g1, '', ctx), g2, g3], lists, entriesOf)).toEqual({ played: 2, destroyed: 1 })
  })

  it('reads saved games, dropping broken ones', () => {
    expect(parseGames([newGame({}, ctx), { id: 1 }, null])).toHaveLength(1)
    expect(parseGames('x')).toEqual([])
  })
})

describe('games over time', () => {
  const at = (date: string, me: number, them: number) => ({ ...endGame(addPoints(addPoints(newGame({}, ctx), 'me', 'primary', me, ctx), 'them', 'primary', them, ctx), '', ctx), date })
  const gs = [at('2026-01-05', 80, 60), at('2026-01-20', 40, 70), at('2026-03-02', 60, 60), at('2026-03-09', 90, 10), at('2026-03-10', 70, 20)]

  it('counts results and average scores per bucket', () => {
    expect(resultsOver(gs, ['2026-01', '2026-02', '2026-03'], (d) => d.slice(0, 7))).toEqual({
      wins: [1, 0, 2], losses: [1, 0, 0], draws: [0, 0, 1], avgFor: [60, 0, 73], avgAgainst: [65, 0, 30],
    })
  })

  it('finds the current and the best winning streak', () => {
    expect(streaks(gs)).toEqual({ current: 2, best: 2 })
    expect(streaks([])).toEqual({ current: 0, best: 0 })
  })
})
