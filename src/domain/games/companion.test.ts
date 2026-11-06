import { describe, expect, it } from 'vitest'
import type { Stratagem } from '../stratagems/stratagems'
import { abilityTiming, advanceTurn, fullWounds, abilitiesNow, clockTotals, damage, nextPhase, PHASES, pauseClock, startClock, stratagemsNow, woundsLeft } from './companion'
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
  it('gives each model type the W of its own stat line', () => {
    const stats = [{ name: 'Captain', values: [['W', '5']] as [string, string][] }, { name: 'Intercessor', values: [['W', '2']] as [string, string][] }]
    expect(fullWounds(3, stats, [{ name: 'Intercessor', count: 2 }, { name: 'Captain', count: 1 }])).toEqual([5, 2, 2])
    // "Intercessor Sergeant" shares the Intercessor line; unknown names use the first line.
    expect(fullWounds(2, stats, [{ name: 'Intercessor Sergeant', count: 1 }, { name: 'Gretchin', count: 1 }])).toEqual([5, 2])
    // Counts that don't match the unit size fall back to the first line.
    expect(fullWounds(3, stats, [{ name: 'Intercessor', count: 1 }])).toEqual([5, 5, 5])
  })
})

describe('abilityTiming', () => {
  it('reads named phases and whose turn', () => {
    expect(abilityTiming('In your Shooting phase, re-roll.')).toEqual({ phases: ['Shooting'], turn: 'mine' })
    expect(abilityTiming("At the end of your opponent's Fight phase, heal.")).toEqual({ phases: ['Fight'], turn: 'theirs' })
    expect(abilityTiming('At the start of the Command phase, gain 1CP.')).toEqual({ phases: ['Command'], turn: 'either' })
    expect(abilityTiming('Once per battle, in any phase, do it.')?.phases).toEqual([...PHASES])
  })
  it('reads what the ability does when no phase is named', () => {
    expect(abilityTiming('Each time a model in this unit makes a ranged attack, +1 to hit.')).toEqual({ phases: ['Shooting'], turn: 'mine' })
    expect(abilityTiming('Each time a model in this unit makes a melee attack, re-roll.')).toEqual({ phases: ['Fight'], turn: 'either' })
    expect(abilityTiming('Each time an attack targets this unit, subtract 1 from the Hit roll.')).toEqual({ phases: ['Shooting', 'Fight'], turn: 'theirs' })
    expect(abilityTiming('You can re-roll Charge rolls made for this unit.')?.phases).toEqual(['Charge'])
    expect(abilityTiming('During the Declare Battle Formations step, set up this unit in Reserves. It can Deep Strike.')?.phases).toEqual(['Movement'])
    expect(abilityTiming('This model has the Feel No Pain 5+ ability.')).toBeUndefined()
  })
  it('filters abilities by phase and turn', () => {
    const all = [{ text: "In your opponent's Shooting phase, hide." }, { text: 'In your Shooting phase, aim.' }]
    expect(abilitiesNow(all, 'Shooting', true)).toEqual([all[1]])
    expect(abilitiesNow(all, 'Shooting', false)).toEqual([all[0]])
  })
})
