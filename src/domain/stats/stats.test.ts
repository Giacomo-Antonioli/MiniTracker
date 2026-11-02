import { describe, expect, it } from 'vitest'
import { DEFAULT_PIPELINE } from '../collection/pipeline'
import type { OwnedUnit, StatusEvent } from '../collection/types'
import { byFaction, finishMonths, lastMonths, netThisYear, pace, paintedPerMonth, pileFlow, pileLevel, pileNow, streakWeeks } from './stats'

const p = DEFAULT_PIPELINE
let n = 0
const ev = (date: string, from: string, to: string, count = 1, unitId = 'u1'): StatusEvent =>
  ({ id: `e${++n}`, unitId, groupId: 'g', from, to, count, date, direction: 'forward', note: '' })
const unit = (id: string, groups: [number, string][], extra: Partial<OwnedUnit> = {}): OwnedUnit =>
  ({ id, customName: id, kitIds: [], groups: groups.map(([count, status], i) => ({ id: `${id}g${i}`, count, status, loadout: [], magnetised: [] })), tutorials: [], notes: '', photoIds: [], tags: [], lifecycle: 'active', favourite: false, nextUp: false, externalRefs: [], createdAt: '2026-01-10', updatedAt: '2026-01-10', ...extra })

describe('months', () => {
  it('lists the last n months, oldest first', () => {
    expect(lastMonths('2026-03-15', 4)).toEqual(['2025-12', '2026-01', '2026-02', '2026-03'])
  })
})

describe('paintedPerMonth', () => {
  it('counts models reaching painted, minus models moved back, ignoring moves past it', () => {
    const events = [
      ev('2026-02-03', 'primed', 'painted', 3),
      ev('2026-02-20', 'painted', 'based', 3),
      ev('2026-03-01', 'built', 'varnished', 2),
      ev('2026-03-05', 'based', 'primed', 1),
      ev('2020-01-01', 'built', 'painted', 9),
    ]
    expect(paintedPerMonth(events, p, ['2026-02', '2026-03'])).toEqual([3, 1])
  })
})

describe('pile', () => {
  const units = [unit('a', [[5, 'built'], [2, 'painted'], [4, 'wishlisted']]), unit('b', [[3, 'primed']], { lifecycle: 'sold' })]
  it('counts owned unpainted models in the collection, with a level', () => {
    expect(pileNow(units, p)).toBe(5)
    expect([pileLevel(0), pileLevel(5), pileLevel(40), pileLevel(150), pileLevel(500)]).toEqual(['Clear', 'Molehill', 'Hill', 'Mountain', 'Everest'])
  })

  it('flows: added by creation month, finished by moves, pile at each month end', () => {
    const us = [unit('a', [[5, 'built'], [2, 'painted']], { createdAt: '2026-01-10' }), unit('c', [[3, 'built']], { createdAt: '2026-03-02' })]
    const events = [ev('2026-02-03', 'primed', 'painted', 2)]
    expect(pileFlow(us, events, p, ['2026-01', '2026-02', '2026-03'])).toEqual([
      { month: '2026-01', added: 7, finished: 0, pile: 7 },
      { month: '2026-02', added: 0, finished: 2, pile: 5 },
      { month: '2026-03', added: 3, finished: 0, pile: 8 },
    ])
  })
})

describe('pace and forecast', () => {
  const events = [ev('2026-01-05', 'primed', 'painted', 3), ev('2026-02-05', 'primed', 'painted', 6), ev('2025-01-01', 'primed', 'painted', 50)]
  it('averages models painted per month over recent months, and estimates months to finish', () => {
    expect(pace(events, p, '2026-03-10', 3)).toBe(3)
    expect(finishMonths(9, 3)).toBe(3)
    expect(finishMonths(10, 3)).toBe(4)
    expect(finishMonths(0, 0)).toBe(0)
    expect(finishMonths(5, 0)).toBeUndefined()
  })

  it('counts weeks in a row with something painted, from this week or last', () => {
    const w = [ev('2026-03-09', 'primed', 'painted'), ev('2026-03-03', 'primed', 'painted'), ev('2026-02-24', 'primed', 'painted'), ev('2026-02-10', 'primed', 'painted')]
    expect(streakWeeks(w, p, '2026-03-11')).toBe(3)
    expect(streakWeeks(w.slice(1), p, '2026-03-11')).toBe(2)
    expect(streakWeeks(w.slice(1), p, '2026-03-18')).toBe(0)
  })

  it('net pile this year: painted minus owned models added', () => {
    const us = [unit('a', [[4, 'built'], [1, 'wishlisted']], { createdAt: '2026-01-10' }), unit('b', [[9, 'built']], { createdAt: '2025-06-01' })]
    expect(netThisYear(us, events, p, '2026-03-10')).toBe(5)
  })
})

describe('byFaction', () => {
  it('sums models and points painted per faction, with a finish estimate', () => {
    const us = [
      unit('a', [[4, 'painted'], [6, 'built']], { factionName: 'Orks' }),
      unit('b', [[2, 'built']], { factionName: 'Orks' }),
      unit('c', [[1, 'based']], { factionId: 'sm' }),
      unit('d', [[1, 'built']]),
    ]
    const events = [ev('2026-03-01', 'built', 'painted', 3, 'a')]
    const rows = byFaction(us, events, p, '2026-03-10', (u) => (u.id === 'a' ? 100 : undefined), (id) => (id === 'sm' ? 'Space Marines' : id))
    expect(rows).toEqual([
      { faction: 'Orks', models: 12, painted: 4, points: 100, pointsPainted: 40, finishMonths: 8 },
      { faction: 'Space Marines', models: 1, painted: 1, points: 0, pointsPainted: 0, finishMonths: 0 },
      { faction: 'No faction', models: 1, painted: 0, points: 0, pointsPainted: 0, finishMonths: undefined },
    ])
  })
})
