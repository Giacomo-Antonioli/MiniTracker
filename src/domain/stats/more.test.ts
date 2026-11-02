import { describe, expect, it } from 'vitest'
import { DEFAULT_PIPELINE } from '../collection/pipeline'
import type { OwnedUnit, StatusEvent } from '../collection/types'
import type { PaintScheme } from '../schemes/types'
import type { ShopItem } from '../shopping/types'
import { byMonth } from './stats'
import { activityByDay, byRole, paintUsage, pileAge, pointsOverTime, records, spending, stageFlow, stageTimes } from './more'

const p = DEFAULT_PIPELINE
let n = 0
const ev = (date: string, from: string, to: string, count = 1, unitId = 'u1'): StatusEvent =>
  ({ id: `e${++n}`, unitId, groupId: 'g', from, to, count, date, direction: 'forward', note: '' })
const unit = (id: string, groups: [number, string][], extra: Partial<OwnedUnit> = {}): OwnedUnit =>
  ({ id, customName: id, kitIds: [], groups: groups.map(([count, status], i) => ({ id: `${id}g${i}`, count, status, loadout: [], magnetised: [] })), tutorials: [], notes: '', photoIds: [], tags: [], lifecycle: 'active', favourite: false, nextUp: false, externalRefs: [], createdAt: '2026-01-10', updatedAt: '2026-01-10', ...extra })

describe('activity and records', () => {
  const events = [
    ev('2026-03-02T10:00:00Z', 'built', 'painted', 3),
    ev('2026-03-02T18:00:00Z', 'sprue', 'built', 2),
    ev('2026-03-10', 'built', 'painted', 1),
    ev('2026-02-03', 'built', 'painted', 2),
    ev('2026-01-20', 'built', 'painted', 1),
    ev('2026-01-06', 'built', 'painted', 1),
  ]
  it('sums models moved per day', () => {
    expect(activityByDay(events)).toEqual({ '2026-03-02': 5, '2026-03-10': 1, '2026-02-03': 2, '2026-01-20': 1, '2026-01-06': 1 })
  })
  it('finds the best month, week and day, and the longest streak', () => {
    expect(records(events, p)).toEqual({
      bestMonth: { key: '2026-03', count: 4 },
      bestWeek: { key: '2026-03-02', count: 3 },
      bestDay: { key: '2026-03-02', count: 3 },
      longestStreak: 2,
    })
    expect(records([], p)).toEqual({ longestStreak: 0 })
  })
})

describe('pile age', () => {
  it('lists the oldest unpainted units and buckets unpainted models by age', () => {
    const us = [
      unit('new', [[2, 'built']], { createdAt: '2026-03-01' }),
      unit('mid', [[3, 'built'], [1, 'painted']], { createdAt: '2025-11-01' }),
      unit('old', [[4, 'primed']], { createdAt: '2024-01-01' }),
      unit('done', [[4, 'painted']], { createdAt: '2020-01-01' }),
    ]
    const r = pileAge(us, p, '2026-03-10', 2)
    expect(r.oldest.map((x) => [x.unit.id, x.months, x.models])).toEqual([['old', 26, 4], ['mid', 4, 3]])
    expect(r.buckets).toEqual([
      { label: '< 3 months', models: 2 },
      { label: '3–6 months', models: 3 },
      { label: '6–12 months', models: 0 },
      { label: '1–2 years', models: 0 },
      { label: '2+ years', models: 4 },
    ])
  })
})

