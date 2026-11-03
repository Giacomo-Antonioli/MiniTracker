import { describe, expect, it } from 'vitest'
import type { Stratagem } from '../stratagems/stratagems'
import { advanceTurn, fullWounds, abilitiesNow, clockTotals, damage, nextPhase, PHASES, pauseClock, startClock, stratagemsNow, woundsLeft } from './companion'
import { newGame } from './games'

let n = 0
const ctx = (now = '2026-11-03T10:00:00.000Z') => ({ now, newId: () => `g${++n}` })

describe('phases', () => {
  it('goes through the phases, then to the next turn (CP and round as usual)', () => {
    let g = newGame({ first: 'me' }, ctx())
    expect(PHASES[g.phase ?? 0]).toBe('Command')
    for (let i = 0; i < 4; i++) g = nextPhase(g, ctx())
    expect([PHASES[g.phase!], g.turn]).toEqual(['Fight', 'me'])
    g = nextPhase(g, ctx())
    expect([PHASES[g.phase!], g.turn, g.me.cp]).toEqual(['Command', 'them', 1])
  })
})

describe('wounds per model', () => {
  it('damages a wounded model first, removes dead ones, destroys the unit at zero and brings it back when healed', () => {
    let g = newGame({}, ctx())
    const full = [2, 2, 2]
    expect(woundsLeft(g, 'e', full)).toEqual([2, 2, 2])
    g = damage(g, 'e', full, -1, ctx())
    g = damage(g, 'e', full, -1, ctx())
    expect(g.wounds!.e).toEqual([0, 2, 2])
    g = damage(g, 'e', full, -1, ctx())
    expect(g.wounds!.e).toEqual([0, 1, 2])
    g = damage(g, 'e', full, 1, ctx())
    expect(g.wounds!.e).toEqual([0, 2, 2])
    for (let i = 0; i < 4; i++) g = damage(g, 'e', full, -1, ctx())
    expect([g.wounds!.e, g.me.destroyed]).toEqual([[0, 0, 0], ['e']])
    g = damage(g, 'e', full, -1, ctx())
    expect(g.wounds!.e).toEqual([0, 0, 0])
    g = damage(g, 'e', full, 1, ctx())
    expect([g.wounds!.e, g.me.destroyed]).toEqual([[1, 0, 0], []])
    g = damage(damage(g, 'e', full, 1, ctx()), 'e', full, 1, ctx())
    expect(g.wounds!.e).toEqual([2, 1, 0])
  })
})

describe('clock', () => {
  it('runs for the player whose turn it is, pauses, and switches on the next turn', () => {
    let g = startClock(newGame({ first: 'me' }, ctx('2026-11-03T10:00:00.000Z')), ctx('2026-11-03T10:00:00.000Z'))
    expect(clockTotals(g, '2026-11-03T10:01:00.000Z')).toEqual({ me: 60000, them: 0, total: 60000, running: true })
    g = pauseClock(g, ctx('2026-11-03T10:02:00.000Z'))
    expect(clockTotals(g, '2026-11-03T10:30:00.000Z')).toEqual({ me: 120000, them: 0, total: 120000, running: false })
    g = startClock(g, ctx('2026-11-03T10:30:00.000Z'))
    for (let i = 0; i < 5; i++) g = nextPhase(g, ctx('2026-11-03T10:31:00.000Z'))
    expect(g.turn).toBe('them')
    expect(clockTotals(g, '2026-11-03T10:32:00.000Z')).toMatchObject({ me: 180000, them: 60000 })
    expect(startClock(g, ctx()).clock).toBe(g.clock)
  })
})

describe('what applies now', () => {
  const s = (name: string, turn: string, phase: string) => ({ id: name, name, turn, phase, cp: '1', type: '', text: '' }) as Stratagem
  const all = [s('A', 'Your turn', 'Shooting phase'), s('B', 'Opponent’s turn', 'Shooting phase'), s('C', 'Either player’s turn', 'Any phase'), s('D', 'Your turn', 'Movement or Charge phase'), s('E', 'Either player’s turn', 'Fight phase')]
  it('filters stratagems by whose turn and phase', () => {
    expect(stratagemsNow(all, true, 'Shooting').map((x) => x.name)).toEqual(['A', 'C'])
    expect(stratagemsNow(all, false, 'Shooting').map((x) => x.name)).toEqual(['B', 'C'])
    expect(stratagemsNow(all, true, 'Charge').map((x) => x.name)).toEqual(['C', 'D'])
  })
  it('finds ability texts that mention the phase', () => {
    expect(abilitiesNow([{ unit: 'U', name: 'Aim', text: 'In your Shooting phase, re-roll.' }, { unit: 'U', name: 'Run', text: 'Advance +2.' }], 'Shooting').map((a) => a.name)).toEqual(['Aim'])
  })
})

describe('turn and wounds helpers', () => {
  it('advances the turn from any phase, and reads wounds from the stat line', () => {
    const g = advanceTurn({ ...newGame({ first: 'me' }, ctx()), phase: 2 }, ctx())
    expect([g.turn, g.phase]).toEqual(['them', 0])
    const last = { ...newGame({ first: 'me' }, ctx()), round: 5, turn: 'them' as const }
    expect(advanceTurn(last, ctx())).toBe(last)
    expect(fullWounds(3, [{ values: [['M', '6"'], ['W', '2']] }])).toEqual([2, 2, 2])
    expect(fullWounds(0, undefined)).toEqual([1])
  })
})