describe('stage flow and times', () => {
  it('counts forward moves into each stage per bucket', () => {
    const events = [ev('2026-03-02', 'sprue', 'built', 3), { ...ev('2026-03-05', 'primed', 'built', 1), direction: 'backward' as const }, ev('2026-02-01', 'built', 'primed', 2)]
    const flow = stageFlow(events, p, ['2026-02', '2026-03'], byMonth)
    expect(flow.find((s) => s.stage.id === 'built')!.values).toEqual([0, 3])
    expect(flow.find((s) => s.stage.id === 'primed')!.values).toEqual([2, 0])
    expect(flow.some((s) => s.stage.id === 'wishlisted')).toBe(false)
  })

  it('averages days spent in each stage and from built to painted', () => {
    const us = [unit('a', [[1, 'painted']], { createdAt: '2026-01-01' }), unit('b', [[1, 'painted']], { createdAt: '2026-01-01' })]
    const events = [
      ev('2026-01-01', 'sprue', 'built', 1, 'a'), ev('2026-01-11', 'built', 'primed', 1, 'a'), ev('2026-01-21', 'primed', 'painted', 1, 'a'),
      ev('2026-01-31', 'primed', 'painted', 1, 'b'),
    ]
    const r = stageTimes(us, events, p)
    expect(r.toPaint).toEqual({ days: 25, units: 2 })
    expect(r.stages.map((s) => [s.stage.id, s.days, s.units])).toEqual([['built', 10, 1], ['primed', 10, 1]])
    expect(stageTimes([], [], p).toPaint).toEqual({ days: undefined, units: 0 })
  })
})

describe('points, roles, money, paints', () => {
  it('works back painted points over time', () => {
    const us = [unit('a', [[4, 'painted'], [6, 'built']])]
    const events = [ev('2026-02-03', 'built', 'painted', 2, 'a'), ev('2026-03-03', 'built', 'painted', 2, 'a')]
    expect(pointsOverTime(us, events, p, ['2026-01', '2026-02', '2026-03'], byMonth, () => 100)).toEqual([0, 20, 40])
  })

  it('groups painted models by role', () => {
    const us = [unit('a', [[1, 'painted']], { datasheetId: 'hq' }), unit('b', [[5, 'built']], { datasheetId: 'line' }), unit('c', [[2, 'built']])]
    expect(byRole(us, p, (u) => (u.datasheetId === 'hq' ? 'Character' : u.datasheetId === 'line' ? 'Battleline' : undefined))).toEqual([
      { role: 'Battleline', models: 5, painted: 0 },
      { role: 'Other', models: 2, painted: 0 },
      { role: 'Character', models: 1, painted: 1 },
    ])
  })

  it('sums bought prices by bucket', () => {
    const item = (price: number | undefined, bought: boolean, updatedAt: string) => ({ id: updatedAt, kind: 'other', name: 'x', qty: 1, price, bought, sources: [], listIds: [], createdAt: updatedAt, updatedAt }) as ShopItem
    const items = [item(10, true, '2026-02-01'), item(5.5, true, '2026-02-20'), item(99, false, '2026-02-01'), item(undefined, true, '2026-03-01'), item(3, true, '2026-03-02')]
    expect(spending(items, ['2026-02', '2026-03'], byMonth)).toEqual({ values: [15.5, 3], total: 18.5 })
  })

  it('ranks paints by how many units use them, and how many owned paints are used', () => {
    const scheme = (id: string, paints: string[]) => ({ id, sections: [{ id: 's', area: 'a', steps: [{ id: 't', technique: '', note: '', paints: paints.map((paintId) => ({ paintId })) }] }] }) as unknown as PaintScheme
    const us = [unit('a', [], { schemeId: 's1' }), unit('b', [], { schemeId: 's1' }), unit('c', [], { schemeId: 's2' }), unit('d', [])]
    const stocks = new Map([['red', { quantity: 1 }], ['blue', { quantity: 2 }], ['gold', { quantity: 0 }]].map(([k, v]) => [k, { paintId: k, stage: 'in-use', ...(v as object) }])) as never
    const r = paintUsage([scheme('s1', ['red', 'gold']), scheme('s2', ['red'])], us, stocks, 5)
    expect(r.top).toEqual([{ paintId: 'red', units: 3 }, { paintId: 'gold', units: 2 }])
    expect(r).toMatchObject({ owned: 2, ownedUsed: 1 })
  })
})
